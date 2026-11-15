import { describe, expect, it } from "vitest";
import {
  auctionAttributes,
  auctionPrices,
  challengeText,
  groupRivens,
  polarityName,
  rivenCategory,
  rivenModName,
  rollLabel,
  splitSigns,
  statContext,
  statLabel,
  toggleCompare,
  toggleRollStat,
  toWfmSlug,
  verdictLevel,
  verdictShort,
  veiledSlug,
  weaponSuggestions,
  wfmValue,
  type OwnedRiven,
} from "../../src/domain/rivens.ts";

const MAX = 0x3fffffff;
const soma: OwnedRiven = {
  item_id: "1",
  item_type: "/Lotus/Upgrades/Mods/Randomized/LotusRifleRandomModRare",
  mod_name: "",
  riven_state: "unlocked",
  compat: "/Weapons/Soma",
  challenge_type: null,
  challenge_complication: null,
  lvl_req: 12,
  polarity: "AP_ATTACK",
  buffs: [
    { tag: "WeaponCritDamageMod", value: Math.round(MAX * 0.8) },
    { tag: "WeaponFireIterationsMod", value: Math.round(MAX * 0.6) },
  ],
  curses: [{ tag: "WeaponZoomFovMod", value: Math.round(MAX * 0.4) }],
  mod_rank: 8,
  count: 1,
  rerolls: 14,
};

describe("analyzer helpers", () => {
  it("suggests up to eight weapons containing the text", () => {
    const list = Array.from({ length: 12 }, (_, i) => `soma ${String(i)}`);
    expect(weaponSuggestions(list, " SOMA ")).toHaveLength(8);
    expect(weaponSuggestions(["soma", "lato"], "at")).toEqual(["lato"]);
    expect(weaponSuggestions(["soma"], "")).toEqual([]);
  });

  it("adds stats as positive, faction damage as a multiplier", () => {
    const one = toggleRollStat([], "Damage to Grineer");
    expect(one).toEqual([{ name: "Damage to Grineer", value: "", positive: true, useMultiplier: true }]);
    expect(toggleRollStat(one, "Damage to Grineer")).toEqual([]);
    expect(
      splitSigns([
        { name: "A", value: "", positive: true },
        { name: "B", value: "", positive: false },
      ]),
    ).toEqual({ positives: ["A"], negatives: ["B"] });
  });

  it("reads verdicts and labels rolls", () => {
    expect(verdictLevel("GREAT — sell")).toBe("great");
    expect(verdictLevel("MEDIOCRE — reroll")).toBe("mediocre");
    expect(verdictLevel("Unknown")).toBe("bad");
    expect(verdictShort("GOOD — usable")).toBe("GOOD");
    expect(rollLabel("soma prime", new Date(2026, 10, 13))).toBe("Soma prime · 13 Nov 2026");
  });

  it("compares at most two rolls", () => {
    const two = toggleCompare(toggleCompare(new Set(), "a"), "b");
    expect([...toggleCompare(two, "c")]).toEqual(["a", "b"]);
    expect([...toggleCompare(two, "a")]).toEqual(["b"]);
  });
});

describe("owned rivens", () => {
  it("groups by state; a riven without state but with a weapon counts as unlocked", () => {
    const g = groupRivens([soma, { ...soma, riven_state: null }, { ...soma, riven_state: "revealed" }, { ...soma, riven_state: "unrevealed" }]);
    expect([g.unlocked.length, g.revealed.length, g.unrevealed.length]).toEqual([2, 1, 1]);
  });

  it("maps item types to categories and veiled slugs", () => {
    expect(rivenCategory("/x/LotusPistolRandomModRare")).toBe("Pistol");
    expect(rivenCategory("/x/LotusArchgunRandomModRare")).toBe("Arch-gun");
    expect(veiledSlug("Arch-gun")).toBe("archgun_riven_mod");
    expect(veiledSlug("Riven")).toBeNull();
  });

  it("names a riven from its buffs", () => {
    expect(rivenModName(soma)).toBe("acrican");
    const three = { ...soma, buffs: [...soma.buffs, { tag: "WeaponCritChanceMod", value: Math.round(MAX * 0.7) }] };
    expect(rivenModName(three)).toBe("acri-critacan");
    expect(rivenModName({ ...soma, mod_name: "visi-tron" })).toBe("visi-tron");
  });

  it("computes stats with the riven formula", () => {
    const ctx = statContext(soma, 0.65);
    expect(statLabel(soma.buffs[0] ?? { tag: "", value: 0 }, true, ctx)).toBe("+102.3% Critical Damage");
    expect(statLabel(soma.curses[0] ?? { tag: "", value: 0 }, false, ctx)).toBe("-18.9% Zoom");
    const grineer = { tag: "WeaponFactionDamageGrineer", value: Math.round(MAX * 0.3) };
    expect(statLabel(grineer, true, { disposition: 1.45, category: "Pistol", buffs: 3, curses: 0, rank: 8 })).toBe("x1.47 Damage to Grineer");
    expect(wfmValue(grineer, true, { disposition: 1.45, category: "Pistol", buffs: 3, curses: 0, rank: 8 })).toBe(1.47);
  });

  it("builds auction attributes and counts unmapped stats", () => {
    const { attributes, unmapped } = auctionAttributes(soma, 0.65);
    expect(attributes.map((a) => [a.url_name, a.positive, a.value])).toEqual([
      ["critical_damage", true, 102.3],
      ["multishot", true, 73.8],
      ["zoom", false, -18.9],
    ]);
    expect(unmapped).toBe(0);
    expect(auctionAttributes({ ...soma, curses: [...soma.curses, { tag: "Unknown", value: 1 }] }, 0.65).unmapped).toBe(1);
  });

  it("explains challenges and polarities", () => {
    expect(challengeText("/Lotus/Types/Challenges/RandomizedHeadshot", "/Lotus/Types/Challenges/Complications/Sliding")).toBe(
      "Kill X enemies with Headshots, while sliding",
    );
    expect(challengeText("/Lotus/Types/Challenges/NewThing", null)).toBe("New Thing");
    expect(challengeText(null, null)).toBe("Unknown challenge");
    expect(polarityName("AP_TACTIC")).toBe("Naramon");
  });

  it("makes warframe.market slugs and validates prices", () => {
    expect(toWfmSlug("Kuva Bramma's & Co")).toBe("kuva_brammas_and_co");
    expect(auctionPrices({ type: "auction", start: "100", buyout: "50", direct: "", minRep: "" })).toEqual({
      error: "Buyout price must be at least the starting price.",
    });
    expect(auctionPrices({ type: "auction", start: "100", buyout: "", direct: "", minRep: "2" })).toEqual({ start: 100, buyout: null, minRep: 2 });
    expect(auctionPrices({ type: "direct", start: "", buyout: "", direct: "150", minRep: "5" })).toEqual({ start: 150, buyout: 150, minRep: 0 });
    expect(auctionPrices({ type: "direct", start: "", buyout: "", direct: "0", minRep: "" })).toEqual({
      error: "Selling price must be at least 1 platinum.",
    });
  });
});
