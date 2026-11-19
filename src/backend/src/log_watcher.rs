use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use tauri::{Emitter, Manager};
use tracing::{info, warn};

use crate::app_state::AppState;
use crate::events;
use crate::relic_pick::{build_relic_pick_payload, relic_pick_hide, relic_pick_show};
use crate::{ocr, OcrParams};

pub(crate) type RewardOcrResult = (bool, bool, Vec<String>, Vec<f32>, String);

// ── Reward-pipeline parameter groups ──────────────────────────────────────────
// Grouped so the reward-session helpers stay within clippy's argument limit.

/// Mutable reward-screen watch state owned by the EE.log reader loop.
pub(crate) struct DismissState<'a> {
    pub(crate) active_since: &'a mut Option<std::time::Instant>,
    pub(crate) last_dismiss_at: &'a mut Option<std::time::Instant>,
    pub(crate) session_relics: &'a mut Vec<String>,
    pub(crate) projection_state: &'a mut VoidProjectionState,
}

// ── Trade dialog parser ───────────────────────────────────────────────────────

struct ParsedTrade {
    with_player: String,
    trade_type: String,
    offered_items: Vec<(String, i64)>,
    offered_plat: i64,
    received_items: Vec<(String, i64)>,
    received_plat: i64,
    session_id: String,
    timestamp: String,
}

const MAX_TRADE_BUFFER_BYTES: usize = 256 * 1024;
const TRADE_SUCCESS_MARKER: &str = "the trade was successful";

/// Clean a single item line from a trade dialog:
/// strips Warframe PUA rank-dot characters and normalises mod rank suffixes.
fn clean_trade_item(raw: &str) -> String {
    let raw = raw.trim();
    let filled = raw.chars().filter(|&c| c == '\u{E114}').count();
    let total = raw
        .chars()
        .filter(|&c| c == '\u{E114}' || c == '\u{E112}')
        .count();
    if total > 0 {
        let base: String = raw
            .chars()
            .take_while(|&c| c != '\u{E114}' && c != '\u{E112}')
            .collect();
        let base = base.trim();
        return if filled == 0 {
            format!("{} (R0)", base)
        } else {
            format!("{} (R{})", base, filled)
        };
    }
    if let Some(p) = raw.find(" (") {
        let inside = &raw[p + 2..];
        if let Some(r) = inside.to_lowercase().find("rank ") {
            let rank_n = inside[r + 5..].trim_end_matches(')').trim();
            return format!("{} (R{})", &raw[..p], rank_n);
        }
        return raw[..p].trim().to_string();
    }
    raw.to_string()
}

/// Parse all items from one section of a trade dialog (offered or received).
/// Handles both repeated-line stacking and "Item x N" inline quantities.
fn extract_trade_items(section: &str) -> Vec<(String, i64)> {
    let mut order: Vec<String> = Vec::new();
    let mut counts: HashMap<String, i64> = HashMap::new();
    for line in section.lines() {
        let raw = line.trim();
        if raw.is_empty() || raw.to_lowercase().contains("platinum") {
            continue;
        }
        let (raw_name, qty) = if let Some(x_pos) = raw.rfind(" x ") {
            let qty_part = raw[x_pos + 3..].trim();
            if let Ok(n) = qty_part.parse::<i64>() {
                (&raw[..x_pos], n)
            } else {
                (raw, 1i64)
            }
        } else {
            (raw, 1i64)
        };
        let name = clean_trade_item(raw_name);
        if !name.is_empty() {
            if !counts.contains_key(&name) {
                order.push(name.clone());
            }
            *counts.entry(name).or_insert(0) += qty;
        }
    }
    order
        .into_iter()
        .map(|k| {
            let q = counts[&k];
            (k, q)
        })
        .collect()
}

/// Parse the full trade confirmation dialog from EE.log.
/// Returns None if the dialog doesn't contain the expected markers.
fn parse_trade_dialog(raw: &str) -> Option<ParsedTrade> {
    // Player names in this dialog are sometimes suffixed by a private-use-area
    // glyph (e.g. U+E000, an in-game rank/status icon) with no preceding space —
    // strip trailing PUA codepoints so `with_player` doesn't carry it along.
    let with_player = raw.find("will receive from ").and_then(|i| {
        let a = &raw[i + 18..];
        a.find(" the following").map(|j| {
            a[..j]
                .trim()
                .trim_end_matches(|c: char| ('\u{E000}'..='\u{F8FF}').contains(&c))
                .trim()
                .to_string()
        })
    })?;
    let offered_raw = raw
        .find("You are offering:")
        .and_then(|i| {
            let a = &raw[i + 17..];
            a.find("and will receive from")
                .map(|j| a[..j].trim().to_string())
        })
        .unwrap_or_default();
    let received_raw = raw
        .find("the following:")
        .and_then(|i| {
            let a = &raw[i + 14..];
            a.find(", title=").map(|j| a[..j].trim().to_string())
        })
        .unwrap_or_default();

    let parse_plat = |s: &str| -> i64 {
        s.find("Platinum x ")
            .and_then(|i| s[i + 11..].split(|c: char| !c.is_ascii_digit()).next())
            .and_then(|n| n.parse().ok())
            .unwrap_or(0)
    };

    let offered_plat = parse_plat(&offered_raw);
    let received_plat = parse_plat(&received_raw);
    let offered_items = extract_trade_items(&offered_raw);
    let received_items = extract_trade_items(&received_raw);

    if offered_items.is_empty()
        && received_items.is_empty()
        && offered_plat == 0
        && received_plat == 0
    {
        return None;
    }

    let trade_type = if offered_plat > 0 {
        "purchase"
    } else if received_plat > 0 {
        "sale"
    } else {
        "trade"
    };
    let now = chrono::Utc::now();

    Some(ParsedTrade {
        with_player,
        trade_type: trade_type.to_string(),
        offered_items,
        offered_plat,
        received_items,
        received_plat,
        session_id: now.format("%Y%m%dT%H%M%S%3f").to_string(),
        timestamp: now.to_rfc3339(),
    })
}

/// Keep enough raw EE.log text to reconstruct a trade dialog when Windows wakes
/// the tailer while Warframe is still writing the multi-line log entry.
fn collect_trade_completion(buf: &str, trade_buffer: &mut String) -> (bool, Option<ParsedTrade>) {
    trade_buffer.push_str(buf);
    if trade_buffer.len() > MAX_TRADE_BUFFER_BYTES {
        let mut start = trade_buffer.len() - MAX_TRADE_BUFFER_BYTES;
        while !trade_buffer.is_char_boundary(start) {
            start += 1;
        }
        trade_buffer.drain(..start);
    }

    let mut scan_start = trade_buffer
        .len()
        .saturating_sub(buf.len() + TRADE_SUCCESS_MARKER.len());
    while !trade_buffer.is_char_boundary(scan_start) {
        scan_start += 1;
    }
    if !trade_buffer[scan_start..]
        .to_ascii_lowercase()
        .contains(TRADE_SUCCESS_MARKER)
    {
        return (false, None);
    }

    let lower = trade_buffer.to_ascii_lowercase();
    let trade = lower
        .rfind("dialog::createokcancel")
        .and_then(|start| parse_trade_dialog(&trade_buffer[start..]));
    trade_buffer.clear();
    (true, trade)
}

