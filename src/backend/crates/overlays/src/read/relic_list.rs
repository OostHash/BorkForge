//! The relic tiles on a relic list (the relic selection and refinement
//! screens): which relics are shown, which the player has, and how many.
//!
//! The list is the left 60 % of the game screen. Each tile shows a relic
//! icon, its name under the icon ("Meso V13 Relic"), a refinement tag under
//! the name when it is not intact ("[Exceptional]") and a count badge in the
//! top-left corner when the player has more than one ("x4"). A relic the
//! player does not have is shown faded with an eye icon. Positions below are
//! fractions of the list picture.

use hexdesk_capture::{Frame, Rect, TextRead, Word};

/// The icon of a relic the player has is bright and detailed; a faded one
/// stays far below this brightest luminance (measured: 194 and up against
/// 148 and down, on every screen and background recorded).
const OWNED_ICON_LUMA: u8 = 170;

/// One relic tile.
#[derive(Debug, Clone, PartialEq)]
pub struct RelicTile {
    /// The name as OCR read it, without "Relic".
    pub text: String,
    /// The relic, such as "Meso V13", when the name matched one relic of
    /// the list's era.
    pub relic: Option<String>,
    /// "Intact", "Exceptional", "Flawless" or "Radiant".
    pub refinement: &'static str,
    /// Whether the player has it: the icon is not faded. None when the icon
    /// could not be measured.
    pub owned: Option<bool>,
    /// The count badge, when OCR read one.
    pub count: Option<u32>,
}

/// The tiles OCR found, left to right and top to bottom.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct RelicList {
    pub tiles: Vec<RelicTile>,
    /// "COLLECTED 9/10" over the list: relics the player has and relics the
    /// list holds.
    pub collected: Option<(u32, u32)>,
    /// Every relic the player has fits on screen, so one that was not read can
    /// be treated as an uncertain on-screen tile. True when the list holds no
    /// more relics than one screen shows, or when a faded tile is on screen:
    /// the list puts the relics the player has before the faded ones.
    pub complete: bool,
}

/// How many tiles one screen of the list shows: four rows of four, less the
/// "No Relic" tile. A list that holds more scrolls.
const TILES_ON_SCREEN: u32 = 15;

fn list_fits_on_screen(collected: Option<(u32, u32)>) -> bool {
    collected.is_some_and(|(_, total)| total <= TILES_ON_SCREEN)
}

/// The top of the list holds the title, the era line and the filters; a
/// name there is the title ("VOID FISSURE/SELECT RELIC"), not a tile.
const LIST_TOP: f32 = 0.2;

/// Names right of this can be the panel describing the selected relic.
const PANEL_LEFT: f32 = 0.75;

/// Names in one row of tiles differ in height by less than this.
const ROW_TOLERANCE: f32 = 0.03;

/// The words of each line, with a line OCR split off at "Relic" ("Meso Cl 1"
/// and "Relic" on the same height, side by side) joined back.
fn name_lines(read: &TextRead) -> Vec<Vec<&Word>> {
    let mut lines: Vec<Vec<&Word>> = read
        .lines
        .iter()
        .map(|l| l.words.iter().collect())
        .collect();
    let mut i = 0;
    while i < lines.len() {
        let has_relic = lines[i]
            .iter()
            .any(|w| w.text.eq_ignore_ascii_case("relic"));
        let tail = lines[i].last().copied();
        if let (false, Some(tail)) = (has_relic, tail) {
            let next = lines.iter().position(|other| {
                other.first().is_some_and(|w| {
                    w.text.eq_ignore_ascii_case("relic")
                        && (w.top - tail.top).abs() < 0.01
                        && (0.0..0.03).contains(&(w.left - tail.right()))
                })
            });
            if let Some(j) = next {
                let moved = std::mem::take(&mut lines[j]);
                lines[i].extend(moved);
            }
        }
        i += 1;
    }
    lines
}

