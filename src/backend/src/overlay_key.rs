//! The overlay key. It hides whatever overlay is on screen, or, with none on
//! screen, reads the game's screen title and opens the overlay for that
//! screen. A low-level keyboard hook only watches the key and passes it on,
//! so the game still receives it.

use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{mpsc, Mutex, Once, OnceLock};
use std::time::Duration;

use chrono::{DateTime, Local};

use tauri::{Emitter, Manager};
use windows_sys::Win32::Foundation::{LPARAM, LRESULT, WPARAM};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, GetMessageW, SetWindowsHookExW, HC_ACTION, KBDLLHOOKSTRUCT, MSG,
    WH_KEYBOARD_LL, WM_KEYDOWN, WM_SYSKEYDOWN,
};

use crate::app_state::AppState;
use crate::events;
use crate::log_watcher::{end_relic_pick, start_relic_pick};
use crate::relic_pick::relic_pick_hide;

/// Values of `AppState::reward_key_request`.
pub(crate) const REWARD_KEY_NONE: u8 = 0;
pub(crate) const REWARD_KEY_OPEN: u8 = 1;
pub(crate) const REWARD_KEY_CLOSE: u8 = 2;

/// When an EE.log line has no usable time, how long after the key showed or
/// hid the Relic Pick overlay EE.log may not open it. The game writes EE.log
/// to disk up to about 30 s late.
const KEY_OVERRIDES_LOG: Duration = Duration::from_secs(40);

/// Virtual-key code of the key; 0 means no key.
static KEY: AtomicU32 = AtomicU32::new(0);
/// Hands key presses from the hook to a normal thread, because Windows drops
/// a low-level hook whose callback takes too long.
static PRESSED: OnceLock<mpsc::Sender<()>> = OnceLock::new();
static HOOK: Once = Once::new();
static LAST_PICK_USE: Mutex<Option<DateTime<Local>>> = Mutex::new(None);
/// Save the screen title capture on every key press (activity console).
static CAPTURE: AtomicBool = AtomicBool::new(false);

/// A game screen that has an overlay.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum GameScreen {
    /// "VOID FISSURE/SELECT RELIC" or "VOID RELICS/REFINEMENT": a list of
    /// relics of one era.
    RelicSelection,
    /// "VOID FISSURE/REWARDS"
    RelicRewards,
    /// "INVENTORY/MODS", where a riven card is shown.
    Mods,
}

/// The screen a title read from the top-left corner belongs to. The game
/// spaces the title out letter by letter and OCR spacing varies, so only the
/// letters are compared.
pub(crate) fn screen_from_title(title: &str) -> Option<GameScreen> {
    let letters: String = title
        .chars()
        .filter_map(|c| match c.to_ascii_uppercase() {
            '0' => Some('O'),
            c if c.is_ascii_alphabetic() => Some(c),
            _ => None,
        })
        .collect();
    let has = |word: &str| letters.contains(word);
    // "REFINE" rather than "REFINEMENT": OCR often garbles the word's end.
    // The era line under the title ("NEO ERA COLLECTED 6/196 RADIANT 0/196")
    // is only on the relic lists, and OCR reads it when it misses the title.
    if (has("RELIC") && (has("SELECT") || has("REFINE")))
        || (has("ERA") && has("COLLECTED") && has("RADIANT"))
    {
        Some(GameScreen::RelicSelection)
    } else if has("FISSURE") && has("REWARD") {
        Some(GameScreen::RelicRewards)
    } else if has("INVENTORY") && has("MODS") {
        Some(GameScreen::Mods)
    } else {
        None
    }
}

/// Whether a key press with virtual-key code `vk` is the key `configured`.
pub(crate) fn is_overlay_key(vk: u32, configured: u32) -> bool {
    configured != 0 && vk == configured
}

/// Whether the key showed or hid the Relic Pick overlay after the game wrote
/// an EE.log line at `line_time`, so the line describes a screen the player
/// already handled with the key.
pub(crate) fn key_used_after(line_time: Option<DateTime<Local>>) -> bool {
    let last = *LAST_PICK_USE.lock().unwrap_or_else(|e| e.into_inner());
    key_overrides(last, line_time, Local::now())
}

/// `key_used_after` with the times passed in. Without a line time, a key
/// press within `KEY_OVERRIDES_LOG` counts.
pub(crate) fn key_overrides(
    key: Option<DateTime<Local>>,
    line: Option<DateTime<Local>>,
    now: DateTime<Local>,
) -> bool {
    let Some(key) = key else {
        return false;
    };
    match line {
        Some(line) => key > line,
        None => (now - key).to_std().is_ok_and(|d| d < KEY_OVERRIDES_LOG),
    }
}

fn mark_pick_use() {
    *LAST_PICK_USE.lock().unwrap_or_else(|e| e.into_inner()) = Some(Local::now());
}

