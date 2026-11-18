//! Diagnostics at the Tauri boundary: the one-click export (#2) and the feed
//! for the activity console (#3). Everything comes from `hexdesk-diag` and is
//! already redacted.

use std::cell::Cell;
use std::path::{Path, PathBuf};

use hexdesk_diag::{info, Bundle, DiagError, Entry, Kind, Source};
use tauri::{Emitter, State};

use crate::app_state::AppState;

const FILE_PREFIX: &str = "hexdesk-diagnostics-";

const README: &str = "HexDesk diagnostics export

What is in this zip:
- system.json    HexDesk version and build, OS, architecture, whether HexDesk
                 runs as administrator, locale, WebView2 version, monitors,
                 installed Windows OCR languages, whether Warframe is running.
- settings.json  Your HexDesk settings.
- recent.jsonl   The most recent log entries of this session, one per line.
- logs/          The HexDesk log files of the last days.

Passwords, tokens, e-mail addresses and player names are replaced with
[redacted]. Your Windows user folder is shown as %USERPROFILE%.
";

/// The most recent log entries, oldest first: what the console shows when it
/// opens. New entries follow as `diag-entry` events.
#[tauri::command]
pub(crate) fn get_recent_logs(limit: Option<usize>) -> Vec<Entry> {
    hexdesk_diag::recent(limit.unwrap_or(usize::MAX))
}

thread_local! {
    /// Set while an entry is being forwarded. Emitting can log in turn; those
    /// entries are not forwarded again, so forwarding never recurses.
    static FORWARDING: Cell<bool> = const { Cell::new(false) };
}

/// Sends every new log entry to the main window as a `diag-entry` event.
pub(crate) fn forward_entries_to(app: tauri::AppHandle) {
    let Some(collector) = hexdesk_diag::collector() else {
        return;
    };
    collector.set_listener(move |entry| {
        if FORWARDING.with(|f| f.replace(true)) {
            return;
        }
        // No window yet, or it closed: nothing to show the entry in.
        let _ = app.emit_to("main", crate::events::DIAG_ENTRY, entry);
        FORWARDING.with(|f| f.set(false));
    });
}

