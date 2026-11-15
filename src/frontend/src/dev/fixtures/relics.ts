import type { CatalogItem } from "../../domain/relics";
import type { Fixture } from "./scenario";

/**
 * 40 relics over four eras (more than one page of 30), each with the real
 * 3 common / 2 uncommon / 1 rare layout. Covers owned and unowned relics,
 * vaulted and unvaulted, owned parts, mastered (complete) primes and Forma.
 */

const ERAS = ["Lith", "Meso", "Neo", "Axi"] as const;
const PRIMES = ["Ash", "Braton", "Burston", "Ember", "Frost", "Galatine", "Loki", "Mag", "Nova", "Paris"] as const;
const PARTS = ["Blueprint", "Barrel", "Receiver", "Stock", "Systems Blueprint"] as const;

type RawReward = { itemName: string; chance: number };
type RawRelic = { tier: string; relicName: string; state: string; rewards: RawReward[] };

const relics: RawRelic[] = [];
const items: CatalogItem[] = [];

PRIMES.forEach((prime, p) => {
  items.push({ unique_name: `/Prime/${prime}`, name: `${prime} Prime`, category: "Primary", vaulted: null, ducats: null });
  for (const part of PARTS) {
    items.push({
      unique_name: `/Prime/${prime}/${part}`,
      name: `${prime} Prime ${part}`,
      category: "Misc",
      ducats: 15 + ((p * 7 + part.length) % 6) * 15,
    });
  }
});
items.push({ unique_name: "/Forma", name: "Forma Blueprint", category: "Misc", ducats: null });

ERAS.forEach((era, e) => {
  for (let i = 1; i <= 10; i++) {
    const name = `${String.fromCharCode(65 + ((i + e) % 26))}${String(i)}`;
    const a = PRIMES[(i + e) % PRIMES.length] ?? "Ash";
    const b = PRIMES[(i + e + 3) % PRIMES.length] ?? "Braton";
    const c = PRIMES[(i + e + 6) % PRIMES.length] ?? "Burston";
    relics.push({
      tier: era,
      relicName: name,
      state: "Intact",
      rewards: [
        { itemName: "Forma Blueprint", chance: 25.33 },
        { itemName: `${a} Prime Blueprint`, chance: 25.33 },
        { itemName: `${b} Prime Barrel`, chance: 25.33 },
        { itemName: `${c} Prime Receiver`, chance: 11 },
        { itemName: `${a} Prime Stock`, chance: 11 },
        { itemName: `${b} Prime Systems Blueprint`, chance: 2 },
      ],
    });
    for (const refinement of ["Intact", "Exceptional", "Flawless", "Radiant"]) {
      items.push({
        unique_name: `/Relics/${era}${name}${refinement}`,
        name: `${era} ${name} ${refinement}`,
        category: "Relics",
        vaulted: (i + e) % 3 === 0,
      });
    }
  }
});

/** Some relics in several refinements, a few parts, one complete prime. */
export const RELIC_QUANTITIES: Record<string, number> = {
  "/Relics/LithB1Intact": 4,
  "/Relics/LithB1Radiant": 1,
  "/Relics/LithC2Intact": 2,
  "/Relics/MesoE3Flawless": 3,
  "/Relics/NeoH5Intact": 7,
  "/Relics/AxiJ6Exceptional": 1,
  "/Prime/Braton/Blueprint": 1,
  "/Prime/Loki/Barrel": 1,
};

/** Mastered primes count as complete for their parts. */
export const RELIC_MASTERY: Record<string, number> = { "/Prime/Ember": 30, "/Prime/Ash": 30 };

export const allItems: Fixture<CatalogItem[]> = { default: () => items, empty: () => [] };
export const dropData: Fixture<unknown, { force: boolean }> = { default: () => ({ relics }), empty: () => ({ relics: [] }) };
export const wfmItems: Fixture<Array<{ id: string; item_name: string; url_name: string }>> = {
  default: () =>
    items
      .filter((i) => i.category === "Misc")
      .map((i) => ({ id: i.unique_name, item_name: i.name, url_name: i.name.toLowerCase().replace(/[^a-z0-9]+/g, "_") })),
  empty: () => [],
};
export const wfmPrices: Fixture<Record<string, number | null>> = {
  default: () =>
    Object.fromEntries(
      items
        .filter((i) => i.category === "Misc")
        .map((i, n) => [i.name.toLowerCase().replace(/[^a-z0-9]+/g, "_"), n % 4 === 0 ? null : 3 + ((n * 11) % 40)]),
    ),
  empty: () => ({}),
};