/// Detect riven reroll/unveil screen open and close from freshly-read EE.log text.
/// `last_riven_fire` is the caller's cooldown/session state, carried across calls.
/// Called from the single EE.log tailer thread in `reward_watcher.rs`.
pub(crate) fn handle_riven_events(
    app: &tauri::AppHandle,
    lower: &str,
    last_riven_fire: &mut Option<std::time::Instant>,
) {
    // ── Riven reroll / unveil ─────────────────────────────────────────
    let riven_trigger =
        lower.contains("omegarerollselection.swf") || lower.contains("samodeusdioramaloaded");

    let cooldown_ok = last_riven_fire.is_none_or(|t| t.elapsed().as_secs() >= 4);

    if riven_trigger
        && cooldown_ok
        && app
            .state::<AppState>()
            .overlays_enabled
            .load(Ordering::SeqCst)
    {
        *last_riven_fire = Some(std::time::Instant::now());
        let _ = app.emit(events::RIVEN_SCREEN_OPEN, ());
        let _ = app.emit(events::STATUS_LINE, "🎲 Riven screen detected");
    }

    // ── Riven screen close — card UI hidden (primary) ─────────────────
    // DiegeticArtifactCards.lua: DBG: HudVis 0 fires when the mod card
    // overlay is hidden — the most direct signal the riven screen closed.
    // Guard: only fire ≥1 s after the open trigger (so open+close in the
    // same EE.log buffer don't cancel each other out).
    if lower.contains("digeticartifactcards.lua: dbg: hudvis 0") {
        let riven_active = last_riven_fire.is_some_and(|t| {
            let e = t.elapsed().as_secs();
            (1..600).contains(&e)
        });
        if riven_active {
            *last_riven_fire = None;
            hexdesk_diag::info!(
                overlay,
                ee_log_line = "DiegeticArtifactCards HudVis 0",
                "Riven screen closed (EE.log)"
            );
            let _ = app.emit(events::RIVEN_SCREEN_CLOSE, ());
        }
    }

    // ── Riven screen close — orbiter scene reload (fallback) ──────────
    // When the player exits the riven screen, the orbiter scene reloads
    // and creates VolumetricFog render targets. Kept as a fallback in case
    // the HudVis 0 trigger is missed.
    if lower.contains("creating render target: /ee/materials/volumetricfog") {
        let riven_active = last_riven_fire.is_some_and(|t| {
            let e = t.elapsed().as_secs();
            (3..600).contains(&e)
        });
        if riven_active {
            *last_riven_fire = None;
            hexdesk_diag::info!(
                overlay,
                ee_log_line = "VolumetricFog render target (orbiter loaded)",
                "Riven screen closed (EE.log)"
            );
            let _ = app.emit(events::RIVEN_SCREEN_CLOSE, ());
        }
    }
}

/// How long the Relic Pick overlay stays up when EE.log never reports that
/// the selection screen closed.
const RELIC_PICK_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(120);

/// A relic selection event in EE.log.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum RelicPickSignal {
    /// The relic grid finished loading.
    Open,
    /// The selection screen is over; names the EE.log line that said so.
    Close(&'static str),
}

/// The relic selection events in lower-cased EE.log text, in the order the
/// game wrote them. Order matters: one read can hold both a close line from
/// before the screen opened and the open line itself, and only a close that
/// comes after the open ends that selection.
pub(crate) fn relic_pick_signals(lower: &str) -> Vec<RelicPickSignal> {
    lower
        .lines()
        .filter_map(|line| {
            // Not PopulateInventoryGridEnd, which follows right after.
            if line
                .trim_end()
                .ends_with("themedprojectionmanager.lua: populateinventorygrid")
            {
                Some(RelicPickSignal::Open)
            } else if line.contains("subscribing for /lotus/interface/mapredux.swf")
                && line.contains("mapreduxinputfilter")
            {
                // The star chart takes input again: the player backed out.
                Some(RelicPickSignal::Close("mapredux"))
            } else if line.contains("gamerulesimpl - changing state from") {
                // A level is loading, which after a relic pick is the mission.
                Some(RelicPickSignal::Close("GameRulesImpl state change"))
            } else {
                None
            }
        })
        .collect()
}

/// Start a relic selection and return its session value (always odd). A
/// selection that is still open is replaced, which also stops its pending
/// steps.
pub(crate) fn begin_relic_pick(counter: &AtomicU64) -> u64 {
    let step = |v: u64| if v % 2 == 1 { v + 2 } else { v + 1 };
    let previous = counter
        .fetch_update(Ordering::SeqCst, Ordering::SeqCst, |v| Some(step(v)))
        .unwrap_or_else(|v| v);
    step(previous)
}

/// End the open relic selection. With `Some(session)` only that selection is
/// ended. Returns false when there was nothing to end.
pub(crate) fn end_relic_pick(counter: &AtomicU64, session: Option<u64>) -> bool {
    counter
        .fetch_update(Ordering::SeqCst, Ordering::SeqCst, |v| {
            let open = v % 2 == 1 && session.is_none_or(|s| s == v);
            open.then_some(v + 1)
        })
        .is_ok()
}

fn relic_pick_on(state: &AppState) -> bool {
    state.overlays_enabled.load(Ordering::SeqCst)
        && state.relic_pick_overlay_enabled.load(Ordering::SeqCst)
}

/// What one read of EE.log means for the relic selection.
#[derive(Debug, PartialEq, Eq)]
pub(crate) struct RelicPickRead {
    /// The last close line, which ends a selection opened in an earlier read.
    pub close: Option<&'static str>,
    /// Selection screens that opened and closed again within this read.
    pub closed_opens: usize,
    /// A selection screen is open at the end of this read.
    pub open: bool,
}

/// Sums up the signals of one read. The game writes EE.log to disk in bursts,
/// seconds after the fact, so one read can hold several screens; only the
/// state at its end is still on screen.
pub(crate) fn relic_pick_read(signals: &[RelicPickSignal]) -> RelicPickRead {
    let open = matches!(signals.last(), Some(RelicPickSignal::Open));
    let opens = signals
        .iter()
        .filter(|s| **s == RelicPickSignal::Open)
        .count();
    RelicPickRead {
        close: signals.iter().rev().find_map(|s| match s {
            RelicPickSignal::Close(line) => Some(*line),
            RelicPickSignal::Open => None,
        }),
        closed_opens: opens - usize::from(open),
        open,
    }
}

/// Detect the relic-pick screen trigger and its dismiss from freshly-read EE.log text.
pub(crate) fn handle_relic_pick_events(app: &tauri::AppHandle, lower: &str) {
    let signals = relic_pick_signals(lower);
    if signals.is_empty() {
        return;
    }
    let read = relic_pick_read(&signals);
    // A close followed by an open in the same read leaves a selection on
    // screen, so only a read that ends closed hides the overlay.
    if let (Some(line), false) = (read.close, read.open) {
        close_relic_pick(app, line);
    }
    if read.closed_opens > 0 {
        hexdesk_diag::info!(
            overlay,
            screens = read.closed_opens,
            "Relic selection screen seen in EE.log, closed again within the same read"
        );
    }
    if read.open {
        open_relic_pick(app, last_open_seconds(lower));
    }
}

/// When the game started writing the current EE.log, from its
/// "Current time: Thu Nov 19 23:44:03 2026" line. Line times in EE.log are
/// seconds since then.
static EE_LOG_START: std::sync::Mutex<Option<chrono::NaiveDateTime>> = std::sync::Mutex::new(None);

/// The start time in an EE.log "Current time:" line, if `text` holds one.
pub(crate) fn parse_ee_log_start(text: &str) -> Option<chrono::NaiveDateTime> {
    let line = text.lines().find(|l| l.contains("Current time:"))?;
    let after = line.split("Current time:").nth(1)?;
    let stamp = after.split('[').next()?.trim();
    chrono::NaiveDateTime::parse_from_str(stamp, "%a %b %d %H:%M:%S %Y").ok()
}

