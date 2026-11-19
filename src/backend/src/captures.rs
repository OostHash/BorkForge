//! Screen captures saved for the activity console, so a user can see what OCR
//! was given. Only the newest few are kept.

use std::path::{Path, PathBuf};

use hexdesk_diag::{DiagError, Kind, Source};

/// How many captures are kept; older ones are removed when a new one is saved.
const KEEP: usize = 20;

fn dir() -> PathBuf {
    crate::paths::state_dir().join("captures")
}

/// Whether `name` is a plain capture file name, so it cannot reach outside
/// the captures folder.
pub(crate) fn valid_name(name: &str) -> bool {
    name.ends_with(".bmp")
        && !name.starts_with('.')
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.')
}

/// Saves a .bmp capture as `<prefix>-<time>.bmp` and returns the file name,
/// or None when it could not be written (logged).
pub(crate) fn save(prefix: &str, bmp: &[u8]) -> Option<String> {
    let dir = dir();
    let name = format!(
        "{prefix}-{}.bmp",
        chrono::Local::now().format("%Y%m%d-%H%M%S-%3f")
    );
    let written = std::fs::create_dir_all(&dir).and_then(|()| std::fs::write(dir.join(&name), bmp));
    if let Err(e) = written {
        let _ = DiagError::new(
            Source::Overlay,
            Kind::Io,
            "Screen capture could not be saved",
        )
        .with("file", &name)
        .caused_by(&e)
        .log();
        return None;
    }
    prune(&dir, KEEP);
    Some(name)
}

/// Removes all but the `keep` newest captures. File names sort by time.
fn prune(dir: &Path, keep: usize) {
    let Ok(read) = std::fs::read_dir(dir) else {
        return;
    };
    let mut names: Vec<String> = read
        .filter_map(|e| e.ok()?.file_name().into_string().ok())
        .filter(|n| valid_name(n))
        .collect();
    names.sort();
    let excess = names.len().saturating_sub(keep);
    for name in names.into_iter().take(excess) {
        let _ = std::fs::remove_file(dir.join(name));
    }
}

/// A saved capture as raw .bmp bytes, for the activity console.
#[tauri::command]
pub(crate) fn get_capture(name: String) -> Result<tauri::ipc::Response, DiagError> {
    if !valid_name(&name) {
        return Err(
            DiagError::new(Source::Overlay, Kind::Invalid, "Not a capture file name")
                .with("file", &name),
        );
    }
    std::fs::read(dir().join(&name))
        .map(tauri::ipc::Response::new)
        .map_err(|e| {
            DiagError::new(Source::Overlay, Kind::NotFound, "Screen capture not found")
                .with("file", &name)
                .caused_by(&e)
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_plain_capture_names_are_valid() {
        assert!(valid_name("overlay-key-20261119-214501-123.bmp"));
        assert!(!valid_name("../logs/hexdesk.log"));
        assert!(!valid_name("..\\secret.bmp"));
        assert!(!valid_name("overlay-key.png"));
        assert!(!valid_name(".bmp"));
    }

    #[test]
    fn pruning_keeps_the_newest() {
        let dir = std::env::temp_dir().join(format!("hexdesk-captures-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        for i in 0..5 {
            std::fs::write(dir.join(format!("k-2026111{i}.bmp")), b"x").unwrap();
        }
        prune(&dir, 2);
        let mut left: Vec<String> = std::fs::read_dir(&dir)
            .unwrap()
            .map(|e| e.unwrap().file_name().into_string().unwrap())
            .collect();
        left.sort();
        assert_eq!(left, vec!["k-20261113.bmp", "k-20261114.bmp"]);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