/// Sets the overlay key (a Windows virtual-key code, 0 for none). The
/// keyboard hook starts with the first key that is set and keeps running
/// after that.
#[tauri::command]
pub(crate) fn set_overlay_key(app: tauri::AppHandle, vk: u32) {
    KEY.store(vk, Ordering::SeqCst);
    hexdesk_diag::debug!(overlay, vk, "Overlay key set");
    if vk != 0 {
        HOOK.call_once(|| start_hook(app));
    }
}

/// Turns saving the screen title capture on each key press on or off.
#[tauri::command]
pub(crate) fn set_overlay_key_capture(enabled: bool) {
    CAPTURE.store(enabled, Ordering::SeqCst);
}

fn start_hook(app: tauri::AppHandle) {
    let (sender, presses) = mpsc::channel();
    let _ = PRESSED.set(sender);
    std::thread::spawn(move || {
        for (n, ()) in (1u64..).zip(presses) {
            // Each press is its own operation, and its lines carry the press
            // number, so the log never folds two presses into one repeat.
            let press = format!("{n} since start");
            let _op = hexdesk_diag::op!(overlay, "Overlay key press").entered();
            on_key(&app, &press);
        }
    });
    std::thread::spawn(|| {
        // A low-level hook runs on the thread that installed it, and only
        // while that thread pumps messages.
        let hook = unsafe { SetWindowsHookExW(WH_KEYBOARD_LL, Some(keyboard_proc), 0, 0) };
        if hook == 0 {
            let _ = hexdesk_diag::DiagError::new(
                hexdesk_diag::Source::Overlay,
                hexdesk_diag::Kind::Internal,
                "Overlay key unavailable: the keyboard hook could not be installed",
            )
            .caused_by(&std::io::Error::last_os_error())
            .log();
            return;
        }
        let mut msg: MSG = unsafe { std::mem::zeroed() };
        while unsafe { GetMessageW(&mut msg, 0, 0, 0) } > 0 {}
    });
}

unsafe extern "system" fn keyboard_proc(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    let key_down = wparam == WM_KEYDOWN as WPARAM || wparam == WM_SYSKEYDOWN as WPARAM;
    if code == HC_ACTION as i32 && key_down {
        let info = &*(lparam as *const KBDLLHOOKSTRUCT);
        if is_overlay_key(info.vkCode, KEY.load(Ordering::Relaxed)) {
            if let Some(sender) = PRESSED.get() {
                let _ = sender.send(());
            }
        }
    }
    CallNextHookEx(0, code, wparam, lparam)
}

fn window_visible(app: &tauri::AppHandle, label: &str) -> bool {
    app.get_webview_window(label)
        .is_some_and(|w| w.is_visible().unwrap_or(false))
}

fn on_key(app: &tauri::AppHandle, press: &str) {
    let state = app.state::<AppState>();
    if !state.overlays_enabled.load(Ordering::SeqCst) {
        hexdesk_diag::info!(
            overlay,
            press,
            "Overlay key did nothing: overlays are turned off"
        );
        return;
    }
    let pick = window_visible(app, "relic-pick-overlay");
    let riven = window_visible(app, "riven-overlay");
    let reward = state.reward_overlay_active.load(Ordering::SeqCst);
    if pick || riven || reward {
        hexdesk_diag::info!(
            overlay,
            press,
            relic_pick = pick,
            riven,
            relic_reward = reward,
            "Overlay key hid the overlays on screen"
        );
        if pick {
            mark_pick_use();
            end_relic_pick(&state.relic_pick_session, None);
            relic_pick_hide(app);
            let _ = app.emit(events::RELIC_PICK_CLOSE, ());
        }
        if riven {
            let _ = app.emit(events::RIVEN_OVERLAY_HIDE, serde_json::json!({}));
        }
        if reward {
            state
                .reward_key_request
                .store(REWARD_KEY_CLOSE, Ordering::SeqCst);
        }
        return;
    }
    let read = match crate::ocr::read_screen_title(|text| screen_from_title(text).is_some()) {
        Ok(read) => read,
        Err(error) => {
            hexdesk_diag::info!(
                overlay,
                press,
                reason = %error,
                "Overlay key did nothing: the game screen could not be captured"
            );
            return;
        }
    };
    for (scale, text, recognised) in &read.attempts {
        hexdesk_diag::info!(
            overlay,
            press,
            scale = *scale,
            recognised = *recognised,
            "Overlay key title OCR at {scale}: \"{}\"",
            one_line(text)
        );
    }
    if CAPTURE.load(Ordering::SeqCst) {
        if let Some(file) = crate::captures::save("overlay-key", &read.image) {
            hexdesk_diag::info!(
                overlay,
                press,
                capture = %file,
                "Overlay key capture saved"
            );
        }
    }
    let Some(raw_title) = read.text else {
        hexdesk_diag::info!(overlay, press, "Overlay key captured no text: OCR failed");
        return;
    };
    let text = one_line(&raw_title);
    let screen = screen_from_title(&text);
    let action = match screen {
        Some(GameScreen::RelicSelection) => {
            if state.relic_pick_overlay_enabled.load(Ordering::SeqCst) {
                mark_pick_use();
                start_relic_pick(app, true);
                "Relic Pick overlay opening"
            } else {
                "none, Relic Pick overlay turned off"
            }
        }
        Some(GameScreen::RelicRewards) => {
            state
                .reward_key_request
                .store(REWARD_KEY_OPEN, Ordering::SeqCst);
            "Relic Reward overlay opening"
        }
        // The main window checks the riven setting and runs the check.
        Some(GameScreen::Mods) => {
            let _ = app.emit(events::RIVEN_SCREEN_OPEN, ());
            "riven check requested"
        }
        None => "none",
    };
    hexdesk_diag::info!(
        overlay,
        press,
        screen = screen.map_or("not recognised", GameScreen::label),
        action,
        read_at = read.scale,
        "Overlay key captured text: \"{text}\""
    );
}