/// Remembers the EE.log start time when `text` holds it. A new log starts
/// with it, so this follows a game restart.
pub(crate) fn note_ee_log_start(text: &str) {
    if let Some(start) = parse_ee_log_start(text) {
        *EE_LOG_START.lock().unwrap_or_else(|e| e.into_inner()) = Some(start);
    }
}

/// Reads the EE.log start time from the head of the file.
pub(crate) fn seed_ee_log_start(log_path: &std::path::Path) {
    use std::io::Read;
    let mut head = vec![0u8; 8 * 1024];
    let Ok(n) = std::fs::File::open(log_path).and_then(|mut f| f.read(&mut head)) else {
        return;
    };
    note_ee_log_start(&String::from_utf8_lossy(&head[..n]));
}

/// Seconds since the log started of the last relic list open line in `lower`.
pub(crate) fn last_open_seconds(lower: &str) -> Option<f64> {
    lower
        .lines()
        .rev()
        .find(|l| {
            l.trim_end()
                .ends_with("themedprojectionmanager.lua: populateinventorygrid")
        })?
        .split_whitespace()
        .next()?
        .parse()
        .ok()
}

/// The local time an EE.log line was written, from its seconds since start.
fn ee_log_time(seconds: Option<f64>) -> Option<chrono::DateTime<chrono::Local>> {
    let start = (*EE_LOG_START.lock().unwrap_or_else(|e| e.into_inner()))?;
    let start = start.and_local_timezone(chrono::Local).single()?;
    Some(start + chrono::Duration::milliseconds((seconds? * 1000.0) as i64))
}

fn close_relic_pick(app: &tauri::AppHandle, ee_log_line: &'static str) {
    if !end_relic_pick(&app.state::<AppState>().relic_pick_session, None) {
        return;
    }
    hexdesk_diag::info!(
        overlay,
        ee_log_line,
        "Relic Pick overlay closing: EE.log reports the selection screen closed"
    );
    relic_pick_hide(app);
    let _ = app.emit(events::RELIC_PICK_CLOSE, ());
}

fn open_relic_pick(app: &tauri::AppHandle, line_seconds: Option<f64>) {
    let state = app.state::<AppState>();
    let overlay_on = relic_pick_on(&state);
    hexdesk_diag::info!(overlay, overlay_on, "Relic selection screen seen in EE.log");
    if !overlay_on {
        hexdesk_diag::debug!(
            overlay,
            "Relic Pick overlay skipped: turned off in settings"
        );
        return;
    }
    let line_time = ee_log_time(line_seconds);
    if crate::overlay_key::key_used_after(line_time) {
        // EE.log reaches the disk late, so this line can describe the screen
        // the player already showed or hid with the key.
        hexdesk_diag::info!(
            overlay,
            line_time = line_time
                .map(|t| t.format("%H:%M:%S").to_string())
                .unwrap_or_default(),
            "Relic Pick overlay left as it is: the overlay key was used after this EE.log line"
        );
        return;
    }
    start_relic_pick(app, false);
}

/// Start a selection and show the overlay for it once the era is read.
/// `screen_up` says the relic list is already on screen (the overlay key
/// read it), so there is no need to wait for it to finish drawing.
pub(crate) fn start_relic_pick(app: &tauri::AppHandle, screen_up: bool) {
    let session = begin_relic_pick(&app.state::<AppState>().relic_pick_session);
    let app = app.clone();
    std::thread::spawn(move || show_relic_pick(&app, session, screen_up));
}

/// Era reads before the overlay gives up, and the pause between them. An
/// EE.log line can arrive while the screen is still drawing its era label.
const ERA_ATTEMPTS: u32 = 3;
const ERA_RETRY: std::time::Duration = std::time::Duration::from_millis(500);

/// Read the fissure era and show the overlay, unless the selection this
/// `session` belongs to closed in the meantime.
fn show_relic_pick(app: &tauri::AppHandle, session: u64, screen_up: bool) {
    let state = app.state::<AppState>();
    let current = || state.relic_pick_session.load(Ordering::SeqCst) == session;
    if !screen_up {
        // Give the screen time to finish rendering before the capture.
        std::thread::sleep(std::time::Duration::from_millis(400));
    }
    let started = std::time::Instant::now();
    let mut era = None;
    let mut attempts = 0;
    while attempts < ERA_ATTEMPTS {
        if attempts > 0 {
            std::thread::sleep(ERA_RETRY);
        }
        if !relic_pick_on(&state) || !current() {
            return;
        }
        attempts += 1;
        era = crate::ocr::detect_fissure_era();
        if era.is_some() {
            break;
        }
    }
    let ocr_ms = started.elapsed().as_millis() as u64;
    let Some(era) = era else {
        let _ = hexdesk_diag::DiagError::new(
            hexdesk_diag::Source::Overlay,
            hexdesk_diag::Kind::NotFound,
            "Relic Pick overlay not shown: no fissure era read from the screen",
        )
        .with("attempts", attempts)
        .with("ocr_ms", ocr_ms)
        .log();
        return;
    };
    let payload = build_relic_pick_payload(&era, app);
    if !relic_pick_on(&state) {
        return;
    }
    if !current() {
        hexdesk_diag::info!(
            overlay,
            era = %era,
            ocr_ms,
            "Relic Pick overlay not shown: the selection screen closed before the era was read"
        );
        return;
    }
    let relic_count = payload["relics"].as_array().map_or(0, |a| a.len());
    hexdesk_diag::info!(
        overlay,
        era = %era,
        relics = relic_count,
        attempts,
        ocr_ms,
        "Fissure era read for the Relic Pick overlay"
    );
    // Shown from Rust rather than from the WebView, so placement and
    // visibility do not depend on when the overlay page handles the event.
    relic_pick_show(app);
    // A close or a settings change can land while the window was being shown.
    if !relic_pick_on(&state) || !current() {
        relic_pick_hide(app);
        let _ = app.emit(events::RELIC_PICK_CLOSE, ());
        return;
    }
    let _ = app.emit(events::RELIC_PICK_OPEN, payload);

    std::thread::sleep(RELIC_PICK_TIMEOUT);
    if end_relic_pick(&state.relic_pick_session, Some(session)) {
        hexdesk_diag::info!(
            overlay,
            timeout_s = RELIC_PICK_TIMEOUT.as_secs(),
            "Relic Pick overlay hidden: no close line in EE.log before the timeout"
        );
        relic_pick_hide(app);
        let _ = app.emit(events::RELIC_PICK_CLOSE, ());
    }
}

/// Detect an in-game trade offer dialog and its completion from EE.log text.
pub(crate) fn handle_trade_completion(
    app: &tauri::AppHandle,
    buf: &str,
    trade_buffer: &mut String,
) {
    let (completed, trade) = collect_trade_completion(buf, trade_buffer);
    if let Some(t) = trade {
        info!(
            with_player = %t.with_player,
            trade_type = %t.trade_type,
            offered_items = t.offered_items.len(),
            received_items = t.received_items.len(),
            "trade completion detected"
        );
        if let Err(error) = app.emit(events::TRADE_COMPLETED, serde_json::json!({
            "sessionId":     t.session_id,
            "withPlayer":    t.with_player,
            "tradeType":     t.trade_type,
            "offeredItems":  t.offered_items.iter().map(|(n, q)| serde_json::json!({"name": n, "qty": q})).collect::<Vec<_>>(),
            "offeredPlat":   t.offered_plat,
            "receivedItems": t.received_items.iter().map(|(n, q)| serde_json::json!({"name": n, "qty": q})).collect::<Vec<_>>(),
            "receivedPlat":  t.received_plat,
            "timestamp":     t.timestamp,
        })) {
            warn!(%error, "failed to emit trade-completed event");
        }
    } else if completed {
        warn!("trade completion detected, but confirmation dialog could not be parsed");
    }
}