impl RelicList {
    /// One line per tile, for the log: "Meso Y2 x7, Meso D9 not owned, ?
    /// "Meso" owned".
    pub fn summary(&self) -> String {
        self.tiles
            .iter()
            .map(|t| {
                let name = match &t.relic {
                    Some(relic) => relic.clone(),
                    None => format!("? \"{}\"", t.text),
                };
                let refinement = if t.refinement == "Intact" {
                    String::new()
                } else {
                    format!(" {}", t.refinement)
                };
                let state = match (t.owned, t.count) {
                    (Some(false), _) => " not owned".to_string(),
                    (Some(true), Some(n)) => format!(" x{n}"),
                    (Some(true), None) => " owned".to_string(),
                    (None, _) => " unmeasured".to_string(),
                };
                format!("{name}{refinement}{state}")
            })
            .collect::<Vec<_>>()
            .join(", ")
    }
}

/// What a name may be: `owned` are tried first (the relics the inventory
/// lists), then `all` (every relic of the era), as "Meso V13".
pub struct Names<'a> {
    pub owned: &'a [String],
    pub all: &'a [String],
}

/// Reads the relic tiles. `frame` is the picture `read` was made from.
/// `reread` reads a picture of one tile name on its own, which OCR gets
/// right more often than the same name within the whole list; it returns
/// None when it read nothing.
pub fn read_relic_list(
    read: &TextRead,
    frame: &Frame,
    names: &Names<'_>,
    reread: &dyn Fn(&Frame) -> Option<String>,
) -> RelicList {
    let words: Vec<&Word> = read.lines.iter().flat_map(|l| &l.words).collect();
    let mut tiles: Vec<(f32, f32, RelicTile)> = Vec::new();
    for line in &name_lines(read) {
        let Some(relic_at) = line
            .iter()
            .position(|w| w.text.eq_ignore_ascii_case("relic"))
        else {
            continue;
        };
        let name_words = &line[..relic_at];
        let Some(first) = name_words.first() else {
            continue;
        };
        if first.text.eq_ignore_ascii_case("no") || first.top < LIST_TOP {
            continue;
        }
        let last = &line[relic_at];
        let center = (first.left + last.right()) / 2.0;
        let tags = &line[relic_at + 1..];
        // The panel describing the selected relic heads its name with a dash:
        // "Meso Y2 Relic - Possible Rewards".
        if tags.iter().any(|w| w.text.starts_with(['-', '–'])) {
            continue;
        }
        let top = first.top;
        let text = name_words
            .iter()
            .map(|w| w.text.as_str())
            .collect::<Vec<_>>()
            .join(" ");
        let refinement = refinement_in(tags.iter().copied())
            .or_else(|| refinement_below(&words, center, top))
            .unwrap_or("Intact");
        let count = count_badge(&words, center, top);
        // A name is tried against the relics the player has before every
        // relic of the era, and read again on its own when the list read
        // did not name one of those: "Meso VI" for V13 fits V1 among all
        // relics, but none the player has.
        let name_area = Rect::new(
            center - 0.075,
            center + 0.075,
            top - 0.008,
            top + first.height + 0.008,
        );
        let mut again: Option<Option<String>> = None;
        let mut read_again = || {
            again
                .get_or_insert_with(|| {
                    frame
                        .crop(name_area)
                        .ok()
                        .and_then(|part| reread(&part.upscale_2x().inverted()))
                        .map(|t| strip_relic_word(&t))
                })
                .clone()
        };
        let icon = Rect::new(center - 0.04, center + 0.04, top - 0.11, top - 0.03);
        let owned = frame.max_luma(icon).map(|luma| luma >= OWNED_ICON_LUMA);
        let mut text = text;
        // A faded tile is a relic the player does not have, so the relics
        // they have are no candidates for it.
        let faded = owned == Some(false);
        let mut relic = if faded {
            None
        } else {
            identify(&text, names.owned)
        };
        if relic.is_none() && !faded {
            if let Some(t) = read_again() {
                relic = identify(&t, names.owned);
                if relic.is_some() {
                    text = t;
                }
            }
        }
        if relic.is_none() {
            relic = identify(&text, names.all);
        }
        if relic.is_none() {
            if let Some(t) = read_again() {
                relic = identify(&t, names.all);
                if relic.is_some() {
                    text = t;
                }
            }
        }
        tiles.push((
            top,
            center,
            RelicTile {
                relic,
                text,
                refinement,
                owned,
                count,
            },
        ));
    }
    // Rows are about 0.18 apart; names on one row differ in height by a
    // line at most.
    tiles.sort_by(|a, b| {
        ((a.0 / 0.09).round(), a.1)
            .partial_cmp(&((b.0 / 0.09).round(), b.1))
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    // The panel describing the selected relic sits right of the list; its
    // name ("Meso D8 Relic [Excep", cut off at the edge of the picture) is
    // alone at its height, while tile names share their row.
    let alone_on_the_right = |i: usize| {
        let (top, center, _) = &tiles[i];
        *center > PANEL_LEFT
            && !tiles
                .iter()
                .enumerate()
                .any(|(j, (t, _, _))| j != i && (t - top).abs() < ROW_TOLERANCE)
    };
    let keep: Vec<bool> = (0..tiles.len()).map(|i| !alone_on_the_right(i)).collect();
    let tiles: Vec<RelicTile> = tiles
        .into_iter()
        .zip(keep)
        .filter(|(_, keep)| *keep)
        .map(|((_, _, t), _)| t)
        .collect();
    let collected = collected_in(read);
    // Whether every tile fits is a property of the list, not of OCR. A missed
    // tile must keep the list complete while remaining an uncertainty for the
    // payload builder; otherwise stale inventory relics look confirmed.
    let all_on_screen = list_fits_on_screen(collected);
    let complete = all_on_screen || tiles.iter().any(|t| t.owned == Some(false));
    RelicList {
        tiles,
        collected,
        complete,
    }
}

/// A tile name read on its own, without "Relic" and anything after it.
fn strip_relic_word(text: &str) -> String {
    text.split_whitespace()
        .take_while(|w| !w.eq_ignore_ascii_case("relic"))
        .collect::<Vec<_>>()
        .join(" ")
}

/// "COLLECTED 9/10" in the top of the list. OCR garbles the word
/// ("COW-ECTED"), so the first "a/b" there is taken.
fn collected_in(read: &TextRead) -> Option<(u32, u32)> {
    read.lines
        .iter()
        .filter(|l| l.words.first().is_some_and(|w| w.top < LIST_TOP))
        .flat_map(|l| &l.words)
        .find_map(|w| {
            let (a, b) = w.text.split_once('/')?;
            Some((a.parse().ok()?, b.parse().ok()?))
        })
}

const REFINEMENTS: [&str; 3] = ["Exceptional", "Flawless", "Radiant"];

fn refinement_in<'a>(words: impl Iterator<Item = &'a Word>) -> Option<&'static str> {
    let text: String = words.map(|w| w.text.to_lowercase()).collect();
    REFINEMENTS
        .into_iter()
        .find(|r| text.contains(&r.to_lowercase()))
}

