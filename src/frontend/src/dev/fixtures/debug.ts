import type { LogEntry } from "../../domain/console";
import type { DebugFolder, SizedFolder } from "../../domain/debug";
import { noResult } from "./market";
import type { Fixture } from "./scenario";

/** Debug folders with some data in them, so Clear shows a size (vault debugging.md). */
const SIZES: Record<SizedFolder, number> = { blobs: 2_516_582, api_logs: 0, probe: 18_432, raw_scan: 0, unmatched_paths: 3_210 };

const at = (seconds: number) => `2026-11-18T15:03:${String(seconds).padStart(2, "0")}.000+01:00`;

/** A short session: the scanner fails twice, finds the blob, a market request is refused. */
const RECENT_LOGS: LogEntry[] = [
  {
    id: 1,
    time: at(0),
    level: "info",
    source: "app",
    code: null,
    message: "HexDesk starting",
    fields: { version: "1.1.0" },
    causes: [],
    op: null,
    repeat: null,
  },
  {
    id: 2,
    time: at(2),
    level: "info",
    source: "scanner",
    code: null,
    message: "Warframe process found",
    fields: { pid: "18244", hexdesk_elevated: "false" },
    causes: [],
    op: null,
    repeat: null,
  },
  {
    id: 3,
    time: at(5),
    level: "warn",
    source: "scanner",
    code: "scanner.not_found",
    message: "Account blob not found: no start marker in any readable memory region",
    fields: { regions_read: "412", bytes_mb: "1830" },
    causes: [],
    op: 12,
    repeat: null,
  },
  {
    id: 4,
    time: at(6),
    level: "debug",
    source: "scanner",
    code: null,
    message: "Inventory scan finished",
    fields: { elapsed_ms: "940" },
    causes: [],
    op: 12,
    repeat: null,
  },
  {
    id: 5,
    time: at(40),
    level: "warn",
    source: "scanner",
    code: "scanner.not_found",
    message: "Account blob not found: no start marker in any readable memory region",
    fields: {},
    causes: [],
    op: null,
    repeat: { of: 3, count: 3, until: at(36), last_op: 15 },
  },
  {
    id: 6,
    time: at(41),
    level: "info",
    source: "scanner",
    code: null,
    message: "Account blob found",
    fields: { unique: "412", mods: "880" },
    causes: [],
    op: 16,
    repeat: null,
  },
  {
    id: 7,
    time: at(50),
    level: "warn",
    source: "market",
    code: "market.denied",
    message: "Order could not be created: warframe.market answered 401",
    fields: { status: "401", url: "https://api.warframe.market/v2/order" },
    causes: ['response: {"error":"unauthorized"}'],
    op: null,
    repeat: null,
  },
];

export const debugFixtures = {
  get_recent_logs: { default: () => RECENT_LOGS, empty: () => [] } satisfies Fixture<LogEntry[], { limit?: number }>,
  export_diagnostics: {
    alwaysDefault: true,
    default: () => "C:/Users/Tenno/Downloads/hexdesk-diagnostics-2026-11-18-150312.zip",
  } satisfies Fixture<string>,
  show_diagnostics_export: noResult<{ path: string }>(),
  open_debug_folder: noResult<{ which: DebugFolder }>(),
  get_debug_data_size: { default: ({ which }) => SIZES[which], empty: () => 0 } satisfies Fixture<number, { which: SizedFolder }>,
  clear_debug_data: noResult<{ which: SizedFolder }>(),
  get_diag_folder_size: { default: () => 41_943_040, empty: () => 0 } satisfies Fixture<number>,
  clear_diag_folder: { alwaysDefault: true, default: () => 0 } satisfies Fixture<number>,
  set_blob_log: noResult<{ enabled: boolean }>(),
  set_api_log: noResult<{ enabled: boolean }>(),
  get_overlay_session_log: {
    default: () => "[12:00:01] relic-trigger seen\n[12:00:02] OCR: 4 rewards\n[12:00:02] rewards emitted",
  } satisfies Fixture<string>,
  capture_diagnostics: { alwaysDefault: true, default: () => "C:/HexDesk/Debug/Manual-Capture/2026-11-13_12-00-00" } satisfies Fixture<string>,
  dump_memory_probe: {
    alwaysDefault: true,
    default: () => "/Lotus/Types/Items/MiscItems/OrokinCell\n/Lotus/Powersuits/Mag/MagPrime\n",
  } satisfies Fixture<string>,
  toggle_raw_scan: { alwaysDefault: true, default: () => "started" } satisfies Fixture<string>,
  start_memory_relic_debug: { alwaysDefault: true, default: () => "C:/Temp/hexdesk_mem_relic_debug.log" } satisfies Fixture<string>,
  stop_memory_relic_debug: noResult(),
  debug_detect_fissure_era: { default: () => "No era detected (mock: no game window)." } satisfies Fixture<string>,
  test_relic_pick_overlay: {
    alwaysDefault: true,
    default: ({ era }) => `Emitted relic-pick-open: era=${era}, 3 relics in inventory`,
  } satisfies Fixture<string, { era: string }>,
  debug_ee_log_tail: {
    default: () => "12.345 Sys [Info]: ProjectionRewardChoice opened\n12.346 Script [Info]: VoidProjections: Lith",
  } satisfies Fixture<string>,
  toggle_debug_categorization: { alwaysDefault: true, default: () => true } satisfies Fixture<boolean>,
  wfm_debug_dump: { default: ({ path }) => `GET ${path} (mock)` } satisfies Fixture<string, { path: string }>,
  wfm_get_riven_attributes: { default: () => ["critical_chance", "multishot"] } satisfies Fixture<string[]>,
};
