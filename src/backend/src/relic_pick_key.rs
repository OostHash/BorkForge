//! The show/hide key of the Relic Pick overlay. A low-level keyboard hook only
//! watches the key and passes it on, so the game still receives it.

use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{mpsc, Mutex, Once, OnceLock};
use std::time::{Duration, Instant};

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

/// How long after a key press EE.log may not open the overlay. The game
/// writes EE.log to disk up to about 30 s late, so a selection line arriving
/// in this window can be the screen the player already handled with the key.
const KEY_OVERRIDES_LOG: Duration = Duration::from_secs(40);

/// Virtual-key code of the key; 0 means no key.
static KEY: AtomicU32 = AtomicU32::new(0);
/// Hands key presses from the hook to a normal thread, because Windows drops
/// a low-level hook whose callback takes too long.
static PRESSED: OnceLock<mpsc::Sender<()>> = OnceLock::new();
static HOOK: Once = Once::new();
static LAST_USED: Mutex<Option<Instant>> = Mutex::new(None);

/// Whether a key press with virtual-key code `vk` is the key `configured`.
pub(crate) fn is_pick_key(vk: u32, configured: u32) -> bool {
    configured != 0 && vk == configured
}

/// Whether the key showed or hid the overlay recently enough that EE.log
/// lines may still be about that same screen.
pub(crate) fn key_used_recently() -> bool {
    LAST_USED
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .is_some_and(|t| t.elapsed() < KEY_OVERRIDES_LOG)
}

/// Sets the show/hide key (a Windows virtual-key code, 0 for none). The
/// keyboard hook starts with the first key that is set and keeps running
/// after that.
#[tauri::command]
pub(crate) fn set_relic_pick_key(app: tauri::AppHandle, vk: u32) {
    KEY.store(vk, Ordering::SeqCst);
    hexdesk_diag::debug!(overlay, vk, "Relic Pick show/hide key set");
    if vk != 0 {
        HOOK.call_once(|| start_hook(app));
    }
}

fn start_hook(app: tauri::AppHandle) {
    let (sender, presses) = mpsc::channel();
    let _ = PRESSED.set(sender);
    std::thread::spawn(move || {
        for () in presses {
            toggle_from_key(&app);
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
                "Relic Pick show/hide key unavailable: the keyboard hook could not be installed",
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
        if is_pick_key(info.vkCode, KEY.load(Ordering::Relaxed)) {
            if let Some(sender) = PRESSED.get() {
                let _ = sender.send(());
            }
        }
    }
    CallNextHookEx(0, code, wparam, lparam)
}

/// Hides the overlay when it is on screen, and otherwise reads the relic
/// selection screen and shows the overlay for it.
fn toggle_from_key(app: &tauri::AppHandle) {
    let state = app.state::<AppState>();
    if !state.overlays_enabled.load(Ordering::SeqCst)
        || !state.relic_pick_overlay_enabled.load(Ordering::SeqCst)
    {
        return;
    }
    let Some(win) = app.get_webview_window("relic-pick-overlay") else {
        return;
    };
    *LAST_USED.lock().unwrap_or_else(|e| e.into_inner()) = Some(Instant::now());
    if win.is_visible().unwrap_or(false) {
        end_relic_pick(&state.relic_pick_session, None);
        hexdesk_diag::info!(overlay, "Relic Pick overlay closing: show/hide key pressed");
        relic_pick_hide(app);
        let _ = app.emit(events::RELIC_PICK_CLOSE, ());
    } else {
        hexdesk_diag::info!(
            overlay,
            "Relic Pick overlay requested: show/hide key pressed"
        );
        start_relic_pick(app);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const VK_HOME: u32 = 0x24;
    const VK_END: u32 = 0x23;

    #[test]
    fn only_the_configured_key_counts() {
        assert!(is_pick_key(VK_HOME, VK_HOME));
        assert!(!is_pick_key(VK_END, VK_HOME));
    }

    #[test]
    fn no_key_counts_when_none_is_set() {
        assert!(!is_pick_key(0, 0));
        assert!(!is_pick_key(VK_HOME, 0));
    }
}