/// Extract the local player name from EE.log lines containing "Logged in NAME".
/// Adds the name to shared_squad_names (for OCR filtering) and AppState.local_player_name
/// (for UI display). Safe to call with a single line or the full log contents.
pub(crate) fn parse_logged_in_name(
    text: &str,
    squad_names: &std::sync::Arc<std::sync::Mutex<Vec<String>>>,
    app: &tauri::AppHandle,
) {
    // Target: "Sys [Info]: Logged in Sikewyrm"
    // The account-login line has exactly ONE token after "Logged in" and nothing more.
    // Lines like "Logged in to region server" have multiple tokens — skip them.
    // Match "]: Logged in " so we don't trigger on unrelated "Logged in …" phrases.
    const MARKER: &str = "]: Logged in ";
    for line in text.lines().rev() {
        let Some(pos) = line.find(MARKER) else {
            continue;
        };
        let after = line[pos + MARKER.len()..].trim();
        let name: String = after.chars().take_while(|c| !c.is_whitespace()).collect();
        // Skip if anything follows the name — that means it's "Logged in to X", not an account.
        let remainder = after[name.len()..].trim();
        if name.len() < 3 || !remainder.is_empty() {
            continue;
        }
        hexdesk_diag::redact::register_secret(&name);
        if let Ok(mut g) = squad_names.lock() {
            if !g.iter().any(|n: &String| n == &name) {
                g.push(name.clone());
            }
        }
        if let Ok(mut n) = app.state::<AppState>().local_player_name.lock() {
            *n = Some(name.clone());
        }
        // Emit immediately so the header updates without waiting for the next scan tick.
        let _ = app.emit(events::PLAYER_NAME, &name);
        return;
    }
}

/// Seed local-player and squad names from bounded reads of the existing EE.log.
pub(crate) fn seed_ee_log_names(
    log_path: &std::path::Path,
    squad_names: &std::sync::Arc<std::sync::Mutex<Vec<String>>>,
    app: &tauri::AppHandle,
) {
    use std::io::{Read, Seek, SeekFrom};

    if let Ok(mut f) = std::fs::File::open(log_path) {
        let mut first = Vec::with_capacity(64 * 1024);
        let _ = (&mut f).take(64 * 1024).read_to_end(&mut first);
        if let Ok(text) = std::str::from_utf8(&first) {
            parse_logged_in_name(text, squad_names, app);
        }

        let file_len = f.seek(SeekFrom::End(0)).unwrap_or(0);
        let read_from = file_len.saturating_sub(1_048_576);
        let _ = f.seek(SeekFrom::Start(read_from));
        let mut buf = Vec::with_capacity(1_048_576);
        let _ = f.read_to_end(&mut buf);
        let start = if read_from > 0 {
            buf.iter().position(|&b| b == b'\n').map_or(0, |i| i + 1)
        } else {
            0
        };
        if let Ok(text) = std::str::from_utf8(&buf[start..]) {
            parse_logged_in_name(text, squad_names, app);
            for line in text.lines() {
                let name =
                    if let Some(after) = line.find("AddSquadMember: ").map(|i| &line[i + 16..]) {
                        after
                            .split(',')
                            .next()
                            .map(str::trim)
                            .filter(|name| !name.is_empty())
                    } else if line.contains(" - new avatar: ") {
                        line.find("]: ")
                            .map(|i| &line[i + 3..])
                            .and_then(|after| after.split(" - new avatar:").next())
                            .map(str::trim)
                            .filter(|name| name.len() >= 3 && !name.contains(' '))
                    } else {
                        None
                    };
                if let Some(name) = name {
                    hexdesk_diag::redact::register_secret(name);
                    if let Ok(mut names) = squad_names.lock() {
                        if !names.iter().any(|existing| existing == name) {
                            names.push(name.to_string());
                        }
                    }
                }
            }
        }
    }
}

/// Update the OCR name filter from newly appended EE.log lines.
pub(crate) fn collect_ee_log_names(
    text: &str,
    squad_names: &std::sync::Arc<std::sync::Mutex<Vec<String>>>,
    app: &tauri::AppHandle,
) {
    for line in text.lines() {
        let name = if let Some(after) = line.find("AddSquadMember: ").map(|i| &line[i + 16..]) {
            after
                .split(',')
                .next()
                .map(str::trim)
                .filter(|name| !name.is_empty())
        } else if line.contains(" - new avatar: ") {
            line.find("]: ")
                .map(|i| &line[i + 3..])
                .and_then(|after| after.split(" - new avatar:").next())
                .map(str::trim)
                .filter(|name| name.len() >= 3 && !name.contains(' '))
        } else {
            None
        };
        if let Some(name) = name {
            hexdesk_diag::redact::register_secret(name);
            if let Ok(mut names) = squad_names.lock() {
                if !names.iter().any(|existing| existing == name) {
                    names.push(name.to_string());
                }
            }
        }
        if line.contains("Logged in ") {
            parse_logged_in_name(line, squad_names, app);
        }
    }
}

/// Collect the distinct relic projection paths announced while squad loadouts download.
pub(crate) fn collect_session_relics(text: &str, session_relics: &mut Vec<String>) {
    for line in text.lines() {
        if line.contains("Resource load completed")
            && line.contains("/Lotus/Types/Game/Projections/")
        {
            if let Some(paren) = line.find("(/Lotus/Types/Game/Projections/") {
                let path = line[paren + 1..].split(')').next().unwrap_or("").trim();
                if !path.is_empty() && !session_relics.iter().any(|relic| relic == path) {
                    session_relics.push(path.to_string());
                }
            }
        }
    }
}

/// Catch up `session_relics` from EE.log history at thread startup, for when
/// HexDesk is launched mid-mission — the live tailer only reads forward from
/// the file's current end, so any relic loads that already happened this mission
/// (before HexDesk attached) would otherwise never enter the OCR prefilter.
///
/// Reads the last `BACKFILL_BYTES` of EE.log and only considers text after the
/// most recent dismiss marker in that window (mirroring the live clear-on-dismiss
/// behavior), so relics from an already-closed earlier cycle aren't seeded in.
pub(crate) fn seed_session_relics(log_path: &std::path::Path, session_relics: &mut Vec<String>) {
    use std::io::{Read, Seek, SeekFrom};
    const BACKFILL_BYTES: u64 = 4 * 1024 * 1024;

    let Ok(mut f) = std::fs::File::open(log_path) else {
        return;
    };
    let file_len = f.seek(SeekFrom::End(0)).unwrap_or(0);
    let read_from = file_len.saturating_sub(BACKFILL_BYTES);
    if f.seek(SeekFrom::Start(read_from)).is_err() {
        return;
    }
    let mut buf = Vec::with_capacity((file_len - read_from) as usize);
    if f.read_to_end(&mut buf).is_err() {
        return;
    }
    let Ok(text) = std::str::from_utf8(&buf) else {
        return;
    };

    // ASCII-only lowercasing keeps byte offsets aligned with `text` so the slice
    // below can't land mid-character (unlike `to_lowercase()`, which can change
    // byte length for some non-ASCII input such as accented player names).
    let lower = text.to_ascii_lowercase();
    let last_dismiss_pos = [
        "relic reward screen shut down",
        "closevoidprojectionrewardscreen",
        "matchingservice::endsession",
    ]
    .iter()
    .filter_map(|marker| lower.rfind(marker))
    .max();
    let scan_from = last_dismiss_pos.unwrap_or(0);
    collect_session_relics(&text[scan_from..], session_relics);
}

