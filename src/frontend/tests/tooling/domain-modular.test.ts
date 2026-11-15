import { describe, expect, it } from "vitest";
import type { Ownership } from "../../src/domain/completionist";
import type { RecipeComponent } from "../../src/domain/foundry";
import {
  clampModularWidth,
  modularWidthFrom,
  moveItem,
  sectionOrderFrom,
  trackedNeeds,
  trackedStatus,
  watchedFissures,
} from "../../src/domain/modular";
import type { WsFissure } from "../../src/domain/worldstate.types";

const own = (quantities: Record<string, number>): Ownership => ({ quantities, mastery: {}, subsumed: new Set() });
const part = (unique_name: string, name: string, count = 1, components: RecipeComponent[] = [], result_count = 1): RecipeComponent => ({
  unique_name,
  name,
  count,
  result_count,
  components,
});

describe("section order", () => {
  it("keeps known ids, drops unknown and duplicates, appends missing", () => {
    expect(sectionOrderFrom(["timers", "bogus", "timers", "tracking"])).toEqual(["timers", "tracking", "favorites", "fissures"]);
    expect(sectionOrderFrom(undefined)).toEqual(["tracking", "favorites", "timers", "fissures"]);
  });
});

it("moves an item one place and leaves the ends alone", () => {
  expect(moveItem(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"]);
  expect(moveItem(["a", "b", "c"], 2, 1)).toEqual(["a", "b", "c"]);
});

it("keeps the docked width within 160–500 and the window", () => {
  expect(clampModularWidth(600, 2000)).toBe(500);
  expect(clampModularWidth(100, 2000)).toBe(160);
  expect(clampModularWidth(400, 900)).toBe(318);
  expect(modularWidthFrom("x")).toBe(240);
});

describe("trackedNeeds", () => {
  const bp = part("/bp", "Braton Prime Blueprint");
  const barrel = part("/barrel", "Barrel", 1, [part("/barrelBp", "Barrel Blueprint"), part("/ferrite", "Ferrite", 100)]);
  const recipe = [bp, barrel, part("/ferrite", "Ferrite", 50)];

  it("breaks down an intermediate you own none of, and merges resources", () => {
    expect(trackedNeeds("/braton", recipe, own({ "/ferrite": 120 }))).toEqual([
      { unique_name: "/barrelBp", name: "Barrel Blueprint", needed: 1, owned: 0, shortage: 1 },
      { unique_name: "/bp", name: "Braton Prime Blueprint", needed: 1, owned: 0, shortage: 1 },
      { unique_name: "/ferrite", name: "Ferrite", needed: 150, owned: 120, shortage: 30 },
    ]);
  });
  it("compares an owned intermediate as it is", () => {
    const needs = trackedNeeds("/braton", recipe, own({ "/barrel": 1 }));
    expect(needs.map((n) => n.name)).toEqual(["Barrel", "Braton Prime Blueprint", "Ferrite"]);
  });
  it("drops the item itself and merges rows with the same name", () => {
    const quirky = [part("/braton", "Braton Prime"), part("/a/plat", "Plat", 2), part("/b/plat", "Plat", 3)];
    expect(trackedNeeds("/braton", quirky, own({ "/b/plat": 4 }))).toEqual([
      { unique_name: "/a/plat", name: "Plat", needed: 5, owned: 4, shortage: 1 },
    ]);
  });
});

describe("trackedStatus", () => {
  const recipe = [part("/bp", "Blueprint"), part("/ferrite", "Ferrite", 10)];
  it("is owned, ready, covered or none", () => {
    expect(trackedStatus("/x", recipe, [], own({ "/x": 1 }))).toBe("owned");
    expect(trackedStatus("/x", recipe, [], own({ "/bp": 1, "/ferrite": 10 }))).toBe("ready");
    const covered = [{ unique_name: "/ferrite", name: "Ferrite", needed: 10, owned: 10, shortage: 0 }];
    expect(trackedStatus("/x", recipe, covered, own({ "/ferrite": 10 }))).toBe("covered");
    expect(trackedStatus("/x", recipe, [], own({}))).toBe("none");
  });
});

it("lists fissures that match a watch, by tier, with their variant", () => {
  const f = (id: string, tier: string, tierNum: number, missionType: string): WsFissure => ({
    id,
    tier,
    tierNum,
    missionType,
    node: "N",
    enemy: "E",
    expiry: "",
    isStorm: false,
    isHard: false,
    active: true,
  });
  const ws = { fissures: [f("1", "Meso", 2, "Defense"), f("2", "Lith", 1, "Capture")], spFissures: [f("3", "Neo", 3, "Defense")] };
  const watches = [{ id: "w", tier: "Any", missionType: "Defense", variant: "any" as const }];
  expect(watchedFissures(ws, watches).map((m) => [m.fissure.id, m.variant])).toEqual([
    ["1", "normal"],
    ["3", "hard"],
  ]);
  expect(watchedFissures(ws, [])).toEqual([]);
});
