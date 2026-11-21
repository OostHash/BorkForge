//! The relic list reader on screens recorded in the game: the OCR result
//! (json) and the picture at a quarter of its size in grey (PGM), from
//! `tests/fixtures/relic-list/`.

use hexdesk_capture::{Frame, TextRead};
use hexdesk_overlays::read::relic_list::{read_relic_list, Names, RelicList};

fn fixture(name: &str) -> (TextRead, Frame) {
    let dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/relic-list");
    let json = std::fs::read_to_string(dir.join(format!("{name}.json"))).unwrap();
    let pgm = std::fs::read(dir.join(format!("{name}.pgm"))).unwrap();
    // "P5\n<width> <height>\n255\n" then one byte per pixel.
    let mut fields = pgm.splitn(5, |b| b.is_ascii_whitespace());
    let _magic = fields.next();
    let number =
        |f: Option<&[u8]>| -> u32 { std::str::from_utf8(f.unwrap()).unwrap().parse().unwrap() };
    let width = number(fields.next());
    let height = number(fields.next());
    let _max = fields.next();
    let gray = fields.next().unwrap();
    let pixels = gray.iter().flat_map(|&v| [v, v, v, 255]).collect();
    (
        TextRead::from_json(&json).unwrap(),
        Frame::new(pixels, width, height),
    )
}

fn era(era: &str, codes: &str) -> Vec<String> {
    codes
        .split_whitespace()
        .map(|c| format!("{era} {c}"))
        .collect()
}

fn read(name: &str, relics: &[String]) -> RelicList {
    let (text, frame) = fixture(name);
    let names = Names {
        owned: &[],
        all: relics,
    };
    let list = read_relic_list(&text, &frame, &names, &|_| None);
    println!("{name}: {}", list.summary());
    list
}

/// (owned, count) of a relic at a refinement; panics when it was not read.
fn tile(list: &RelicList, relic: &str, refinement: &str) -> (Option<bool>, Option<u32>) {
    let t = list
        .tiles
        .iter()
        .find(|t| t.relic.as_deref() == Some(relic) && t.refinement == refinement)
        .unwrap_or_else(|| panic!("{relic} {refinement} not read"));
    (t.owned, t.count)
}

const MESO: &str = "A1 A2 A3 A4 A5 A6 A12 C1 C11 D8 D9 K8 K9 L5 V1 V13 V15 V17 X1 Y2";

#[test]
fn the_meso_refinement_list() {
    let list = read("refinement-meso", &era("Meso", MESO));
    assert_eq!(tile(&list, "Meso D9", "Intact").0, Some(true));
    assert_eq!(tile(&list, "Meso D8", "Exceptional").0, Some(true));
    for faded in ["Meso A2", "Meso A3", "Meso A4", "Meso A5", "Meso A6"] {
        assert_eq!(tile(&list, faded, "Intact").0, Some(false), "{faded}");
    }
    assert_eq!(tile(&list, "Meso X1", "Intact").0, Some(true));
    // The fifth column, at the right edge.
    assert_eq!(tile(&list, "Meso A1", "Intact").0, Some(false));
}

#[test]
fn the_neo_refinement_list() {
    let list = read(
        "refinement-neo",
        &era(
            "Neo",
            "A1 A2 A3 A4 A5 A6 A7 A8 A9 A10 A11 A12 A13 C7 C9 C10 K10 T11 V12",
        ),
    );
    for owned in ["Neo C7", "Neo C9", "Neo C10", "Neo V12"] {
        assert_eq!(tile(&list, owned, "Intact").0, Some(true), "{owned}");
    }
    for faded in ["Neo A4", "Neo A5", "Neo A9", "Neo A11"] {
        assert_eq!(tile(&list, faded, "Intact").0, Some(false), "{faded}");
    }
    // "Neo 1" is Neo T11 with its T dropped; it must not be taken for A1.
    assert!(list
        .tiles
        .iter()
        .filter(|t| t.relic.as_deref() == Some("Neo A1"))
        .all(|t| t.owned == Some(false)));
}

#[test]
fn a_used_up_relic_in_a_mission_is_not_owned() {
    for name in ["mission-meso-dark", "mission-meso-bright"] {
        let list = read(name, &era("Meso", MESO));
        assert_eq!(tile(&list, "Meso D9", "Intact").0, Some(false), "{name}");
        assert_eq!(tile(&list, "Meso X1", "Intact").0, Some(true), "{name}");
        assert_eq!(
            tile(&list, "Meso D8", "Exceptional").0,
            Some(true),
            "{name}"
        );
    }
}

