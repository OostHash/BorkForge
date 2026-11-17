//! Where HexDesk keeps its files.
//!
//! Throwaway downloads live in the cache root, settings in the config root,
//! the database and auction IDs in the data root, and logs and debug dumps in
//! the state root.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use tracing::warn;

const APP_DIR: &str = "hexdesk";

/// When set, all four roots become subdirectories of this path. Tests use it to
/// keep off the real user directories.
static ROOT_OVERRIDE: OnceLock<PathBuf> = OnceLock::new();

/// Fails if a root has already been chosen, which is why tests share one.
#[cfg(test)]
pub fn set_root_override(root: PathBuf) -> Result<(), PathBuf> {
    ROOT_OVERRIDE.set(root)
}

/// Picks the root before anything reads a path. Debug builds live entirely in
/// `.hexdesk-dev/` beside the project, so running `pnpm desktop:dev` never
/// touches the installed production files; release builds compile this body
/// away and keep using the user directories. Set `HEXDESK_ROOT` to point a
/// debug build somewhere else.
pub fn init_root() {
    #[cfg(debug_assertions)]
    {
        let root = std::env::var_os("HEXDESK_ROOT")
            .map(PathBuf::from)
            .or_else(|| {
                Path::new(env!("CARGO_MANIFEST_DIR"))
                    .parent()
                    .and_then(Path::parent)
                    .map(|workspace| workspace.join(".hexdesk-dev"))
            });
        if let Some(root) = root {
            let _ = ROOT_OVERRIDE.set(root);
        }
    }
}

/// The root in force, when there is one. Always `None` in release builds.
pub fn root() -> Option<&'static Path> {
    ROOT_OVERRIDE.get().map(PathBuf::as_path)
}

/// Where the deferred factory-reset marker lives. Dev and release share %TEMP%,
/// so a reset requested in dev must not delete production data on next launch.
pub fn factory_reset_marker() -> PathBuf {
    let name = if root().is_some() {
        "hexdesk_factory_reset_dev"
    } else {
        "hexdesk_factory_reset"
    };
    std::env::temp_dir().join(name)
}

/// Downloaded catalogues, price snapshots, item images, OCR models: anything
/// that can be fetched again.
pub fn cache_dir() -> PathBuf {
    let dir = ensure(match ROOT_OVERRIDE.get() {
        Some(root) => root.join("cache"),
        None => base(dirs::cache_dir()),
    });
    // Tells backup and sync tools to skip the directory
    // (https://bford.info/cachedir/).
    let tag = dir.join("CACHEDIR.TAG");
    if !tag.exists() {
        let _ = fs::write(
            &tag,
            "Signature: 8a477f597d28d172789f06886806bc55\n\
             # This file is a cache directory tag created by HexDesk.\n\
             # For information about cache directory tags see https://bford.info/cachedir/\n",
        );
    }
    dir
}

/// settings.json.
pub fn config_dir() -> PathBuf {
    ensure(match ROOT_OVERRIDE.get() {
        Some(root) => root.join("config"),
        None => base(dirs::config_dir()),
    })
}

/// data.db and the WFM auction IDs: user state that no refetch can rebuild.
pub fn data_dir() -> PathBuf {
    ensure(match ROOT_OVERRIDE.get() {
        Some(root) => root.join("data"),
        None => base(dirs::data_dir()),
    })
}

/// Logs, session transcripts, screenshot dumps.
#[allow(dead_code)]
pub fn state_dir() -> PathBuf {
    ensure(match ROOT_OVERRIDE.get() {
        Some(root) => root.join("state"),
        // Only Linux defines a state directory; elsewhere this material sits
        // with the rest of the app data.
        None => base(dirs::state_dir().or_else(dirs::data_dir)),
    })
}

fn base(dir: Option<PathBuf>) -> PathBuf {
    dir.unwrap_or_else(|| PathBuf::from(".")).join(APP_DIR)
}

fn ensure(dir: PathBuf) -> PathBuf {
    if let Err(e) = fs::create_dir_all(&dir) {
        warn!("cannot create {}: {e}", dir.display());
    }
    dir
}
