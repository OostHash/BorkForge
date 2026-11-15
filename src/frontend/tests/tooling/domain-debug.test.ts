import { describe, expect, it } from "vitest";
import { alreadyRunning, batchCards, clearLabel, formatBytes, probeSummary, rawScanActive } from "../../src/domain/debug";

describe("sizes", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(-5)).toBe("0 B");
    expect(formatBytes(Number.NaN)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatBytes(3 * 1024 ** 4)).toBe("3072.0 GB");
  });
  it("labels Clear with the size", () => {
    expect(clearLabel(0)).toBe("Clear");
    expect(clearLabel(2048)).toBe("Clear (2.0 KB)");
  });
});

it("reads backend answers", () => {
  expect(probeSummary("a\n\nb\n  \nc\n")).toBe("Probe done: 3 entries written.");
  expect(probeSummary("one")).toBe("Probe done: 1 entry written.");
  expect(rawScanActive("started")).toBe(true);
  expect(rawScanActive("stopped")).toBe(false);
  expect(alreadyRunning("Memory relic debug already running")).toBe(true);
  expect(alreadyRunning(new Error("no EE.log"))).toBe(false);
});

describe("batch preview", () => {
  it("shows every card, or the ones of one state", () => {
    expect(batchCards("all").map((c) => c.state)).toEqual(["gained", "lost", "building", "ranks"]);
    expect(batchCards("lost").map((c) => c.row.item.name)).toEqual(["Consumed component"]);
    expect(batchCards("building")[0]?.building).toBe("Building item");
  });
  it("drops the change badges after five minutes", () => {
    const expired = batchCards("expired");
    expect(expired).toHaveLength(4);
    expect(expired.every((c) => c.recent === null)).toBe(true);
    expect(batchCards("gained")[0]?.recent).toEqual({ delta: 12, minutesAgo: 0 });
  });
});