/// Creates the diagnostics zip and returns its full path.
#[tauri::command]
pub(crate) async fn export_diagnostics(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<String, DiagError> {
    // Pending repeat counts belong in the exported logs.
    hexdesk_diag::flush();

    let dir = export_dir();
    std::fs::create_dir_all(&dir).map_err(|e| {
        DiagError::new(
            Source::App,
            Kind::Io,
            "Diagnostics export failed: the folder could not be created",
        )
        .with("path", dir.display())
        .caused_by(&e)
        .log()
    })?;
    let path = dir.join(format!(
        "{FILE_PREFIX}{}.zip",
        chrono::Local::now().format("%Y-%m-%d-%H%M%S")
    ));

    let ocr_languages = tokio::task::spawn_blocking(crate::ocr::ocr_languages)
        .await
        .unwrap_or_default();
    let settings = crate::settings::read_settings_map(&state.settings_path)
        .map(serde_json::Value::Object)
        .unwrap_or_else(|e| serde_json::json!({ "_error": e }));

    let mut bundle = Bundle::new();
    bundle.add_text("README.txt", README);
    bundle.add_json("system.json", system_facts(&app, ocr_languages));
    bundle.add_json("settings.json", settings);
    bundle.add_entries("recent.jsonl", &hexdesk_diag::recent(usize::MAX));
    let mut skipped = 0usize;
    for log in log_files(&crate::paths::state_dir().join("logs")) {
        let name = format!(
            "logs/{}",
            log.file_name().unwrap_or_default().to_string_lossy()
        );
        if bundle.add_log_file(&name, &log).is_err() {
            skipped += 1;
        }
    }

    let write_path = path.clone();
    let files = bundle.names().len();
    tokio::task::spawn_blocking(move || bundle.write_to(&write_path))
        .await
        .map_err(|e| {
            DiagError::new(
                Source::App,
                Kind::Internal,
                "Diagnostics export failed: its worker task stopped",
            )
            .caused_by(&e)
            .log()
        })?
        .map_err(DiagError::log)?;

    let bytes = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
    info!(
        app,
        path = %path.display(),
        files,
        unreadable_logs = skipped,
        bytes,
        "Diagnostics exported"
    );
    Ok(path.to_string_lossy().into_owned())
}

/// Opens Explorer with the exported zip selected. Only accepts files this
/// export wrote.
#[tauri::command]
pub(crate) fn show_diagnostics_export(path: String) -> Result<(), DiagError> {
    let path = PathBuf::from(path);
    let is_export = path
        .file_name()
        .and_then(|n| n.to_str())
        .is_some_and(|n| n.starts_with(FILE_PREFIX) && n.ends_with(".zip"));
    if !is_export || !path.is_file() {
        return Err(DiagError::new(
            Source::App,
            Kind::Invalid,
            "Not a HexDesk diagnostics export",
        )
        .with("path", path.display())
        .log());
    }
    tauri_plugin_opener::reveal_item_in_dir(&path).map_err(|e| {
        DiagError::new(
            Source::App,
            Kind::Internal,
            "The export folder could not be opened",
        )
        .caused_by(&e)
        .log()
    })
}

/// The Downloads folder, or the app's own diagnostics folder when Windows
/// reports none.
fn export_dir() -> PathBuf {
    dirs::download_dir().unwrap_or_else(|| crate::paths::state_dir().join("diagnostics"))
}

/// The HexDesk log files in `dir`, oldest first.
fn log_files(dir: &Path) -> Vec<PathBuf> {
    let mut files: Vec<PathBuf> = std::fs::read_dir(dir)
        .map(|entries| {
            entries
                .filter_map(Result::ok)
                .map(|e| e.path())
                .filter(|p| {
                    p.is_file()
                        && p.file_name()
                            .and_then(|n| n.to_str())
                            .is_some_and(|n| n.starts_with("hexdesk") && n.ends_with(".log"))
                })
                .collect()
        })
        .unwrap_or_default();
    files.sort();
    files
}

fn system_facts(app: &tauri::AppHandle, ocr_languages: Vec<String>) -> serde_json::Value {
    let monitors: Vec<serde_json::Value> = app
        .available_monitors()
        .unwrap_or_default()
        .iter()
        .map(|m| {
            serde_json::json!({
                "width": m.size().width,
                "height": m.size().height,
                "x": m.position().x,
                "y": m.position().y,
                "scale": m.scale_factor(),
            })
        })
        .collect();
    serde_json::json!({
        "app_version": app.package_info().version.to_string(),
        "build": if cfg!(debug_assertions) { "debug" } else { "release" },
        "os": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "hexdesk_elevated": crate::memory_scanner::elevated_text(),
        "locale": crate::platform::get_system_locale(),
        "webview2": tauri::webview_version().ok(),
        "warframe_running": crate::memory_scanner::find_warframe_pid_pub().is_some(),
        "monitors": monitors,
        "ocr_languages": ocr_languages,
        "exported_at": chrono::Local::now().to_rfc3339(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_hexdesk_log_files_are_collected_in_order() {
        let dir = std::env::temp_dir().join(format!("hexdesk-logs-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        for name in [
            "hexdesk.2026-11-18.log",
            "hexdesk.2026-11-17.log",
            "other.log",
            "hexdesk.txt",
        ] {
            std::fs::write(dir.join(name), "x").unwrap();
        }
        let names: Vec<String> = log_files(&dir)
            .iter()
            .map(|p| p.file_name().unwrap().to_string_lossy().into_owned())
            .collect();
        assert_eq!(names, ["hexdesk.2026-11-17.log", "hexdesk.2026-11-18.log"]);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn only_export_files_can_be_shown() {
        let err = show_diagnostics_export(r"C:\Windows\System32\cmd.exe".into()).unwrap_err();
        assert_eq!(err.code(), "app.invalid");
    }
}