#[derive(Default)]
pub(crate) struct VoidProjectionState {
    in_sequence: bool,
    sequence_completed: bool,
    other_ids: std::collections::HashSet<String>,
    own_item: String,
    // Squad members who cracked nothing this round ("<id> gets reward NULL").
    // No reward card is shown for them, so the EE hint (expected card count)
    // must subtract them from squad size or OCR retries past the point where
    // every real card has already been found.
    null_reward_ids: std::collections::HashSet<String>,
}

impl VoidProjectionState {
    pub(crate) fn consume_sequence_completed(&mut self) -> bool {
        std::mem::take(&mut self.sequence_completed)
    }

    pub(crate) fn take_own_item(&mut self) -> Option<String> {
        if self.own_item.is_empty() {
            None
        } else {
            Some(std::mem::take(&mut self.own_item))
        }
    }
}

/// Update the VoidProjections reward-handshake state from newly appended EE.log lines.
pub(crate) fn collect_void_projection_state(
    text: &str,
    state: &mut VoidProjectionState,
    squad_size: &std::sync::Arc<std::sync::Mutex<Option<usize>>>,
) {
    for line in text.lines() {
        let lower = line.to_lowercase();
        if lower.contains("voidprojections: getvoidprojectionreward") {
            state.in_sequence = true;
            state.other_ids.clear();
            state.null_reward_ids.clear();
            state.own_item.clear();
            if let Ok(mut size) = squad_size.lock() {
                *size = None;
            }
        }
        if lower.contains("gets reward /lotus/") {
            if let Some(index) = line.find("/Lotus/") {
                state.own_item = line[index..].trim().to_string();
            }
        }
        if state.in_sequence {
            if lower.contains("still waiting on response from") {
                if let Some(id) = lower.split_whitespace().last() {
                    state.other_ids.insert(id.to_string());
                }
            } else if lower.contains("gets reward null") {
                if let Some(id) = lower.split_whitespace().next() {
                    state.null_reward_ids.insert(id.to_string());
                }
            } else if lower.contains("has reward info for all players now") {
                let squad_total = (1 + state.other_ids.len()).clamp(1, 4);
                let squad = squad_total
                    .saturating_sub(state.null_reward_ids.len())
                    .max(1);
                if let Ok(mut size) = squad_size.lock() {
                    *size = Some(squad);
                }
                state.in_sequence = false;
                state.sequence_completed = true;
                hexdesk_diag::debug!(
                    overlay,
                    own_item = %state.own_item,
                    others_in_squad = state.other_ids.len(),
                    null_rewards = state.null_reward_ids.len(),
                    squad_total,
                    expected_cards = squad,
                    "Squad size read from EE.log"
                );
            }
        }
    }
}

/// Apply the local player's EE.log reward before the next memory scan completes.
pub(crate) fn apply_reward_inventory_update(app: &tauri::AppHandle, store_path: String) {
    let inv_path = crate::worldstate::store_to_unique(&store_path);
    let state: tauri::State<AppState> = app.state();
    let (old_qty, new_qty) = {
        let mut quantities = state
            .current_quantities
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        let old = *quantities.get(&inv_path).unwrap_or(&0);
        let new = old + 1;
        quantities.insert(inv_path.clone(), new);
        (old, new)
    };
    let _ = app.emit(
        events::INVENTORY_REWARD,
        serde_json::json!({ "path": inv_path, "qty": new_qty }),
    );
    hexdesk_diag::info!(
        scanner,
        item = %inv_path,
        old_qty,
        new_qty,
        "Inventory updated from a relic reward in EE.log"
    );
}

/// Handle an EE.log reward-screen dismissal and schedule the overlay cleanup.
pub(crate) fn dismiss_relic_rewards(
    app: &tauri::AppHandle,
    text: &str,
    reward_screen_active: &std::sync::Arc<std::sync::atomic::AtomicBool>,
    rewards_emitted_ms: &std::sync::Arc<std::sync::atomic::AtomicU64>,
    best_reward_payload: &std::sync::Arc<std::sync::Mutex<Option<serde_json::Value>>>,
    state: DismissState<'_>,
) -> bool {
    let DismissState {
        active_since,
        last_dismiss_at,
        session_relics,
        projection_state,
    } = state;
    let lower = text.to_lowercase();
    let is_dismiss = lower.contains("relic reward screen shut down")
        || lower.contains("closevoidprojectionrewardscreen")
        || lower.contains("matchingservice::endsession");
    if !is_dismiss {
        return false;
    }

    let dismiss_line = text
        .lines()
        .find(|line| {
            let line = line.to_lowercase();
            line.contains("relic reward screen shut down")
                || line.contains("closevoidprojectionrewardscreen")
                || line.contains("matchingservice::endsession")
        })
        .unwrap_or("<unknown dismiss line>")
        .trim();
    hexdesk_diag::info!(
        overlay,
        ee_log_line = %dismiss_line,
        open_for_ms = active_since.map(|time| time.elapsed().as_millis() as u64),
        "Relic reward screen closed (EE.log)"
    );
    reward_screen_active.store(false, Ordering::SeqCst);
    *active_since = None;
    *last_dismiss_at = Some(std::time::Instant::now());
    // Only clear on a true mission/session boundary. Endless missions (Survival,
    // Excavation, etc.) pick relics once and reuse them across every reward
    // rotation — the game never re-logs "Resource load completed" for a relic
    // already in memory, so clearing on every rotation's dismiss (as opposed to
    // just the final one) would empty session_relics for every rotation after
    // the first, forcing OCR to fall back to the full ~700-item catalog instead
    // of the narrowed one, which makes reward reads slow on endless missions.
    if lower.contains("matchingservice::endsession") {
        session_relics.clear();
    }
    if let Some(store_path) = projection_state.take_own_item() {
        apply_reward_inventory_update(app, store_path);
    }

    const MIN_DISPLAY_MS: u64 = 5_000;
    let emitted_at = rewards_emitted_ms.load(Ordering::SeqCst);
    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0);

    // Nothing was ever shown this session (OCR never reached complete/soft-complete)
    // but a confirmed partial match may be sitting ready — publish it now instead of
    // discarding it, so the user sees something rather than nothing. The full grace
    // period applies from this moment since the overlay hasn't been visible yet.
    let late_payload = if emitted_at == 0 {
        best_reward_payload
            .lock()
            .ok()
            .and_then(|mut guard| guard.take())
    } else {
        None
    };
    let delay_ms = if let Some(payload) = &late_payload {
        publish_relic_rewards(app, Some(payload));
        hexdesk_diag::info!(
            overlay,
            reason =
                "the reward screen closed before a confirmed read; showing the best partial read",
            "Relic reward overlay opened"
        );
        MIN_DISPLAY_MS
    } else if emitted_at > 0 {
        MIN_DISPLAY_MS.saturating_sub(now_ms.saturating_sub(emitted_at))
    } else {
        0
    };
    rewards_emitted_ms.store(0, Ordering::SeqCst);

    let dismiss_app = app.clone();
    std::thread::spawn(move || {
        if delay_ms > 0 {
            std::thread::sleep(std::time::Duration::from_millis(delay_ms));
        }
        if let Some(window) = dismiss_app.get_webview_window("relic-overlay") {
            let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                x: 0,
                y: -3000,
            }));
        }
        if let Ok(mut rewards) = dismiss_app.state::<AppState>().pending_relic_rewards.lock() {
            *rewards = None;
        }
        let _ = dismiss_app.emit(events::RELIC_REWARDS, serde_json::Value::Null);
    });
    true
}

