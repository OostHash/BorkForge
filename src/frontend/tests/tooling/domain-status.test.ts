import { describe, expect, it } from "vitest";
import { cacheAge, cacheHealth, cacheLabel, sourceTone, type CacheStatus } from "../../src/domain/cache";
import { autoInvisibleMinutes, clampMinutes } from "../../src/domain/settings";
import { memoryStatus, wfmStatus } from "../../src/domain/status";

const cache = (source: CacheStatus["source"], warning: string | null = null): CacheStatus => ({ source, last_updated: 0, warning });

describe("cacheHealth", () => {
  it("is offline with no caches or any fallback", () => {
    expect(cacheHealth({})).toBe("offline");
    expect(cacheHealth({ a: cache("fresh"), b: cache("fallback") })).toBe("offline");
  });
  it("is stale with any stale cache or warning", () => {
    expect(cacheHealth({ a: cache("fresh"), b: cache("stale") })).toBe("stale");
    expect(cacheHealth({ a: cache("refreshed", "slow") })).toBe("stale");
  });
  it("is fresh when every cache is fresh or refreshed", () => {
    expect(cacheHealth({ a: cache("fresh"), b: cache("refreshed") })).toBe("fresh");
  });
});

describe("cacheAge", () => {
  const now = 1_000_000 * 1000;
  it.each([
    [null, "never"],
    [1_000_000 - 12, "12s ago"],
    [1_000_000 - 5 * 60, "5m ago"],
    [1_000_000 - 3 * 3600, "3h ago"],
    [1_000_000 - 2 * 86_400, "2d ago"],
    [1_000_000 + 30, "0s ago"],
  ])("%s → %s", (lastUpdated, expected) => {
    expect(cacheAge(lastUpdated, now)).toBe(expected);
  });
});

it("labels known caches and keeps unknown keys", () => {
  expect(cacheLabel("bulk-prices")).toBe("Bulk Prices");
  expect(cacheLabel("new-cache")).toBe("new-cache");
});

it("maps cache sources to tones", () => {
  expect(sourceTone("refreshed")).toBe("success");
  expect(sourceTone("stale")).toBe("warning");
  expect(sourceTone("fallback")).toBe("neutral");
});

describe("memoryStatus", () => {
  const base = { enabled: true, monitoring: true, gameRunning: false, checking: false };
  it("is OFF when the setting is off", () => {
    expect(memoryStatus({ ...base, enabled: false })).toMatchObject({ state: "disabled", detail: "OFF", canPoke: false });
  });
  it("is Idle while the scanner is not running yet", () => {
    expect(memoryStatus({ ...base, monitoring: false })).toMatchObject({ state: "offline", detail: "Idle" });
  });
  it("is Scanning when the game runs", () => {
    expect(memoryStatus({ ...base, gameRunning: true })).toMatchObject({ state: "online", detail: "Scanning", canPoke: false });
  });
  it("offers a poke without the game, and shows Checking… after it", () => {
    expect(memoryStatus(base)).toMatchObject({ detail: "No Game", canPoke: true });
    expect(memoryStatus({ ...base, checking: true })).toMatchObject({ detail: "Checking…", canPoke: false });
  });
});

it("wfmStatus says whether you are logged in", () => {
  expect(wfmStatus(true)).toMatchObject({ state: "online", detail: "Online" });
  expect(wfmStatus(false)).toMatchObject({ state: "offline", detail: "Not logged in" });
});

describe("auto-invisible minutes", () => {
  it.each([
    ["45", 45],
    ["0", 1],
    ["900", 480],
    ["", 30],
    ["abc", 30],
  ])("%s → %s", (raw, expected) => {
    expect(clampMinutes(raw)).toBe(expected);
  });
  it("reads the stored value, or 30", () => {
    expect(autoInvisibleMinutes(15)).toBe(15);
    expect(autoInvisibleMinutes(1000)).toBe(480);
    expect(autoInvisibleMinutes("15")).toBe(30);
  });
});
