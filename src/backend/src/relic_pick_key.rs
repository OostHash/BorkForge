//! The close key of the Relic Pick overlay. A low-level keyboard hook only
//! watches the key and passes it on, so the game still receives it.

use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{mpsc, Once, OnceLock};

use tauri::{Emitter, Manager};
use windows_sys::Win32::Foundation::{LPARAM, LRESULT, WPARAM};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, GetMessageW, SetWindowsHookExW, HC_ACTION, KBDLLHOOKSTRUCT, MSG,
    WH_KEYBOARD_LL, WM_KEYDOWN, WM_SYSKEYDOWN,
};

use crate::app_state::AppState;
use crate::events;
use crate::log_watcher::end_relic_pick;
use crate::relic_pick::relic_pick_hide;

/// Virtual-key code of the close key; 0 means no close key.
static CLOSE_KEY: AtomicU32 = AtomicU32::new(0);
/// Hands key presses from the hook to a normal thread, because Windows drops
/// a low-level hook whose callback takes too long.
static PRESSED: OnceLock<mpsc::Sender<()>> = OnceLock::new();
static HOOK: Once = Once::new();

/// Whether a key press with virtual-key code `vk` is the close key `configured`.
pub(crate) fn is_close_key(vk: u32, configured: u32) -> bool {
    configured != 0 && vk == configured
}

/// Sets the close key (a Windows virtual-key code, 0 for none). The keyboard
/// hook starts with the first key that is set and keeps running after that.
#[tauri::command]
pub(crate) fn set_relic_pick_close_key(app: tauri::AppHandle, vk: u32) {
    CLOSE_KEY.store(vk, Ordering::SeqCst);
    hexdesk_diag::debug!(overlay, vk, "Relic Pick close key set");
    if vk != 0 {
        HOOK.call_once(|| start_hook(app));
    }
}

fn start_hook(app: tauri::AppHandle) {
    let (sender, presses) = mpsc::channel();
    let _ = PRESSED.set(sender);
    std::thread::spawn(move || {
        for () in presses {
            close_from_key(&app);
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
                "Relic Pick close key unavailable: the keyboard hook could not be installed",
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
        if is_close_key(info.vkCode, CLOSE_KEY.load(Ordering::Relaxed)) {
            if let Some(sender) = PRESSED.get() {
                let _ = sender.send(());
            }
        }
    }
    CallNextHookEx(0, code, wparam, lparam)
}

/// Hides the overlay when it is on screen; the key does nothing otherwise.
fn close_from_key(app: &tauri::AppHandle) {
    let Some(win) = app.get_webview_window("relic-pick-overlay") else {
        return;
    };
    if !win.is_visible().unwrap_or(false) {
        return;
    }
    end_relic_pick(&app.state::<AppState>().relic_pick_session, None);
    hexdesk_diag::info!(overlay, "Relic Pick overlay closing: close key pressed");
    relic_pick_hide(app);
    let _ = app.emit(events::RELIC_PICK_CLOSE, ());
}

#[cfg(test)]
mod tests {
    use super::*;

    const VK_HOME: u32 = 0x24;
    const VK_END: u32 = 0x23;

    #[test]
    fn only_the_configured_key_closes() {
        assert!(is_close_key(VK_HOME, VK_HOME));
        assert!(!is_close_key(VK_END, VK_HOME));
    }

    #[test]
    fn no_key_closes_when_none_is_set() {
        assert!(!is_close_key(0, 0));
        assert!(!is_close_key(VK_HOME, 0));
    }
}
