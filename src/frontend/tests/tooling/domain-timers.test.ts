import { describe, expect, it } from "vitest";
import { collectNewMatches, matchesWatch, MISSION_TYPES_BY_VARIANT, sortByTier, type FissureWatch } from "../../src/domain/fissures.ts";
import { duviriCycle, formatDuration, nextUtcMidnight, nextWeeklyReset } from "../../src/domain/time.ts";
import { getTimerInfo, normalizeFavorites, normalizeTimerId } from "../../src/domain/timers.ts";
import type { WsFissure } from "../../src/domain/worldstate.types.ts";

describe("formatDuration", () => {
  it.each([
    [0, "—"],
    [-5, "—"],
    [65_000, "1m 5s"],
    [3_725_000, "1h 2m 5s"],
    [90_061_000, "1d 1h 1m"],
  ])("%d ms → %s", (ms, text) => {
    expect(formatDuration(ms)).toBe(text);
  });
});

describe("resets", () => {
  const wednesday = Date.UTC(2026, 10, 11, 15, 30); // Wed 2026-11-11 15:30 UTC
  it("daily reset is the next UTC midnight", () => {
    expect(nextUtcMidnight(wednesday)).toBe("2026-11-12T00:00:00.000Z");
  });
  it("weekly reset is the next Monday 00:00 UTC", () => {
    expect(nextWeeklyReset(wednesday)).toBe("2026-11-16T00:00:00.000Z");
    const sunday = Date.UTC(2026, 10, 15, 23);
    expect(nextWeeklyReset(sunday)).toBe("2026-11-16T00:00:00.000Z");
  });
});

describe("duviriCycle", () => {
  it("starts with Joy at the epoch and changes every 2 hours", () => {
    const epoch = Date.UTC(2023, 2, 22, 2);
    expect(duviriCycle(epoch)).toEqual({ mood: "Joy", next: "Anger", expiry: "2023-03-22T04:00:00.000Z" });
    expect(duviriCycle(epoch + 5 * 7_200_000).mood).toBe("Neutral");
    expect(duviriCycle(epoch + 6 * 7_200_000).mood).toBe("Joy");
  });
});

describe("timer ids", () => {
  it("maps the old duviri-cycle id to duviri-spiral", () => {
    expect(normalizeTimerId("duviri-cycle")).toBe("duviri-spiral");
    expect(normalizeFavorites(["duviri-cycle", "duviri-spiral", "sortie", "unknown"])).toEqual(["duviri-spiral", "sortie"]);
  });

  it("returns timer info for the Duviri spiral without worldstate data", () => {
    expect(getTimerInfo("duviri-spiral", {}, Date.UTC(2023, 2, 22, 2))?.state).toBe("Joy");
    expect(getTimerInfo("sortie", {}, 0)).toBeNull();
  });
});

const fissure = (tier: string, missionType = "Capture"): WsFissure => ({
  id: tier,
  expiry: "",
  node: "",
  missionType,
  enemy: "",
  tier,
  tierNum: ["Lith", "Meso", "Neo", "Axi", "Requiem", "Omnia"].indexOf(tier) + 1,
  isStorm: false,
  isHard: false,
  active: true,
});
const watch = (w: Partial<FissureWatch>): FissureWatch => ({ id: "w", tier: "Any", missionType: "Any", variant: "any", ...w });

describe("matchesWatch", () => {
  it("filters on variant, tier and mission type", () => {
    expect(matchesWatch(watch({ variant: "hard" }), fissure("Lith"), "normal")).toBe(false);
    expect(matchesWatch(watch({ tier: "Lith" }), fissure("Meso"), "normal")).toBe(false);
    expect(matchesWatch(watch({ tier: "Lith", missionType: "Capture" }), fissure("Lith"), "normal")).toBe(true);
    expect(matchesWatch(watch({ missionType: "Survival" }), fissure("Lith"), "normal")).toBe(false);
  });

  it("treats Omnia in both directions, except Requiem", () => {
    expect(matchesWatch(watch({ tier: "Omnia" }), fissure("Axi"), "normal")).toBe(true);
    expect(matchesWatch(watch({ tier: "Omnia" }), fissure("Requiem"), "normal")).toBe(false);
    expect(matchesWatch(watch({ tier: "Neo" }), fissure("Omnia"), "normal")).toBe(true);
    expect(matchesWatch(watch({ tier: "Requiem" }), fissure("Omnia"), "normal")).toBe(false);
  });

  it("sorts by tier and keeps storm mission types separate", () => {
    expect(sortByTier([fissure("Axi"), fissure("Lith")]).map((f) => f.tier)).toEqual(["Lith", "Axi"]);
    expect(MISSION_TYPES_BY_VARIANT.storm).toContain("Skirmish");
    expect(MISSION_TYPES_BY_VARIANT.normal).not.toContain("Skirmish");
  });
});

describe("collectNewMatches", () => {
  const ws = { fissures: [fissure("Lith"), fissure("Axi")] };
  const lith = watch({ id: "lith", tier: "Lith" });

  it("announces what a new watch matches right now", () => {
    const { fresh } = collectNewMatches(ws, [lith], new Map());
    expect(fresh.map((m) => m.fissure.tier)).toEqual(["Lith"]);
  });

  it("seeds restored watches silently, then announces only new fissures", () => {
    const first = collectNewMatches(ws, [lith], new Map(), new Set(["lith"]));
    expect(first.fresh).toEqual([]);
    const second = collectNewMatches({ fissures: [...ws.fissures, { ...fissure("Lith"), id: "Lith-2" }] }, [lith], first.live, new Set(["lith"]));
    expect(second.fresh.map((m) => m.fissure.id)).toEqual(["Lith-2"]);
  });
});