/// A refinement tag on the line under a tile's name.
fn refinement_below(words: &[&Word], center: f32, top: f32) -> Option<&'static str> {
    refinement_in(words.iter().copied().filter(|w| {
        let dy = w.top - top;
        dy > 0.0 && dy < 0.04 && (w.center_x() - center).abs() < 0.08
    }))
}

/// The count badge in the tile's top-left corner: "x4".
fn count_badge(words: &[&Word], center: f32, top: f32) -> Option<u32> {
    words.iter().find_map(|w| {
        let x = w.center_x();
        let y = w.center_y();
        let in_corner =
            (center - 0.10..center - 0.02).contains(&x) && (top - 0.17..top - 0.09).contains(&y);
        if !in_corner {
            return None;
        }
        let digits = w.text.strip_prefix(['x', 'X', '×'])?;
        digits.parse().ok()
    })
}

/// The relic a tile name names: the era word and the code ("V13") are
/// compared with tolerance for letters OCR confuses, and in a code of three
/// or more one letter after the first may differ. A code of another length does not fit: OCR drops whole
/// letters too ("Neo 1" for "Neo T11"), and a shorter code fits too many
/// relics. None when no relic or more than one fits equally well.
pub fn identify(text: &str, relics: &[String]) -> Option<String> {
    let mut parts = text.split_whitespace();
    let era = parts.next()?;
    let code: String = parts
        .collect::<String>()
        .replace("\\./", "V")
        .replace("\\/", "V")
        .to_uppercase();
    if code.is_empty() {
        return None;
    }
    let mut best: Option<(usize, &String)> = None;
    let mut tie = false;
    for relic in relics {
        let mut rp = relic.split_whitespace();
        let (Some(r_era), Some(r_code)) = (rp.next(), rp.next()) else {
            continue;
        };
        if edits(&era.to_uppercase(), &r_era.to_uppercase(), |a, b| a == b) > 1 {
            continue;
        }
        let r_code = r_code.to_uppercase();
        if code.chars().count() != r_code.chars().count() {
            continue;
        }
        let cost = edits(&code, &r_code, look_alike);
        // A letter OCR got wrong is allowed only in codes of three or more,
        // and never the first: "Meso VI" for V13 would otherwise be X1.
        let first_fits = matches!(
            (code.chars().next(), r_code.chars().next()),
            (Some(a), Some(b)) if look_alike(a, b)
        );
        if cost > 0 && (code.chars().count() < 3 || !first_fits) {
            continue;
        }
        match best {
            Some((b, _)) if cost > b => {}
            Some((b, _)) if cost == b => tie = true,
            _ => {
                best = Some((cost, relic));
                tie = false;
            }
        }
    }
    match best {
        Some((cost, relic)) if cost <= 1 && !tie => Some(relic.clone()),
        _ => None,
    }
}

