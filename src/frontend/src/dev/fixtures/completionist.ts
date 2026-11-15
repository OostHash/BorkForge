import type { SyndicateItem, SyndicateStore, WeaponItem } from "../../domain/completionist";
import type { Fixture } from "./scenario";

/**
 * Syndicates, labs and weapons covering every status: complete, blueprint,
 * Helminth (subsumed) and missing; weapons in several families, with and
 * without a level cap above 30. No image names, so the fallback is used and
 * screenshots never depend on the network.
 */

const item = (unique_name: string, name: string, category: string, tier: string, extra: Partial<SyndicateItem> = {}): SyndicateItem => ({
  unique_name,
  name,
  category,
  tier,
  owned: 0,
  result_owned: 0,
  ...extra,
});

export const OWNED_QUANTITIES: Record<string, number> = {
  "/Mods/Syndicate/Meridian/Battle": 1,
  "/Mods/Syndicate/Meridian/Sigil": 1,
  "/Weapons/Meridian/VaykorHekBP": 1,
  "/Weapons/Meridian/VaykorMarelok": 1,
  "/Mods/Syndicate/Ostron/Plate": 1,
  "/Lab/Tenno/Banshee": 1,
  "/Weapons/Primary/Braton": 1,
  "/Weapons/Primary/BratonPrime": 1,
};

export const MASTERY: Record<string, number> = {
  "/Weapons/Primary/Braton": 30,
  "/Weapons/Primary/BratonPrime": 30,
  "/Weapons/Primary/KuvaBramma": 34,
  "/Weapons/Primary/Soma": 12,
  "/Weapons/Secondary/Lato": 30,
  "/Weapons/Ostron/Melee/Plague": 30,
};

export const CONSUMED_SUITS = ["/Warframes/Rhino"];

const syndicates: SyndicateStore[] = [
  {
    name: "Steel Meridian",
    items: [
      item("/Mods/Syndicate/Meridian/Battle", "Scattered Justice", "Mods", "Brave"),
      item("/Mods/Syndicate/Meridian/Sigil", "Steel Meridian Sigil", "Sigils", "Brave"),
      item("/Weapons/Meridian/VaykorHekBP", "Vaykor Hek Blueprint", "Primary", "General", { result_unique: "/Weapons/Meridian/VaykorHek" }),
      item("/Weapons/Meridian/VaykorMarelokBP", "Vaykor Marelok Blueprint", "Secondary", "General", {
        result_unique: "/Weapons/Meridian/VaykorMarelok",
      }),
      item("/Mods/Syndicate/Meridian/Justice", "Justice Blades", "Mods", "Valiant"),
      item("/Mods/Syndicate/Meridian/Vigorous", "Vigorous Swap", "Mods", "Defender"),
    ],
  },
  {
    name: "Arbiters of Hexis",
    items: [
      item("/Mods/Syndicate/Arbiters/Truth", "Gilded Truth", "Mods", "Principled"),
      item("/Weapons/Arbiters/TelosBoltorBP", "Telos Boltor Blueprint", "Primary", "Maxim", { result_unique: "/Weapons/Arbiters/TelosBoltor" }),
    ],
  },
  {
    name: "Ostron",
    items: [
      item("/Mods/Syndicate/Ostron/Plate", "Fish Plate", "Misc", "Visitor"),
      item("/Mods/Syndicate/Ostron/Zaw", "Zaw Strike", "Melee", "Trusted"),
    ],
  },
  {
    name: "Solaris United",
    items: [item("/Solaris/Amp", "Amp Prism", "Amps", "Outworlder")],
  },
];

const labs: SyndicateStore[] = [
  {
    name: "Tenno Lab",
    items: [
      item("/Lab/Tenno/BansheeBP", "Banshee Blueprint", "Warframes", "Warframes", { result_unique: "/Lab/Tenno/Banshee" }),
      item("/Lab/Tenno/RhinoBP", "Rhino Blueprint", "Warframes", "Warframes", { result_unique: "/Warframes/Rhino" }),
      item("/Lab/Tenno/Glaive", "Glaive", "Melee", "Melee"),
    ],
  },
];

const weapons: WeaponItem[] = [
  { unique_name: "/Weapons/Primary/Braton", name: "Braton", category: "Primary" },
  { unique_name: "/Weapons/Primary/BratonPrime", name: "Braton Prime", category: "Primary", mastery_req: 8 },
  { unique_name: "/Weapons/Primary/KuvaBramma", name: "Kuva Bramma", category: "Primary", mastery_req: 13, max_level_cap: 40 },
  { unique_name: "/Weapons/Primary/Soma", name: "Soma", category: "Primary", mastery_req: 6 },
  { unique_name: "/Weapons/Primary/Tenet", name: "Tenet Arca Plasmor", category: "Primary", mastery_req: 14, max_level_cap: 40 },
  { unique_name: "/Weapons/Secondary/Lato", name: "Lato", category: "Secondary" },
  { unique_name: "/Weapons/Secondary/LatoVandal", name: "Lato Vandal", category: "Secondary" },
  { unique_name: "/Weapons/Ostron/Melee/Plague", name: "Plague Kripath", category: "Melee" },
  { unique_name: "/Weapons/Melee/Skana", name: "Skana", category: "Melee" },
  { unique_name: "/Weapons/Operator/Amp", name: "Sirocco", category: "Operator Weapons" },
];

export const syndicateStores: Fixture<SyndicateStore[]> = { default: () => syndicates, empty: () => [] };
export const researchLabStores: Fixture<SyndicateStore[]> = { default: () => labs, empty: () => [] };
export const weaponCatalog: Fixture<WeaponItem[]> = { default: () => weapons, empty: () => [] };
export const savedInventory: Fixture<{ consumedSuits: string[] }> = {
  default: () => ({ consumedSuits: CONSUMED_SUITS }),
  empty: () => ({ consumedSuits: [] }),
};