/// Dismiss a reward overlay that remained active beyond its maximum window.
pub(crate) fn auto_dismiss_relic_rewards(
    app: &tauri::AppHandle,
    reward_screen_active: &std::sync::Arc<std::sync::atomic::AtomicBool>,
    active_since: &mut Option<std::time::Instant>,
    last_dismiss_at: &mut Option<std::time::Instant>,
    rewards_emitted_ms: &std::sync::Arc<std::sync::atomic::AtomicU64>,
) {
    let Some(since) = *active_since else { return };
    if since.elapsed().as_secs() < 20 {
        return;
    }
    close_reward_overlay(
        app,
        reward_screen_active,
        active_since,
        last_dismiss_at,
        rewards_emitted_ms,
        "no close line in EE.log within 20 s",
    );
}

/// Hide the reward overlay now and clear its state. Used by the 20 s timeout and
/// when the relic-pick grid opens (the reward screen has closed by then, even if
/// its "shut down" line hasn't reached EE.log yet). Skips the 5 s minimum display.
pub(crate) fn close_reward_overlay(
    app: &tauri::AppHandle,
    reward_screen_active: &std::sync::Arc<std::sync::atomic::AtomicBool>,
    active_since: &mut Option<std::time::Instant>,
    last_dismiss_at: &mut Option<std::time::Instant>,
    rewards_emitted_ms: &std::sync::Arc<std::sync::atomic::AtomicU64>,
    reason: &str,
) {
    hexdesk_diag::info!(
        overlay,
        reason,
        open_for_ms = active_since.map(|since| since.elapsed().as_millis() as u64),
        "Relic reward overlay hidden"
    );
    reward_screen_active.store(false, Ordering::SeqCst);
    *active_since = None;
    *last_dismiss_at = Some(std::time::Instant::now());
    rewards_emitted_ms.store(0, Ordering::SeqCst);
    if let Some(window) = app.get_webview_window("relic-overlay") {
        let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
            x: 0,
            y: -3000,
        }));
    }
    if let Ok(mut rewards) = app.state::<AppState>().pending_relic_rewards.lock() {
        *rewards = None;
    }
    let _ = app.emit(events::RELIC_REWARDS, serde_json::Value::Null);
}

/// Narrow the OCR catalog to rewards from relics seen in the current session.
pub(crate) fn build_relic_reward_catalog(
    app: &tauri::AppHandle,
    session_relics: &[String],
    full_catalog: &std::sync::Arc<Vec<(String, String)>>,
) -> (std::sync::Arc<Vec<(String, String)>>, String) {
    if session_relics.is_empty() {
        return (
            std::sync::Arc::clone(full_catalog),
            "  No relics collected — using full catalog (HexDesk started mid-mission?)".to_string(),
        );
    }
    let mut rewards: Vec<(String, String)> = {
        let state = app.state::<AppState>();
        let reward_map = state
            .relic_rewards
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        session_relics
            .iter()
            .filter_map(|path| reward_map.get(path.as_str()))
            .flat_map(|rewards| {
                rewards
                    .iter()
                    .map(|reward| (reward.unique_name.clone(), reward.name.clone()))
            })
            .filter(|(_, name)| !name.is_empty())
            .collect()
    };
    if rewards.is_empty() {
        return (
            std::sync::Arc::clone(full_catalog),
            format!(
                "  {} relic path(s) found but none matched relic_rewards — using full catalog\n  Paths: {:?}",
                session_relics.len(), session_relics
            ),
        );
    }
    rewards.sort_by(|a, b| a.0.cmp(&b.0).then(a.1.cmp(&b.1)));
    rewards.dedup_by(|a, b| !a.0.is_empty() && a.0 == b.0);
    let names: Vec<&str> = rewards.iter().map(|(_, name)| name.as_str()).collect();
    let sample = &names[..names.len().min(8)];
    let log = format!(
        "  {} relic(s) → {} rewards (direct from Relics.json)\n  Relics: {:?}\n  Rewards: {:?}",
        session_relics.len(),
        rewards.len(),
        session_relics,
        sample
    );
    (std::sync::Arc::new(rewards), log)
}

/// Build a fallback OCR catalog when the initial cache was empty at monitor startup.
pub(crate) fn build_fallback_reward_catalog(
    app: &tauri::AppHandle,
) -> Option<std::sync::Arc<Vec<(String, String)>>> {
    let state = app.state::<AppState>();
    let items = state.wfcd_items.lock().unwrap_or_else(|e| e.into_inner());
    if items.is_empty() {
        return None;
    }
    let blueprints = state
        .blueprint_to_result
        .lock()
        .unwrap_or_else(|e| e.into_inner());
    let excluded = [
        "Warframes",
        "Primary",
        "Secondary",
        "Melee",
        "Companion",
        "Sentinels",
        "Archwing",
        "Arch-Gun",
        "Arch-Melee",
        "Pets",
        "Robotic",
    ];
    let mut catalog: Vec<(String, String)> = items
        .iter()
        .filter(|item| {
            let name = item.name.to_lowercase();
            !excluded.contains(&item.category.as_str())
                && !name.ends_with("intact")
                && !name.ends_with("exceptional")
                && !name.ends_with("flawless")
                && !name.ends_with("radiant")
                && (name.contains("prime") || name.starts_with("forma"))
        })
        .map(|item| (item.unique_name.clone(), item.name.clone()))
        .collect();
    for (path, (name, _)) in blueprints.iter() {
        let lower = name.to_lowercase();
        if lower.contains("prime") || lower.starts_with("forma") {
            catalog.push((path.clone(), name.clone()));
        }
    }
    catalog.sort_by(|a, b| a.0.cmp(&b.0));
    catalog.dedup_by(|a, b| a.0 == b.0);
    (!catalog.is_empty()).then(|| std::sync::Arc::new(catalog))
}

/// Prepare OCR hints immediately when a relic reward screen is triggered.
pub(crate) fn prepare_reward_trigger(
    app: &tauri::AppHandle,
    squad_names: &std::sync::Arc<std::sync::Mutex<Vec<String>>>,
    squad_size: &std::sync::Arc<std::sync::Mutex<Option<usize>>>,
    session_relics: &[String],
) {
    if let Ok(local_player) = app.state::<AppState>().local_player_name.lock() {
        if let Some(name) = local_player.as_ref() {
            if let Ok(mut names) = squad_names.lock() {
                if !names.iter().any(|existing| existing == name) {
                    names.push(name.clone());
                }
            }
        }
    }
    let relic_hint = session_relics.len().min(4);
    if relic_hint >= 1 {
        if let Ok(mut hint) = squad_size.lock() {
            if hint.is_none() {
                *hint = Some(relic_hint);
            }
        }
    }
}

/// Give the VoidProjections sequence a short window to provide an OCR card-count hint.
pub(crate) async fn wait_for_squad_hint(
    squad_size: &std::sync::Arc<std::sync::Mutex<Option<usize>>>,
) {
    let deadline = std::time::Instant::now() + std::time::Duration::from_millis(1500);
    while std::time::Instant::now() < deadline {
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        if squad_size.lock().ok().is_some_and(|hint| hint.is_some()) {
            break;
        }
    }
}

/// Capture the reward area and run OCR after reading the latest EE.log hints.
pub(crate) async fn capture_reward_items(
    catalog: std::sync::Arc<Vec<(String, String)>>,
    squad_size: std::sync::Arc<std::sync::Mutex<Option<usize>>>,
    squad_names: std::sync::Arc<std::sync::Mutex<Vec<String>>>,
) -> Option<RewardOcrResult> {
    tauri::async_runtime::spawn_blocking(move || {
        let (pixels, width, capture_height, game_height, capture_info) =
            crate::ocr::capture_warframe_reward_area()?;
        let hint_squad_size = squad_size.lock().ok().and_then(|hint| *hint);
        let player_names = squad_names
            .lock()
            .map(|names| names.clone())
            .unwrap_or_default();
        Some(ocr::extract_reward_items_twophase(OcrParams {
            pixels: &pixels,
            pix_w: width,
            pix_h: capture_height,
            game_h: game_height,
            catalog: &catalog,
            capture_info: &capture_info,
            hint_squad_size,
            player_names: &player_names,
        }))
    })
    .await
    .ok()
    .flatten()
}