#[test]
fn count_badges_that_ocr_read() {
    let list = read("mission-meso-bright", &era("Meso", MESO));
    assert_eq!(tile(&list, "Meso L5", "Intact"), (Some(true), Some(5)));
    assert_eq!(tile(&list, "Meso V17", "Intact"), (Some(true), Some(3)));
}

#[test]
fn every_tile_owned_or_not_is_measured() {
    for name in [
        "refinement-meso",
        "refinement-neo",
        "mission-meso-dark",
        "mission-meso-bright",
    ] {
        let list = read(name, &era("Meso", MESO));
        assert!(!list.tiles.is_empty(), "{name}");
        assert!(list.tiles.iter().all(|t| t.owned.is_some()), "{name}");
    }
}

#[test]
fn the_era_comes_from_the_head_of_the_list() {
    for (name, era) in [
        ("refinement-meso", "MESO"),
        ("refinement-neo", "NEO"),
        ("mission-meso-dark", "MESO"),
        ("mission-meso-bright", "MESO"),
    ] {
        let (text, _) = fixture(name);
        assert_eq!(
            hexdesk_overlays::read::era_of_list(&text),
            Some(era),
            "{name}"
        );
    }
}

#[test]
fn a_mission_list_is_complete_and_its_title_is_no_tile() {
    for (name, collected) in [
        ("mission-meso-hover", (9, 10)),
        ("mission-meso-used", (8, 10)),
    ] {
        let list = read(name, &era("Meso", MESO));
        assert_eq!(list.collected, Some(collected), "{name}");
        assert!(list.complete, "{name}");
        assert!(
            list.tiles.iter().all(|t| !t.text.contains("FISSURE")),
            "{name}"
        );
    }
}

#[test]
fn relics_used_up_this_mission_are_faded() {
    let list = read("mission-meso-used", &era("Meso", MESO));
    assert_eq!(tile(&list, "Meso X1", "Intact").0, Some(false));
    assert_eq!(tile(&list, "Meso D8", "Intact"), (Some(true), Some(8)));
}

#[test]
fn a_long_list_with_faded_tiles_shows_every_relic_the_player_has() {
    // 195 relics scroll, but the faded ones come after those the player has.
    let list = read("refinement-meso", &era("Meso", MESO));
    assert_eq!(list.collected, Some((12, 195)));
    assert!(list.complete);
}

#[test]
fn a_name_read_again_on_its_own_is_matched() {
    // The list read gives "Meso VI" for the V13 tile; read on its own the
    // name comes out whole.
    let (text, frame) = fixture("mission-meso-used");
    let owned = era("Meso", "C11 D8 K8 K9 L5 V13 V15 V17 X1 Y2");
    let all = era("Meso", MESO);
    let names = Names {
        owned: &owned,
        all: &all,
    };
    let list = read_relic_list(&text, &frame, &names, &|_| {
        Some("Meso V13 Relic".to_string())
    });
    assert!(list
        .tiles
        .iter()
        .any(|t| t.relic.as_deref() == Some("Meso V13")));
    assert!(list
        .tiles
        .iter()
        .all(|t| t.relic.as_deref() != Some("Meso V1")));
}

#[test]
fn the_panel_of_the_selected_relic_is_no_tile() {
    // "Meso DB Relic [Excep" heads the panel right of the list.
    let list = read("mission-meso-panel", &era("Meso", MESO));
    let d8 = |refinement: &str| {
        list.tiles
            .iter()
            .filter(|t| t.relic.as_deref() == Some("Meso D8") && t.refinement == refinement)
            .count()
    };
    assert_eq!(d8("Intact"), 1);
    assert_eq!(tile(&list, "Meso D8", "Intact"), (Some(true), Some(8)));
    assert_eq!(tile(&list, "Meso D9", "Intact").0, Some(false));
}

#[test]
fn a_name_split_from_its_relic_word_is_one_tile() {
    // OCR gave "Meso Cl 1" and "Relic" as two lines.
    let list = read("mission-meso-split", &era("Meso", MESO));
    assert_eq!(tile(&list, "Meso C11", "Intact").0, Some(true));
}

#[test]
fn a_two_letter_code_with_a_wrong_letter_is_not_named() {
    // "Meso VI" is V13 with its 3 dropped; it must not become X1.
    let owned = era("Meso", "C11 D8 K8 L5 V13 V17 X1 Y2");
    let all = era("Meso", MESO);
    let (text, frame) = fixture("mission-meso-split");
    let names = Names {
        owned: &owned,
        all: &all,
    };
    let list = read_relic_list(&text, &frame, &names, &|_| None);
    assert!(list
        .tiles
        .iter()
        .all(|t| t.relic.as_deref() != Some("Meso X1")));
}
