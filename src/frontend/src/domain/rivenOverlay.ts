import type { RivenAnalysis, RollStat } from "./rivens";

/** Riven overlay rules (vault overlay-riven.md). Pure functions. */

/** analyze_riven also reports these (the screens did not need them so far). */
export type OverlayAnalysis = RivenAnalysis & { matched_positives?: string[]; missing_positives?: string[] };

/** What ocr_riven_screen reads from the riven card on screen. */
export type OcrRiven = {
  weapon: string;
  positives: string[];
  negatives: string[];
  rolled_stats: RollStat[];
  is_comparison: boolean;
  original_rolled_stats: RollStat[];
  raw: string;
};

/** The overlay's state, as the main window sends it (riven-analysis-update and friends). */
export type RivenView =
  | { kind: "scanning"; rollCount: number }
  | {
      kind: "result";
      /** A Settings preview, which live data replaces. */
      preview: boolean;
      rollCount: number;
      analysis: OverlayAnalysis | null;
      weapon: string;
      rolledStats: RollStat[];
      originalStats: RollStat[];
      isComparison: boolean;
      ocrRaw: string;
    };

export function resultFromOcr(ocr: OcrRiven, analysis: OverlayAnalysis | null, rollCount: number): RivenView {
  return {
    kind: "result",
    preview: false,
    rollCount,
    analysis,
    weapon: ocr.weapon,
    rolledStats: ocr.rolled_stats,
    originalStats: ocr.original_rolled_stats,
    isComparison: ocr.is_comparison,
    ocrRaw: ocr.raw,
  };
}

export function resultFromError(error: unknown, rollCount: number): RivenView {
  return {
    kind: "result",
    preview: false,
    rollCount,
    analysis: null,
    weapon: "",
    rolledStats: [],
    originalStats: [],
    isComparison: false,
    ocrRaw: `OCR ERROR: ${String(error)}`,
  };
}

/** OCR found something worth analysing: a weapon or a positive stat. */
export const worthAnalysing = (ocr: OcrRiven) => ocr.weapon !== "" || ocr.positives.length > 0;

export type StatClass = "wanted" | "neutral" | "safe" | "harmful";
export const STAT_LABEL: Readonly<Record<StatClass, string>> = { wanted: "Wanted", neutral: "Neutral", safe: "Safe", harmful: "Harmful" };

/** A stat on the new roll: wanted when matched, safe or harmful when negative. */
export function classifyStat(stat: RollStat, analysis: OverlayAnalysis | null): StatClass {
  if (!analysis) return "neutral";
  if (!stat.positive) return analysis.safe_negatives_present.includes(stat.name) ? "safe" : "harmful";
  return (analysis.matched_positives ?? []).includes(stat.name) ? "wanted" : "neutral";
}

/** Every wanted stat: matched ones and each name in a missing group ("MS / TOX"). */
export function wantedNames(analysis: OverlayAnalysis | null): Set<string> {
  const names = new Set<string>();
  if (!analysis) return names;
  for (const s of analysis.matched_positives ?? []) names.add(s);
  for (const group of analysis.missing_positives ?? []) for (const s of group.split(" / ")) names.add(s.trim());
  return names;
}

/** A stat on the original roll (comparison): wanted by the full list; a negative is safe or neutral. */
export function classifyOriginal(stat: RollStat, analysis: OverlayAnalysis | null, wanted: ReadonlySet<string>): StatClass {
  if (!analysis) return "neutral";
  if (!stat.positive) return analysis.safe_negatives_present.includes(stat.name) ? "safe" : "neutral";
  return wanted.has(stat.name) ? "wanted" : "neutral";
}

/** "tenora prime" → "Tenora Prime"; "Riven Analyzer" without a weapon. */
export function weaponTitle(weapon: string): string {
  if (!weapon) return "Riven Analyzer";
  return weapon
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** "Tenora prime · Roll #4 · 12 Nov", like the current app. */
export function savedRollLabel(weapon: string, rollCount: number, date: Date): string {
  const month = date.toLocaleString("en", { month: "short" });
  return `${weapon.charAt(0).toUpperCase()}${weapon.slice(1)} · Roll #${String(rollCount)} · ${String(date.getDate())} ${month}`;
}

// ── Window placement ────────────────────────────────────────────────────────

export const RIVEN_WIDTH = 300;
/** Ignore a second screen-open within this long (the log repeats it). */
export const RETRIGGER_MS = 4000;
/** Close a forgotten overlay after an hour without new data. */
export const EMERGENCY_HIDE_MS = 3_600_000;

/**
 * Where the riven window goes for a game rect in physical pixels: logical
 * x/y/size on the monitor's scale factor, left in the game window, offsets
 * on top.
 */
export function rivenPlacement(
  rect: readonly [number, number, number, number],
  monitorScale: number,
  textScale: number,
  offset: { x: number; y: number },
): { x: number; y: number; width: number; height: number } {
  const [wx, wy, , wh] = rect;
  const f = monitorScale || 1;
  const x = wx / f;
  const y = wy / f;
  const h = wh / f;
  return {
    x: Math.round(x + 10 + offset.x),
    y: Math.round(y + h * 0.2 + offset.y),
    width: Math.round(RIVEN_WIDTH * textScale),
    height: Math.round(h * 0.6),
  };
}

// ── Preview ─────────────────────────────────────────────────────────────────

export const PREVIEW_VIEW: RivenView = {
  kind: "result",
  preview: true,
  rollCount: 4,
  weapon: "Tenora Prime",
  isComparison: false,
  ocrRaw: "TENORA PRIME\n+180% Critical Chance",
  analysis: {
    weapon: "Tenora Prime",
    matched_positives: ["Critical Chance", "Damage to Grineer"],
    missing_positives: ["Multi-shot"],
    safe_negatives_present: ["Zoom"],
    harmful_negatives: ["Damage to Corpus"],
    score: 0.78,
    verdict: "GOOD — usable",
    notes: "Preview",
    alternatives: [
      { label: "Crit build", matched: ["Critical Chance", "Damage to Grineer"], missing: ["Multi-shot"], score: 0.78, verdict: "GOOD — usable" },
    ],
  },
  rolledStats: [
    { name: "Critical Chance", value: "+180%", positive: true },
    { name: "Damage to Grineer", value: "+145%", positive: true },
    { name: "Multi-shot", value: "+85%", positive: true },
    { name: "Damage to Corpus", value: "-20%", positive: false },
  ],
  originalStats: [],
};
