//! Reading a relic list for the Relic Pick overlay: its era and its relic
//! tiles from the screen, then the relics of that era from the inventory and
//! the catalogue, corrected by what the tiles show.

use std::time::{Duration, Instant};

use hexdesk_overlays::read::era_of_list;
use hexdesk_overlays::read::relic_list::{read_relic_list, Names, RelicList};
use hexdesk_overlays::VisitId;
use tracing::Span;

use super::{is_current, send, status, Input};
use crate::ocr::ScreenRead;

/// How often the list is read before giving up, and the pause in between.
/// Inside a mission the relic list follows the extract vote about two
/// seconds after EE.log reports it, and a panel from a hovered relic can
/// still fade out over it, so the list counts once two reads in a row agree.
const READ_ATTEMPTS: u32 = 8;
const READ_RETRY: Duration = Duration::from_millis(500);
/// The pause before the first read of a screen seen in EE.log.
const RENDER_WAIT: Duration = Duration::from_millis(400);

/// What the Relic Pick overlay is sent for one visit.
pub(crate) struct PickView {
    pub era: &'static str,
    /// How many relics of that era the payload lists.
    pub relics: usize,
    /// The `relic-pick-open` payload.
    pub payload: serde_json::Value,
}

/// Reads the relic list in the background and sends [`Input::PickReady`].
pub(super) fn read(app: tauri::AppHandle, visit: VisitId, wait_for_render: bool, op: Span) {
    std::thread::spawn(move || {
        let _guard = op.enter();
        status(&app, "Reading relic list…");
        if wait_for_render {
            std::thread::sleep(RENDER_WAIT);
        }
        let started = Instant::now();
        // The latest read that named an era, and its tiles.
        let mut latest: Option<(&'static str, RelicList)> = None;
        let mut stable = false;
        for attempt in 1..=READ_ATTEMPTS {
            if attempt > 1 {
                std::thread::sleep(READ_RETRY);
            }
            if !is_current(visit) {
                hexdesk_diag::info!(
                    relic_pick,
                    visit,
                    attempt,
                    "Relic list read stopped: the visit ended"
                );
                return;
            }
            let Some((era, list)) = read_once(visit, attempt) else {
                continue;
            };
            let tiles = read_tiles(visit, era, &list, &app);
            let same = latest
                .as_ref()
                .is_some_and(|(e, t)| *e == era && t.summary() == tiles.summary());
            latest = Some((era, tiles));
            if same {
                stable = true;
                break;
            }
        }
        if latest.is_some() && !stable {
            hexdesk_diag::info!(
                relic_pick,
                visit,
                attempts = READ_ATTEMPTS,
                "Relic list not the same in two reads in a row; the last read is used"
            );
        }
        let pick = latest.map(|(era, tiles)| {
            let (payload, changes) =
                crate::relic_pick::build_relic_pick_payload(era, &app, Some(&tiles));
            for change in &changes {
                hexdesk_diag::info!(
                    relic_pick,
                    visit,
                    relic = %change.relic,
                    "Relic Pick follows the screen: {}",
                    change.change
                );
            }
            let relics = payload["relics"].as_array().map_or(0, Vec::len);
            PickView {
                era,
                relics,
                payload,
            }
        });
        hexdesk_diag::debug!(
            relic_pick,
            visit,
            read_ms = started.elapsed().as_millis() as u64,
            "Relic Pick read finished"
        );
        send(Input::PickReady { visit, pick });
    });
}

/// One read of the relic list, logged with the era line OCR returned and,
/// when captures are on, the picture and the OCR result.
fn read_once(visit: VisitId, attempt: u32) -> Option<(&'static str, ScreenRead)> {
    let list = match crate::ocr::read_relic_list() {
        Ok(list) => list,
        Err(reason) => {
            hexdesk_diag::info!(
                relic_pick,
                visit,
                attempt,
                reason = %reason,
                "Relic list could not be read"
            );
            return None;
        }
    };
    let era = era_of_list(&list.read);
    let head = list
        .read
        .lines
        .iter()
        .filter(|l| l.words.first().is_some_and(|w| w.top < 0.2))
        .map(|l| l.text.as_str())
        .collect::<Vec<_>>()
        .join(" ");
    let capture = if crate::captures::enabled() {
        crate::captures::save_read("relic-list", &list.image, &list.read)
    } else {
        None
    };
    match capture {
        Some(capture) => hexdesk_diag::info!(
            relic_pick,
            visit,
            attempt,
            era = era.unwrap_or("none"),
            capture = %capture,
            "Relic list head read: \"{head}\""
        ),
        None => hexdesk_diag::info!(
            relic_pick,
            visit,
            attempt,
            era = era.unwrap_or("none"),
            "Relic list head read: \"{head}\""
        ),
    }
    era.map(|era| (era, list))
}

/// The relic tiles on the list, logged one line for the whole list.
fn read_tiles(visit: VisitId, era: &str, list: &ScreenRead, app: &tauri::AppHandle) -> RelicList {
    let all = crate::relic_pick::era_relic_names(era, app);
    let owned = crate::relic_pick::owned_relic_names(era, app);
    let names = Names {
        owned: &owned,
        all: &all,
    };
    let reread = |part: &hexdesk_capture::Frame| {
        hexdesk_capture::recognize(part)
            .ok()
            .map(|read| read.text().split_whitespace().collect::<Vec<_>>().join(" "))
            .filter(|text| !text.trim().is_empty())
    };
    let tiles = read_relic_list(&list.read, &list.frame, &names, &reread);
    let named = tiles.tiles.iter().filter(|t| t.relic.is_some()).count();
    let faded = tiles
        .tiles
        .iter()
        .filter(|t| t.owned == Some(false))
        .count();
    let collected = tiles
        .collected
        .map_or_else(|| "not read".to_string(), |(a, b)| format!("{a}/{b}"));
    hexdesk_diag::info!(
        relic_pick,
        visit,
        tiles = tiles.tiles.len(),
        named,
        faded,
        collected = %collected,
        complete = tiles.complete,
        "Relic tiles read: {}",
        tiles.summary()
    );
    tiles
}
