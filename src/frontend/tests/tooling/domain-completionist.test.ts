import { describe, expect, it } from "vitest";
import {
  groupByTier,
  itemStatus,
  maxRank,
  rankNumber,
  splitTier,
  SYNDICATE_META,
  weaponGroup,
  weaponView,
  type Ownership,
  type SyndicateItem,
  type WeaponItem,
} from "../../src/domain/completionist.ts";
import { domainColors } from "../../src/theme/domain.ts";

const own = (o: Partial<Ownership> = {}): Ownership => ({ quantities: {}, mastery: {}, subsumed: new Set(), ...o });
const item = (i: Partial<SyndicateItem>): SyndicateItem => ({
  unique_name: "/x",
  name: "X",
  category: "Mods",
  tier: "Brave",
  owned: 0,
  result_owned: 0,
  ...i,
});

describe("itemStatus", () => {
  it("mods and parts: complete when owned", () => {
    expect(itemStatus(item({}), own())).toBe("none");
    expect(itemStatus(item({}), own({ quantities: { "/x": 1 } }))).toBe("complete");
    expect(itemStatus(item({ owned: 1 }), own())).toBe("complete");
  });

  it("blueprints: complete when the result is owned, blueprint when only the blueprint is", () => {
    const bp = item({ unique_name: "/bp", result_unique: "/frame" });
    expect(itemStatus(bp, own({ quantities: { "/frame": 1 } }))).toBe("complete");
    expect(itemStatus(bp, own({ quantities: { "/bp": 1 } }))).toBe("blueprint");
    expect(itemStatus(bp, own({ subsumed: new Set(["/frame"]) }))).toBe("subsumed");
  });

  it("live quantity overrides the backend's owned value", () => {
    expect(itemStatus(item({ owned: 1 }), own({ quantities: { "/x": 0 } }))).toBe("none");
  });
});

describe("groupByTier", () => {
  const store = {
    name: "Steel Meridian",
    items: [
      item({ unique_name: "/b", name: "Beta", tier: "Valiant" }),
      item({ unique_name: "/a", name: "Alpha", tier: "Brave", category: "Sigil" }),
      item({ unique_name: "/c", name: "Gamma", tier: "Mystery" }),
    ],
  };

  it("follows the tier order with unknown tiers last", () => {
    expect(groupByTier(store, own(), { search: "", missingOnly: false }).map((g) => g.tier)).toEqual(["Brave", "Valiant", "Mystery"]);
  });

  it("searches name and category and hides complete items", () => {
    expect(groupByTier(store, own(), { search: "sigil", missingOnly: false }).map((g) => g.tier)).toEqual(["Brave"]);
    expect(groupByTier(store, own({ quantities: { "/a": 1 } }), { search: "", missingOnly: true }).map((g) => g.tier)).toEqual([
      "Valiant",
      "Mystery",
    ]);
  });
});

describe("merchant tiers", () => {
  it("splits open-world tiers into merchant and rank", () => {
    expect(splitTier("(Old Man Suumbaat), Offworlder")).toEqual({ merchant: "Old Man Suumbaat", rank: "Offworlder" });
    expect(splitTier("Brave")).toEqual({ merchant: null, rank: "Brave" });
  });

  it("groups by merchant in store order, then rank order", () => {
    const ostron = {
      name: "Ostron",
      items: [
        item({ unique_name: "/1", tier: "(Hok), Trusted" }),
        item({ unique_name: "/2", tier: "(Fisher Hai-Luk), Neutral" }),
        item({ unique_name: "/3", tier: "(Hok), Neutral" }),
      ],
    };
    const groups = groupByTier(ostron, own(), { search: "", missingOnly: false });
    expect(groups.map((g) => [g.merchant, g.rank])).toEqual([
      ["Hok", "Neutral"],
      ["Hok", "Trusted"],
      ["Fisher Hai-Luk", "Neutral"],
    ]);
  });
});

describe("rankNumber", () => {
  it("counts from Neutral = 0 or from the first rank = 1, and skips labs", () => {
    expect(rankNumber("Ostron", "Neutral")).toBe(0);
    expect(rankNumber("Ostron", "Kin")).toBe(5);
    expect(rankNumber("Steel Meridian", "Brave")).toBe(1);
    expect(rankNumber("Steel Meridian", "General")).toBe(5);
    expect(rankNumber("Tenno Lab", "Warframes")).toBeNull();
    expect(rankNumber("Steel Meridian", "Mystery")).toBeNull();
  });

  it("files New Loka's stray Exalted item under Flawless", () => {
    const store = { name: "New Loka", items: [item({ unique_name: "/h", tier: "Exalted" })] };
    expect(groupByTier(store, own(), { search: "", missingOnly: false }).map((g) => g.rank)).toEqual(["Flawless"]);
  });
});

describe("syndicate tones", () => {
  it("every syndicate colour exists as a domain colour", () => {
    for (const meta of Object.values(SYNDICATE_META)) expect(Object.hasOwn(domainColors, meta.tone), meta.tone).toBe(true);
  });
});

const weapon = (w: Partial<WeaponItem>): WeaponItem => ({ unique_name: "/w", name: "Braton", category: "Primary", ...w });

describe("weapons", () => {
  it("groups by family", () => {
    expect(weaponGroup(weapon({ name: "Kuva Bramma" }))).toBe("Kuva");
    expect(weaponGroup(weapon({ name: "Braton Prime" }))).toBe("Prime");
    expect(weaponGroup(weapon({ name: "Plague Kripath", unique_name: "/Lotus/Weapons/Ostron/Melee/Tip" }))).toBe("Zaw");
    expect(weaponGroup(weapon({ name: "MK1-Braton" }))).toBe("MK1");
  });

  it("uses the catalogue cap, else 30", () => {
    expect(maxRank(weapon({ max_level_cap: 40 }))).toBe(40);
    expect(maxRank(weapon({}))).toBe(30);
    expect(maxRank(weapon({ category: "Arch-Gun" }))).toBe(0);
  });

  it("counts progress before filtering", () => {
    const list = [weapon({ unique_name: "/a", name: "Braton" }), weapon({ unique_name: "/b", name: "Kuva Bramma", max_level_cap: 40 })];
    const view = weaponView(list, "Primary", { "/a": 30, "/b": 30 }, { search: "", unmasteredOnly: true });
    expect(view).toMatchObject({ mastered: 1, total: 2 });
    expect(view.groups.map((g) => g.group)).toEqual(["Kuva"]);
  });
});
