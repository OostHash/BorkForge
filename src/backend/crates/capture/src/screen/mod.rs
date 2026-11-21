//! Capturing the game window.

#[cfg(windows)]
mod windows;
#[cfg(windows)]
pub use windows::{capture_game, capture_screen, Capture, Method};

#[cfg(not(windows))]
mod other;
#[cfg(not(windows))]
pub use other::{capture_game, capture_screen, Capture, Method};
