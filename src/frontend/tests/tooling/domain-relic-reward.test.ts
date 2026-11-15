import { describe, expect, it } from "vitest";
import type { RecipeComponent } from "../../src/domain/foundry";
import type { CatalogItem } from "../../src/domain/relics";
import {
  bestPick,
  cardWidth,
  cellLabel,
  columnCenters,
  completeSets,
  craftingCounts,
  ownedCopies,
  overlayPriorityFrom,
  PREVIEW_CARDS,
  rewardCards,
  setComponents,
  setNameOf,
  setPlatinum,
  stripBounds,
  type RewardCard,
  type Stock,
} from "../../src/domain/relicReward";

const CAT: CatalogItem[] = [
  { unique_name: "/Lotus/Powersuits/RhinoPrime", name: "Rhino Prime", category: "Warframes" },
  { unique_name: "/Lotus/Recipes/RhinoPrimeBlueprint", name: "Rhino Prime Blueprint", category: "Blueprints", ducats: 15 },
  { unique_name: "/Lotus/Recipes/RhinoPrimeChassisBlueprint", name: "Rhino Prime Chassis Blueprint", category: "Blueprints", ducats: 45 },
  { unique_name: "/Lotus/Parts/RhinoPrimeChassis", name: "Rhino Prime Chassis", category: "Parts" },
  { unique_name: "/Lotus/Recipes/RhinoPrimeSystemsBlueprint", name: "Rhino Prime Systems Blueprint", category: "Blueprints" },
  { unique_name: "/Lotus/Misc/OrokinCell", name: "Orokin Cell", category: "Resources" },
];
const stock = (quantities: Record<string, number> = {}, crafting: Record<string, number> = {}): Stock => ({ quantities, crafting });
const part = (unique_name: string, name: string, count = 1) =>
  ({ unique_name, name, count, result_count: 1, components: [] }) as unknown as RecipeComponent;

describe("set names", () => {
  it.each([
    ["Rhino Prime Chassis Blueprint", "Rhino Prime"],
    ["Rhino Prime Blueprint", "Rhino Prime"],
    ["Glaive Prime Disc", "Glaive Prime"],
    ["Braton Prime Barrel Blueprint", "Braton Prime"],
    ["Orokin Cell", null],
  ])("%s → %s", (name, set) => {
    expect(setNameOf(name)).toBe(set);
  });
  it("labels cells without the set name or a trailing Blueprint", () => {
    expect(cellLabel("Rhino Prime Chassis Blueprint", "Rhino Prime")).toBe("Chassis");
    expect(cellLabel("Rhino Prime Blueprint", "Rhino Prime")).toBe("Blueprint");
  });
});

describe("ownedCopies", () => {
  it("counts the item, its other form and Foundry jobs, across StoreItems paths", () => {
    const s = stock(
      { "/Lotus/Recipes/RhinoPrimeChassisBlueprint": 1, "/Lotus/Parts/RhinoPrimeChassis": 1 },
      { "/Lotus/Recipes/RhinoPrimeChassisBlueprint": 1 },
    );
    expect(ownedCopies("/Lotus/StoreItems/Recipes/RhinoPrimeChassisBlueprint", "Rhino Prime Chassis Blueprint", CAT, s)).toBe(3);
  });
  it("is 0 for what you do not have", () => {
    expect(ownedCopies("/Lotus/Recipes/RhinoPrimeSystemsBlueprint", "Rhino Prime Systems Blueprint", CAT, stock())).toBe(0);
  });
  it("counts Foundry jobs by catalogue path", () => {
    expect(craftingCounts([{ unique_name: "/Lotus/StoreItems/A" }, { unique_name: "/Lotus/A" }])).toEqual({ "/Lotus/A": 2 });
  });
});