/// Characters OCR reads for one another on relic tiles.
fn look_alike(read: char, real: char) -> bool {
    if read == real {
        return true;
    }
    matches!(
        (read, real),
        ('I' | 'L' | 'T' | '|' | '!' | 'J', '1')
            | ('O' | 'D' | 'Q', '0')
            | ('G', '9')
            | ('S', '5')
            | ('Z', '2')
            | ('B' | '6' | '8', 'D')
            | ('B', '8')
            | ('6', 'G')
    )
}

/// Edit distance where a substitution of characters `same` takes as equal
/// costs nothing.
fn edits(a: &str, b: &str, same: impl Fn(char, char) -> bool) -> usize {
    let a: Vec<char> = a.chars().collect();
    let b: Vec<char> = b.chars().collect();
    let mut prev: Vec<usize> = (0..=b.len()).collect();
    for (i, &ca) in a.iter().enumerate() {
        let mut cur = vec![i + 1; b.len() + 1];
        for (j, &cb) in b.iter().enumerate() {
            let sub = prev[j] + usize::from(!same(ca, cb));
            cur[j + 1] = sub.min(prev[j + 1] + 1).min(cur[j] + 1);
        }
        prev = cur;
    }
    prev[b.len()]
}

#[cfg(test)]
mod tests {
    use super::*;

    fn meso() -> Vec<String> {
        [
            "A12", "C1", "C11", "D8", "D9", "K8", "K9", "L5", "V13", "V15", "V17", "X1", "Y2",
        ]
        .iter()
        .map(|c| format!("Meso {c}"))
        .collect()
    }

    #[test]
    fn names_as_ocr_read_them_in_the_game() {
        let relics = meso();
        for (read, relic) in [
            ("Meso VI 3", Some("Meso V13")),
            ("Meso A1 2", Some("Meso A12")),
            ("Meso Cl T", Some("Meso C11")),
            ("Meso b8", Some("Meso D8")),
            ("Meso 68", Some("Meso D8")),
            ("Meso Y2", Some("Meso Y2")),
            ("Meso", None),
        ] {
            assert_eq!(identify(read, &relics).as_deref(), relic, "{read}");
        }
    }

    #[test]
    fn other_eras_and_garbled_codes() {
        let neo: Vec<String> = ["C7", "C9", "C10", "V12", "V13", "A1", "E1"]
            .iter()
            .map(|c| format!("Neo {c}"))
            .collect();
        assert_eq!(identify("Neo CIO", &neo).as_deref(), Some("Neo C10"));
        assert_eq!(identify("Neo cg", &neo).as_deref(), Some("Neo C9"));
        assert_eq!(identify("Neo \\/12", &neo).as_deref(), Some("Neo V12"));
        assert_eq!(identify("Neo \\./13", &neo).as_deref(), Some("Neo V13"));
        // "1" fits A1 and E1 equally.
        assert_eq!(identify("Neo 1", &neo), None);
        // Another era's relic is never taken.
        assert_eq!(identify("Meso C7", &neo), None);
    }

    #[test]
    fn a_short_list_is_complete_even_when_ocr_misses_a_tile() {
        assert!(list_fits_on_screen(Some((8, 8))));
        assert!(!list_fits_on_screen(Some((8, 16))));
        assert!(!list_fits_on_screen(None));
    }
}