/// Schedule the final cleanup when the normal EE.log dismissal never arrives.
pub(crate) fn schedule_reward_safety_cleanup(
    app: tauri::AppHandle,
    screen_active: std::sync::Arc<std::sync::atomic::AtomicBool>,
) {
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_secs(20)).await;
        // The screen normally closes through EE.log well before this; then the
        // hide below only repeats what the close already did.
        let still_open = screen_active.load(Ordering::SeqCst);
        if let Ok(mut rewards) = app.state::<AppState>().pending_relic_rewards.lock() {
            *rewards = None;
        }
        let _ = app.emit(events::RELIC_REWARDS, serde_json::Value::Null);
        if let Some(window) = app.get_webview_window("relic-overlay") {
            let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                x: 0,
                y: -3000,
            }));
        }
        if still_open {
            hexdesk_diag::info!(
                overlay,
                reason = "no close line in EE.log within 20 s of opening",
                "Relic reward overlay hidden"
            );
        }
    });
}

/// Store the payload for a late overlay mount, then notify the frontend.
pub(crate) fn publish_relic_rewards(app: &tauri::AppHandle, payload: Option<&serde_json::Value>) {
    if payload.is_some_and(|payload| !payload.is_null())
        && !app
            .state::<AppState>()
            .overlays_enabled
            .load(Ordering::SeqCst)
    {
        return;
    }
    if let Some(payload) = payload.filter(|payload| !payload.is_null()) {
        if let Ok(mut pending) = app.state::<AppState>().pending_relic_rewards.lock() {
            *pending = Some(payload.clone());
        }
    }
    let _ = app.emit(events::RELIC_REWARDS, payload);
}

/// Emit the best partial result after OCR timed out and hide the overlay.
pub(crate) fn finalize_reward_ocr_timeout(
    app: &tauri::AppHandle,
    best_payload: Option<serde_json::Value>,
    active: &std::sync::atomic::AtomicBool,
) {
    let emit_val = if active.load(Ordering::SeqCst) {
        best_payload.unwrap_or(serde_json::Value::Null)
    } else {
        serde_json::Value::Null
    };
    publish_relic_rewards(app, Some(&emit_val));
    if let Some(win) = app.get_webview_window("relic-overlay") {
        let _ = win.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
            x: 0,
            y: -3000,
        }));
    }
    active.store(false, Ordering::SeqCst);
}

// ── OCR retry-loop helpers ────────────────────────────────────────────────────

/// A dark frame: show it in the status line, retry soon. Returns the wait in ms.
pub(crate) fn retry_after_dark_frame(app: &tauri::AppHandle, dbg: &str) -> u64 {
    let _ = app.emit(events::STATUS_LINE, format!("⬛ {}", dbg));
    100
}

/// No text read: show it in the status line, retry. Returns the wait in ms.
pub(crate) fn retry_after_ocr_empty(app: &tauri::AppHandle, dbg: &str) -> u64 {
    let _ = app.emit(events::STATUS_LINE, format!("⬜ {}", dbg));
    300
}

/// The game window was not captured: retry. Returns the wait in ms.
pub(crate) fn retry_after_capture_failed(app: &tauri::AppHandle) -> u64 {
    let _ = app.emit(events::STATUS_LINE, "⚠️ Capture failed");
    500
}

/// Text read but no reward matched. After three misses in a row the catalogue
/// widens from this session's relics to every reward. Returns the wait in ms.
pub(crate) fn retry_after_no_match(
    app: &tauri::AppHandle,
    no_match_streak: &mut u32,
    cat: &mut std::sync::Arc<Vec<(String, String)>>,
    fallback_cat: &std::sync::Arc<Vec<(String, String)>>,
) -> u64 {
    *no_match_streak += 1;
    if *no_match_streak == 3 && cat.len() < fallback_cat.len() {
        *cat = std::sync::Arc::clone(fallback_cat);
        hexdesk_diag::info!(
            overlay,
            catalog = cat.len(),
            "Reward catalogue widened to every reward after 3 reads without a match"
        );
    }
    let _ = app.emit(events::STATUS_LINE, "❌ No catalog match, retrying...");
    700
}

// ── WFM whisper parsing ──────────────────────────────────────────────────────

pub(crate) fn parse_and_emit_wfm_whisper(app: &tauri::AppHandle, log_line: &str) {
    let raw = log_line;
    let from = raw
        .find("@From ")
        .map(|i| &raw[i + 6..])
        .and_then(|s| s.split(" :").next())
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| "Unknown".to_string());
    let item = {
        let prefix = "want to buy ";
        let suffix = " for ";
        raw.find(prefix).and_then(|i| {
            let rest = &raw[i + prefix.len()..];
            rest.find(suffix)
                .map(|j| crate::sanitize_chat_item_name(&rest[..j]))
        })
    };
    let price: Option<u64> = raw.find(" for ").and_then(|i| {
        let rest = &raw[i + 5..];
        rest.find(" platinum")
            .and_then(|j| rest[..j].trim().parse().ok())
    });
    let _ = app.emit(
        events::WFM_WHISPER,
        serde_json::json!({
            "from": from,
            "message": raw.trim(),
            "item": item,
            "price": price,
            "timestamp": chrono::Local::now().format("%H:%M:%S").to_string(),
        }),
    );
}

#[cfg(test)]
mod relic_pick_tests {
    use super::*;

    // Line text as EE.log writes it, with \r\n line ends.
    const OPEN: &str = "28.945 Script [Info]: ThemedProjectionManager.lua: PopulateInventoryGrid\r";
    const OPEN_END: &str =
        "29.012 Script [Info]: ThemedProjectionManager.lua: PopulateInventoryGridEnd\r";
    const MAPREDUX: &str = "56.340 Input [Info]: Subscribing for /Lotus/Interface/MapRedux.swf with input filter /EE/Types/Input/MapReduxInputFilter\r";
    const ENTITLEMENT: &str = "34.241 Sys [Info]: OnEntitlementServiceComplete false:\r";
    const LEVEL_LOAD: &str =
        "320.4 Net [Info]: GameRulesImpl - changing state from SS_INVALID to SS_WAITING_TO_START\r";

    fn signals_text(lines: &[&str]) -> String {
        lines.join("\n").to_lowercase()
    }

    fn signals(lines: &[&str]) -> Vec<RelicPickSignal> {
        relic_pick_signals(&signals_text(lines))
    }

    #[test]
    fn the_log_start_and_line_times_are_read() {
        let head = "0.095 Sys [Diag]: Current time: Thu Nov 19 23:44:03 2026 [UTC: Thu Nov 19 22:44:03 2026]\r\n";
        assert_eq!(
            parse_ee_log_start(head).map(|t| t.to_string()),
            Some("2026-11-19 23:44:03".to_string())
        );
        let later = "2185.901 Script [Info]: ThemedProjectionManager.lua: PopulateInventoryGrid\r";
        assert_eq!(
            last_open_seconds(&signals_text(&[OPEN, MAPREDUX, later])),
            Some(2185.901)
        );
    }

