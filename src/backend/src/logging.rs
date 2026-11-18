//! Subscriber setup. Every `tracing` event goes through `hexdesk-diag`, which
//! writes the daily-rolling log file and keeps recent entries in memory for
//! the activity console and the diagnostics export. A coloured console log is
//! kept for development.

use std::sync::Mutex;

use tracing_subscriber::{
    fmt,
    layer::{Layer, SubscriberExt},
    util::SubscriberInitExt,
    EnvFilter,
};

/// Dropping the `WorkerGuard` flushes the non-blocking writer's buffer, so it
/// has to outlive every log call; otherwise the last events (including a
/// panic) never reach disk. [`shutdown`] takes and drops it.
static FILE_GUARD: Mutex<Option<tracing_appender::non_blocking::WorkerGuard>> = Mutex::new(None);

/// Installs the global subscriber, log-crate bridge and panic hook. Safe to
/// call more than once; later calls do nothing.
pub fn init() {
    let mut guard_slot = FILE_GUARD.lock().unwrap_or_else(|e| e.into_inner());
    if guard_slot.is_some() || hexdesk_diag::collector().is_some() {
        return;
    }

    // Logs live with the rest of the app's files, under the legacy storage
    // name. The Tauri log dir is keyed on the app identifier and holds none of
    // them, so release builds migrate their old files out of it below; dev
    // builds never wrote there.
    let log_dir = crate::paths::state_dir().join("logs");
    let _ = std::fs::create_dir_all(&log_dir);

    let appender = tracing_appender::rolling::Builder::new()
        .rotation(tracing_appender::rolling::Rotation::DAILY)
        .filename_prefix("hexdesk")
        .filename_suffix("log")
        .max_log_files(5)
        .build(&log_dir)
        .expect("log dir was just created");
    // Non-blocking so the scanner and OCR hot loops never stall on disk I/O.
    let (writer, guard) = tracing_appender::non_blocking(appender);
    *guard_slot = Some(guard);
    drop(guard_slot);

    // Windows paths carry the account name; show them as %USERPROFILE%.
    if let Some(home) = dirs::home_dir() {
        let home = home.to_string_lossy();
        hexdesk_diag::redact::register_replacement(&home, "%USERPROFILE%");
        hexdesk_diag::redact::register_replacement(&home.replace('\\', "/"), "%USERPROFILE%");
    }

    let collector = hexdesk_diag::Collector::new(hexdesk_diag::Config::default()).with_sink(writer);
    let diag_layer = hexdesk_diag::install(collector)
        .with_filter(filter("warn,hexdesk=debug,hexdesk_backend=debug"));

    let console_layer = fmt::layer()
        .compact()
        .with_ansi(true)
        .with_target(true)
        .with_writer(std::io::stderr)
        .with_filter(filter("info,hexdesk=info,hexdesk_backend=info"));

    let _ = tracing_subscriber::registry()
        .with(diag_layer)
        .with(console_layer)
        .try_init();

    let _ = tracing_log::LogTracer::init();

    let previous = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        let payload = info.payload();
        let message = payload
            .downcast_ref::<&str>()
            .copied()
            .or_else(|| payload.downcast_ref::<String>().map(String::as_str))
            .unwrap_or("<non-string panic payload>");
        tracing::error!(
            location = %info.location().map_or_else(|| "unknown".to_string(), ToString::to_string),
            payload = message,
            "panic"
        );
        hexdesk_diag::flush();
        previous(info);
    }));

    tracing::info!(
        version = env!("CARGO_PKG_VERSION"),
        pid = std::process::id(),
        os = std::env::consts::OS,
        log_dir = %log_dir.display(),
        "HexDesk starting"
    );
}

/// Writes pending repeat counts and everything still buffered to the log
/// file. Call right before the process exits.
pub fn shutdown() {
    tracing::info!("HexDesk stopping");
    hexdesk_diag::flush();
    let guard = FILE_GUARD.lock().unwrap_or_else(|e| e.into_inner()).take();
    drop(guard);
}

fn filter(default: &str) -> EnvFilter {
    EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new(default))
}
