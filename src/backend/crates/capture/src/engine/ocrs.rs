//! ocrs, a pure-Rust OCR engine (<https://github.com/robertknight/ocrs>).
//! It runs where Windows OCR is not available: no English language pack,
//! some LTSC and managed Windows images, other platforms. Its two model
//! files (about 10 MB) are downloaded to the model folder on first use.

use std::io::Read as _;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

use ocrs::{ImageSource, OcrEngine, OcrEngineParams, TextItem};
use rten::Model;

use super::EngineError;
use crate::text::{Line, TextRead, Word};

const DETECTION_URL: &str = "https://ocrs-models.s3-accelerate.amazonaws.com/text-detection.rten";
const RECOGNITION_URL: &str =
    "https://ocrs-models.s3-accelerate.amazonaws.com/text-recognition.rten";

static MODEL_DIR: OnceLock<PathBuf> = OnceLock::new();

/// The engine once its models loaded. A failure is not kept, so the next
/// read tries again.
static ENGINE: Mutex<Option<OcrEngine>> = Mutex::new(None);

/// Sets the folder the models are kept in. Called once at startup.
pub(crate) fn set_model_dir(dir: PathBuf) {
    let _ = MODEL_DIR.set(dir);
}

/// Writes to a `.tmp` file and renames it when complete, so a cut-off
/// download is never taken for a model.
fn download(url: &str, dest: &Path) -> Result<(), String> {
    tracing::info!(url, "OCR model download started");
    let mut body = Vec::new();
    ureq::get(url)
        .call()
        .map_err(|e| format!("download {url}: {e}"))?
        .into_reader()
        .read_to_end(&mut body)
        .map_err(|e| format!("read {url}: {e}"))?;
    // The models are several MB; less is an error page.
    if body.len() < 1_000_000 {
        return Err(format!("{url} returned only {} bytes", body.len()));
    }
    let tmp = dest.with_extension("tmp");
    std::fs::write(&tmp, &body).map_err(|e| format!("write {}: {e}", tmp.display()))?;
    std::fs::rename(&tmp, dest).map_err(|e| format!("rename to {}: {e}", dest.display()))?;
    tracing::info!(url, bytes = body.len(), "OCR model downloaded");
    Ok(())
}

fn load_engine() -> Result<OcrEngine, String> {
    let dir = MODEL_DIR.get().ok_or("model folder not set")?;
    std::fs::create_dir_all(dir).map_err(|e| format!("create {}: {e}", dir.display()))?;
    let detection = dir.join("text-detection.rten");
    let recognition = dir.join("text-recognition.rten");
    for (url, path) in [(DETECTION_URL, &detection), (RECOGNITION_URL, &recognition)] {
        if !path.exists() {
            download(url, path)?;
        }
    }
    // A model that does not load is a damaged download; removing it makes
    // the next read download it again.
    let load = |path: &Path| {
        Model::load_file(path).map_err(|e| {
            let _ = std::fs::remove_file(path);
            format!("load {}: {e}", path.display())
        })
    };
    OcrEngine::new(OcrEngineParams {
        detection_model: Some(load(&detection)?),
        recognition_model: Some(load(&recognition)?),
        ..Default::default()
    })
    .map_err(|e| format!("engine set-up: {e}"))
}

/// Reads the text in a .bmp file of `width` by `height` pixels.
pub(crate) fn recognize(bmp: &[u8], width: u32, height: u32) -> Result<TextRead, EngineError> {
    let mut guard = ENGINE.lock().unwrap_or_else(|e| e.into_inner());
    if guard.is_none() {
        *guard = Some(load_engine().map_err(EngineError::Failed)?);
    }
    let Some(engine) = guard.as_ref() else {
        return Err(EngineError::NoEngine);
    };
    let failed =
        |step: &str, e: &dyn std::fmt::Display| EngineError::Failed(format!("[{step}] {e}"));
    let rgb = crate::frame::bmp_to_rgb(bmp, width, height);
    let source = ImageSource::from_bytes(&rgb, (width, height)).map_err(|e| failed("image", &e))?;
    let input = engine
        .prepare_input(source)
        .map_err(|e| failed("prepare", &e))?;
    let found = engine
        .detect_words(&input)
        .map_err(|e| failed("detect", &e))?;
    let groups = engine.find_text_lines(&input, &found);
    let recognized = engine
        .recognize_text(&input, &groups)
        .map_err(|e| failed("recognize", &e))?;

    let (w, h) = (width.max(1) as f32, height.max(1) as f32);
    let lines = recognized
        .iter()
        .flatten()
        .map(|line| {
            let words: Vec<Word> = line
                .words()
                .map(|word| {
                    let r = word.bounding_rect();
                    Word {
                        text: word.to_string(),
                        left: r.left() as f32 / w,
                        top: r.top() as f32 / h,
                        width: r.width() as f32 / w,
                        height: r.height() as f32 / h,
                    }
                })
                .collect();
            Line {
                text: line.to_string(),
                words,
            }
        })
        .filter(|line| !line.text.trim().is_empty())
        .collect();
    Ok(TextRead {
        engine: "ocrs".into(),
        width,
        height,
        lines,
    })
}