impl GameScreen {
    fn label(self) -> &'static str {
        match self {
            GameScreen::RelicSelection => "relic selection or refinement",
            GameScreen::RelicRewards => "fissure rewards",
            GameScreen::Mods => "mods",
        }
    }
}

/// OCR text on one line, for the log.
fn one_line(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    const VK_HOME: u32 = 0x24;
    const VK_END: u32 = 0x23;

    #[test]
    fn only_the_configured_key_counts() {
        assert!(is_overlay_key(VK_HOME, VK_HOME));
        assert!(!is_overlay_key(VK_END, VK_HOME));
    }

    #[test]
    fn no_key_counts_when_none_is_set() {
        assert!(!is_overlay_key(0, 0));
        assert!(!is_overlay_key(VK_HOME, 0));
    }

    #[test]
    fn titles_map_to_their_screen() {
        assert_eq!(
            screen_from_title("VOID FISSURE/SELECT RELIC"),
            Some(GameScreen::RelicSelection)
        );
        assert_eq!(
            screen_from_title("VOID FISSURE/REWARDS"),
            Some(GameScreen::RelicRewards)
        );
        assert_eq!(screen_from_title("INVENTORY/MODS"), Some(GameScreen::Mods));
    }

    #[test]
    fn spaced_out_titles_with_ocr_slips_still_match() {
        assert_eq!(
            screen_from_title("V O I D  F I S S U R E / S E L E C T  R E L I C"),
            Some(GameScreen::RelicSelection)
        );
        assert_eq!(
            screen_from_title("V0ID FISSURE / REWARDS"),
            Some(GameScreen::RelicRewards)
        );
        assert_eq!(
            screen_from_title("I N V E N T 0 R Y / M O D S"),
            Some(GameScreen::Mods)
        );
    }

    #[test]
    fn the_refinement_screen_opens_relic_pick() {
        // Text as OCR read it in the game, garbled end included.
        assert_eq!(
            screen_from_title("RELICS/REFINEMENT LITH ERA COLLECTED 9/202 RADIANT 1/202"),
            Some(GameScreen::RelicSelection)
        );
        assert_eq!(
            screen_from_title("LITH ERA RELICS/REFINEMEIT COLLECTED 9/202 RADIANT 1/202"),
            Some(GameScreen::RelicSelection)
        );
    }

    #[test]
    fn the_era_line_marks_a_relic_list_when_the_title_is_missed() {
        // Text as OCR read it in the game, title missing at every size.
        assert_eq!(
            screen_from_title("evil o NEO ERA ECOLLECTED 6/196 RADIANT 0/196"),
            Some(GameScreen::RelicSelection)
        );
    }

    #[test]
    fn a_log_line_written_before_the_key_press_is_overridden() {
        let now = Local::now();
        let t = |s: i64| now + chrono::Duration::seconds(s);
        assert!(key_overrides(Some(t(-10)), Some(t(-20)), now));
        assert!(!key_overrides(Some(t(-10)), Some(t(-5)), now));
        assert!(!key_overrides(None, Some(t(-5)), now));
    }

    #[test]
    fn without_a_line_time_a_recent_key_press_overrides() {
        let now = Local::now();
        let t = |s: i64| now + chrono::Duration::seconds(s);
        assert!(key_overrides(Some(t(-10)), None, now));
        assert!(!key_overrides(Some(t(-60)), None, now));
    }

    #[test]
    fn other_screens_have_no_overlay() {
        assert_eq!(screen_from_title("INVENTORY/ARCANES"), None);
        assert_eq!(screen_from_title(""), None);
    }
}
