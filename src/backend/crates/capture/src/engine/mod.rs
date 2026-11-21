//! OCR engines.

mod ocrs;
#[cfg(windows)]
mod windows;

use std::path::PathBuf;

use crate::text::TextRead;

/// Why an engine read nothing.
#[derive(Debug)]
pub(crate) enum EngineError {
    /// The engine is not available, such as Windows OCR without an
    /// installed language pack.
    NoEngine,
    /// The engine failed; says at which step and why.
    Failed(String),
}

impl std::fmt::Display for EngineError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EngineError::NoEngine => f.write_str("no OCR engine available"),
            EngineError::Failed(why) => f.write_str(why),
        }
    }
}

/// Sets the folder the ocrs models are kept in.
pub fn set_model_dir(dir: PathBuf) {
    ocrs::set_model_dir(dir);
}

/// Reads the text in a .bmp file of `width` by `height` pixels: with
/// Windows OCR where it is available, otherwise with ocrs.
pub fn recognize_bmp(bmp: &[u8], width: u32, height: u32) -> Result<TextRead, String> {
    #[cfg(windows)]
    match windows::recognize(bmp, width, height) {
        Err(EngineError::NoEngine) => {}
        other => return other.map_err(|e| e.to_string()),
    }
    ocrs::recognize(bmp, width, height).map_err(|e| e.to_string())
}

/// Language tags of the installed Windows OCR language packs; empty on other
/// platforms.
pub fn languages() -> Vec<String> {
    #[cfg(windows)]
    return windows::languages();
    #[cfg(not(windows))]
    Vec::new()
}