    #[test]
    fn signals_keep_the_order_of_the_log() {
        assert_eq!(
            signals(&[MAPREDUX, OPEN]),
            vec![RelicPickSignal::Close("mapredux"), RelicPickSignal::Open]
        );
        assert_eq!(
            signals(&[OPEN, MAPREDUX]),
            vec![RelicPickSignal::Open, RelicPickSignal::Close("mapredux")]
        );
    }

    #[test]
    fn a_read_ending_on_an_open_screen_opens_it() {
        // EE.log from one late write: two screens backed out of, a third still open.
        let read = relic_pick_read(&signals(&[OPEN, MAPREDUX, OPEN, MAPREDUX, OPEN]));
        assert_eq!(
            read,
            RelicPickRead {
                close: Some("mapredux"),
                closed_opens: 2,
                open: true
            }
        );
    }

    #[test]
    fn a_read_ending_on_a_close_opens_nothing() {
        let read = relic_pick_read(&signals(&[OPEN, MAPREDUX]));
        assert_eq!(
            read,
            RelicPickRead {
                close: Some("mapredux"),
                closed_opens: 1,
                open: false
            }
        );
    }

    #[test]
    fn one_selection_screen_is_one_open() {
        assert_eq!(signals(&[OPEN, OPEN_END]), vec![RelicPickSignal::Open]);
    }

    #[test]
    fn the_entitlement_line_does_not_close_an_open_selection() {
        // The game writes it while the selection screen is still open.
        assert_eq!(signals(&[OPEN, ENTITLEMENT]), vec![RelicPickSignal::Open]);
    }

    #[test]
    fn a_level_load_closes_the_selection() {
        assert_eq!(
            signals(&[LEVEL_LOAD]),
            vec![RelicPickSignal::Close("GameRulesImpl state change")]
        );
    }

    #[test]
    fn other_star_chart_input_lines_are_not_a_close() {
        let other =
            "7.179 Input [Info]: Subscribing for /Lotus/Interface/Progress.swf with input filter /Lotus/Interface/ProgressInputFilter";
        assert!(signals(&[other, "budget overrun retiring read of solarmapredux"]).is_empty());
    }

    #[test]
    fn a_close_before_the_open_leaves_the_selection_open() {
        let counter = AtomicU64::new(0);
        assert!(!end_relic_pick(&counter, None), "nothing is open yet");
        let session = begin_relic_pick(&counter);
        assert_eq!(counter.load(Ordering::SeqCst), session);
    }

    #[test]
    fn a_close_after_the_open_stops_its_pending_steps() {
        let counter = AtomicU64::new(0);
        let session = begin_relic_pick(&counter);
        assert!(end_relic_pick(&counter, None));
        assert_ne!(counter.load(Ordering::SeqCst), session);
        assert!(
            !end_relic_pick(&counter, Some(session)),
            "the timeout of a closed selection does nothing"
        );
        assert!(!end_relic_pick(&counter, None), "already closed");
    }

    #[test]
    fn a_new_open_replaces_one_that_never_closed() {
        let counter = AtomicU64::new(0);
        let first = begin_relic_pick(&counter);
        let second = begin_relic_pick(&counter);
        assert_ne!(first, second);
        assert_eq!(second % 2, 1, "the new selection is open");
        assert!(!end_relic_pick(&counter, Some(first)));
        assert!(end_relic_pick(&counter, Some(second)));
    }
}

#[cfg(test)]
mod trade_dialog_tests {
    use super::*;

    /// Real (player-redacted) dialog text captured from EE.log for a trade where
    /// the local player sold 4 Sevagoth Prime blueprints for 33 platinum. The
    /// player name is followed by a private-use-area glyph (U+E000) with no
    /// preceding space, and item lines are prefixed with a bare '\r'.
    /// Regression coverage for the "trades not detected" report (2026-09-28):
    /// the backend-modularization refactor (eaaaa42) accidentally turned the
    /// single-stage `received_raw` extraction into a two-stage one that
    /// re-searched the already-stripped substring for "the following:" — a
    /// string that, by construction, could never be found there again, so
    /// every trade's received side (items and/or platinum) silently vanished.
    #[test]
    fn trade_sale_for_platinum_extracts_received_plat_and_offered_items() {
        let raw = "1037.335 Script [Info]: Dialog.lua: Dialog::CreateOkCancel(description=Are you sure you want to accept this trade? You are offering:\n\rSevagoth Prime Chassis Blueprint\n\rSevagoth Prime Neuroptics Blueprint\n\rSevagoth Prime Systems Blueprint\n\rSevagoth Prime Blueprint\r\n\r\nand will receive from Winter.Mine\u{E000} the following:\n\rPlatinum x 33, title= leftItem=/Menu/Confirm_Item_Ok, rightItem=/Menu/Confirm_Item_Cancel)\n";

        let parsed = parse_trade_dialog(raw).expect("dialog should parse");
        assert_eq!(
            parsed.with_player, "Winter.Mine",
            "trailing PUA glyph should be stripped from the player name"
        );
        assert_eq!(parsed.trade_type, "sale");
        assert_eq!(
            parsed.received_plat, 33,
            "platinum received must survive the received_raw extraction"
        );
        assert_eq!(parsed.offered_plat, 0);
        assert!(parsed.received_items.is_empty());
        assert_eq!(
            parsed.offered_items,
            vec![
                ("Sevagoth Prime Chassis Blueprint".to_string(), 1),
                ("Sevagoth Prime Neuroptics Blueprint".to_string(), 1),
                ("Sevagoth Prime Systems Blueprint".to_string(), 1),
                ("Sevagoth Prime Blueprint".to_string(), 1),
            ]
        );
    }

    /// A purchase (offering platinum, receiving an item) must also keep its
    /// received side — this was silently empty under the same bug, which meant
    /// `useOverlays.ts`'s `tradeType === "purchase"` branch had nothing to log.
    #[test]
    fn trade_purchase_extracts_received_items() {
        let raw = "Dialog::CreateOkCancel(description=Are you sure you want to accept this trade? You are offering:\r\nPlatinum x 20\r\n\r\nand will receive from Buyer123 the following:\r\nAyatan Anasa Sculpture, title= leftItem=/Menu/Confirm_Item_Ok, rightItem=/Menu/Confirm_Item_Cancel)";

        let parsed = parse_trade_dialog(raw).expect("dialog should parse");
        assert_eq!(parsed.trade_type, "purchase");
        assert_eq!(parsed.offered_plat, 20);
        assert_eq!(
            parsed.received_items,
            vec![("Ayatan Anasa Sculpture".to_string(), 1)]
        );
    }

    #[test]
    fn trade_completion_reassembles_split_log_reads() {
        let chunks = [
            "unrelated log text\nDialog::CreateOkCan",
            "cel(description=Are you sure? You are off",
            "ering:\r\nSaryn Prime Chassis Blueprint\r\n\r\nand will receive from Buyer123 the follow",
            "ing:\r\nPlatinum x 15, title= leftItem=/Menu/Confirm_Item_Ok)\nThe trade was succ",
            "essful\n",
        ];
        let mut trade_buffer = String::new();
        let mut result = None;

        for chunk in chunks {
            let (_, parsed) = collect_trade_completion(chunk, &mut trade_buffer);
            if parsed.is_some() {
                result = parsed;
            }
        }

        let parsed = result.expect("split dialog and completion should be reconstructed");
        assert_eq!(parsed.with_player, "Buyer123");
        assert_eq!(parsed.trade_type, "sale");
        assert_eq!(parsed.received_plat, 15);
        assert_eq!(
            parsed.offered_items,
            vec![("Saryn Prime Chassis Blueprint".to_string(), 1)]
        );
        assert!(trade_buffer.is_empty());
    }
}
