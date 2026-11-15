import type { InventoryRow, ModCounts } from "./inventory";

/** Debug and diagnostics rules (vault debugging.md). Pure functions. */

/** Folders and files the backend knows by name (open_debug_folder). */
export const DEBUG_FOLDERS = ["blobs", "api_logs", "diag", "manual_capture", "probe", "raw_scan", "unmatched_paths"] as const;
export type DebugFolder = (typeof DEBUG_FOLDERS)[number];
/** The ones with a size and a Clear button; "diag" is sized and cleared by its own commands. */
export const SIZED_FOLDERS = ["blobs", "api_logs", "probe", "raw_scan", "unmatched_paths"] as const;
export type SizedFolder = (typeof SIZED_FOLDERS)[number];
export type DebugSizes = Readonly<Record<SizedFolder | "diag", number>>;
export const NO_SIZES: DebugSizes = { blobs: 0, api_logs: 0, probe: 0, raw_scan: 0, unmatched_paths: 0, diag: 0 };

const UNITS = ["B", "KB", "MB", "GB"] as const;

/** 0 → "0 B", 1536 → "1.5 KB", 5 MB → "5.0 MB". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return unit === 0 ? `${String(Math.round(value))} B` : `${value.toFixed(1)} ${UNITS[unit] ?? "GB"}`;
}

/** "Clear" or "Clear (1.5 KB)". */
export const clearLabel = (bytes: number) => (bytes > 0 ? `Clear (${formatBytes(bytes)})` : "Clear");

/** "Probe done: 12 entries written." from dump_memory_probe's lines. */
export function probeSummary(result: string): string {
  const n = result.split("\n").filter((l) => l.trim() !== "").length;
  return `Probe done: ${String(n)} ${n === 1 ? "entry" : "entries"} written.`;
}

/** Memory relic debug: start fails with this when it runs already. */
export const alreadyRunning = (error: unknown) => /already running/i.test(String(error));

/** What toggle_raw_scan answers. */
export const rawScanActive = (status: string) => status === "started";

export const TEST_ERAS = ["LITH", "MESO", "NEO", "AXI", "ALL"] as const;

// ── Inventory batch preview ─────────────────────────────────────────────────

export const BATCH_STATES = ["all", "gained", "lost", "building", "ranks", "expired"] as const;
export type BatchState = (typeof BATCH_STATES)[number];
export const BATCH_LABEL: Readonly<Record<BatchState, string>> = {
  all: "All incoming",
  gained: "Gained",
  lost: "Lost",
  building: "Building",
  ranks: "Rank change",
  expired: "After 5 min",
};

export type BatchCard = {
  state: Exclude<BatchState, "all" | "expired">;
  row: InventoryRow;
  recent: { delta: number; minutesAgo: number } | null;
  building: string | null;
};

const card = (
  state: BatchCard["state"],
  name: string,
  category: string,
  qty: number,
  recent: BatchCard["recent"],
  building: string | null = null,
): BatchCard => ({
  state,
  row: { item: { unique_name: `preview-${state}`, name, category }, qty, plat: null, ducats: null, mastery: 0 },
  recent,
  building,
});

const BATCH: readonly BatchCard[] = [
  card("gained", "New resource stack", "Resources", 12, { delta: 12, minutesAgo: 0 }),
  card("lost", "Consumed component", "Misc", 0, { delta: -3, minutesAgo: 0 }),
  card("building", "Building item", "Primary", 1, null, "Building item"),
  card("ranks", "Ranked mod", "Mods", 3, { delta: 1, minutesAgo: 0 }),
];

/** Rank counts for the rank-change card. */
export const BATCH_MODS: ModCounts = { "preview-ranks": { total: 3, by_rank: { "0": 2, "5": 1 } } };

/**
 * The example cards for a state. "After 5 min" shows every card without its
 * change badge, as the inventory does once a change is older than 5 minutes.
 */
export function batchCards(state: BatchState): BatchCard[] {
  if (state === "expired") return BATCH.map((c) => ({ ...c, recent: null }));
  return state === "all" ? [...BATCH] : BATCH.filter((c) => c.state === state);
}