describe("set components", () => {
  it("come from the recipe, parts and blueprints only", () => {
    const recipe = [part("/Lotus/Recipes/RhinoPrimeBlueprint", "Rhino Prime Blueprint"), part("/Lotus/Misc/OrokinCell", "Orokin Cell", 2)];
    expect(setComponents("Rhino Prime", recipe, CAT, stock())?.map((c) => c.name)).toEqual(["Rhino Prime Blueprint"]);
  });
  it("fall back to catalogue parts named after the set", () => {
    expect(setComponents("Rhino Prime", undefined, CAT, stock())?.map((c) => c.name)).toEqual([
      "Rhino Prime Blueprint",
      "Rhino Prime Chassis Blueprint",
      "Rhino Prime Chassis",
      "Rhino Prime Systems Blueprint",
    ]);
    expect(setComponents("Nova Prime", undefined, CAT, stock())).toBeNull();
  });
  it("count complete sets, with an owned built item as at least one", () => {
    const comps = [
      { unique_name: "a", name: "A", needed: 1, owned: 2 },
      { unique_name: "b", name: "B", needed: 2, owned: 2 },
    ];
    expect(completeSets(comps, false)).toBe(1);
    expect(completeSets([{ unique_name: "a", name: "A", needed: 1, owned: 0 }], true)).toBe(1);
  });
  it("add up missing and total platinum from known prices", () => {
    expect(
      setPlatinum([
        { unique_name: "a", name: "A", needed: 2, owned: 1, plat: 10 },
        { unique_name: "b", name: "B", needed: 1, owned: 0 },
      ]),
    ).toEqual({ missing: 10, total: 20 });
  });
});

describe("bestPick", () => {
  const card = (extra: Partial<RewardCard>): RewardCard => ({ key: "k", name: "X", unknown: false, ...extra });
  it("follows the priority", () => {
    const cards = [card({ plat: 5, ducats: 100 }), card({ plat: 30, ducats: 15 })];
    expect(bestPick(cards, "plat")).toBe(1);
    expect(bestPick(cards, "ducat")).toBe(0);
    expect(bestPick([card({ plat: 5, missingPlat: 50 }), card({ plat: 30 })], "setPlat")).toBe(0);
  });
  it("on completion prefers the part you still need most", () => {
    expect(bestPick(PREVIEW_CARDS, "completion")).toBe(0);
  });
  it("picks nothing when every score is 0 or less", () => {
    expect(bestPick([card({}), card({ plat: 0 })], "plat")).toBe(-1);
  });
  it("reads the priority setting", () => {
    expect(overlayPriorityFrom("ducat")).toBe("ducat");
    expect(overlayPriorityFrom("bogus")).toBe("completion");
  });
});

describe("layout", () => {
  it("places columns like the game's slots", () => {
    expect(columnCenters(1000, 1)).toEqual([500]);
    expect(columnCenters(1000, 2)).toEqual([436.5, 563.5]);
    expect(columnCenters(1000, 4)).toEqual([309.5, 436.5, 563.5, 690.5]);
    expect(cardWidth(1920)).toBe(234);
    expect(cardWidth(400)).toBe(80);
  });
  it("puts the strip over the game, never past its bottom", () => {
    expect(stripBounds([100, 50, 1920, 1080], { top: 0.6, height: 0.3 }, 1)).toEqual({ x: 100, y: 698, w: 1920, h: 324 });
    expect(stripBounds([0, 0, 1920, 1080], { top: 0.6, height: 0.3 }, 2)).toEqual({ x: 0, y: 648, w: 1920, h: 432 });
  });
});

it("builds cards with prices, set parts and set value", () => {
  const cards = rewardCards(["/Lotus/StoreItems/Recipes/RhinoPrimeChassisBlueprint", "?:Mystery"], {
    catalog: CAT,
    stock: stock({ "/Lotus/Recipes/RhinoPrimeBlueprint": 1 }),
    recipes: new Map(),
    prices: new Map([
      ["Rhino Prime Chassis Blueprint", 9],
      ["Rhino Prime Blueprint", 20],
    ]),
  });
  expect(cards[0]).toMatchObject({
    name: "Rhino Prime Chassis Blueprint",
    plat: 9,
    ducats: 45,
    setName: "Rhino Prime",
    completeSets: 0,
    totalPlat: 29,
    missingPlat: 9,
  });
  expect(cards[1]).toMatchObject({ name: "Mystery", unknown: true, category: "Unrecognized" });
});
