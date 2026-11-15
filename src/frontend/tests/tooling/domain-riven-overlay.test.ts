import { describe, expect, it } from "vitest";
import {
  classifyOriginal,
  classifyStat,
  PREVIEW_VIEW,
  resultFromError,
  resultFromOcr,
  rivenPlacement,
  savedRollLabel,
  wantedNames,
  weaponTitle,
  worthAnalysing,
  type OcrRiven,
  type OverlayAnalysis,
} from "../../src/domain/rivenOverlay";

if (PREVIEW_VIEW.kind !== "result" || !PREVIEW_VIEW.analysis) throw new Error("the preview has an analysis");
const analysis: OverlayAnalysis = PREVIEW_VIEW.analysis;

const ocr: OcrRiven = {
  weapon: "tenora prime",
  positives: ["Critical Chance"],
  negatives: [],
  rolled_stats: [{ name: "Critical Chance", value: "+180%", positive: true }],
  is_comparison: true,
  original_rolled_stats: [{ name: "Zoom", value: "-30%", positive: false }],
  raw: "TENORA PRIME",
};

describe("check results", () => {
  it("turns an OCR read into a live result", () => {
    expect(resultFromOcr(ocr, analysis, 3)).toEqual({
      kind: "result",
      preview: false,
      rollCount: 3,
      analysis,
      weapon: "tenora prime",
      rolledStats: ocr.rolled_stats,
      originalStats: ocr.original_rolled_stats,
      isComparison: true,
      ocrRaw: "TENORA PRIME",
    });
  });
  it("turns an error into an empty result with the error as raw OCR", () => {
    expect(resultFromError(new Error("no window"), 2)).toMatchObject({
      kind: "result",
      analysis: null,
      rolledStats: [],
      rollCount: 2,
      ocrRaw: "OCR ERROR: Error: no window",
    });
  });
  it("analyses only when there is a weapon or a positive", () => {
    expect(worthAnalysing(ocr)).toBe(true);
    expect(worthAnalysing({ ...ocr, weapon: "" })).toBe(true);
    expect(worthAnalysing({ ...ocr, weapon: "", positives: [] })).toBe(false);
  });
});

describe("stat classes", () => {
  it("marks the new roll wanted, neutral, safe or harmful", () => {
    expect(classifyStat({ name: "Critical Chance", value: "+1", positive: true }, analysis)).toBe("wanted");
    expect(classifyStat({ name: "Multi-shot", value: "+1", positive: true }, analysis)).toBe("neutral");
    expect(classifyStat({ name: "Zoom", value: "-1", positive: false }, analysis)).toBe("safe");
    expect(classifyStat({ name: "Damage to Corpus", value: "-1", positive: false }, analysis)).toBe("harmful");
    expect(classifyStat({ name: "Zoom", value: "-1", positive: false }, null)).toBe("neutral");
  });
  it("splits missing groups into wanted names", () => {
    const wanted = wantedNames({ ...analysis, missing_positives: ["Multishot / Toxin"] });
    expect([...wanted].sort()).toEqual(["Critical Chance", "Damage to Grineer", "Multishot", "Toxin"]);
    expect(wantedNames(null).size).toBe(0);
  });
  it("marks the original roll by the full wanted list, never harmful", () => {
    const wanted = wantedNames(analysis);
    expect(classifyOriginal({ name: "Multi-shot", value: "+1", positive: true }, analysis, wanted)).toBe("wanted");
    expect(classifyOriginal({ name: "Toxin", value: "+1", positive: true }, analysis, wanted)).toBe("neutral");
    expect(classifyOriginal({ name: "Zoom", value: "-1", positive: false }, analysis, wanted)).toBe("safe");
    expect(classifyOriginal({ name: "Damage to Corpus", value: "-1", positive: false }, analysis, wanted)).toBe("neutral");
  });
});

it("titles the weapon and labels a saved roll", () => {
  expect(weaponTitle("tenora prime")).toBe("Tenora Prime");
  expect(weaponTitle("")).toBe("Riven Analyzer");
  expect(savedRollLabel("tenora prime", 4, new Date(2026, 10, 12))).toBe("Tenora prime · Roll #4 · 12 Nov");
});

describe("placement", () => {
  it("puts the window left in the game on the monitor scale, offsets on top", () => {
    expect(rivenPlacement([0, 0, 1920, 1080], 1, 1, { x: 0, y: 0 })).toEqual({ x: 10, y: 216, width: 300, height: 648 });
    expect(rivenPlacement([200, 100, 3840, 2160], 2, 1.5, { x: 5, y: -10 })).toEqual({ x: 115, y: 256, width: 450, height: 648 });
    expect(rivenPlacement([0, 0, 1920, 1080], 0, 1, { x: 0, y: 0 }).height).toBe(648);
  });
});
