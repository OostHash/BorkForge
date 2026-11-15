import type { ChangeEntry, InventoryCatalogItem, ModCounts } from "../../domain/inventory";
import type { Fixture } from "./scenario";

/**
 * Inventory extras on top of the relic catalogue: resources, mods, frames
 * and weapons with recent changes, mod ranks, a Foundry job and prices.
 */
export const INVENTORY_ITEMS: InventoryCatalogItem[] = [
  { unique_name: "/Res/Ferrite", name: "Ferrite", category: "Resources" },
  { unique_name: "/Res/Plastids", name: "Plastids", category: "Resources" },
  { unique_name: "/Res/OrokinCell", name: "Orokin Cell", category: "Resources" },
  { unique_name: "/Mods/Serration", name: "Serration", category: "Mods", tradeable_wfm: true },
  { unique_name: "/Mods/Vitality", name: "Vitality", category: "Mods" },
  { unique_name: "/Arcanes/Energize", name: "Arcane Energize", category: "Arcanes" },
  { unique_name: "/Frames/Excalibur", name: "Excalibur", category: "Warframes" },
  { unique_name: "/Frames/Rhino", name: "Rhino", category: "Warframes" },
  { unique_name: "/Weapons/Soma", name: "Soma", category: "Primary" },
  { unique_name: "/Weapons/Lato", name: "Lato", category: "Secondary" },
  { unique_name: "/Generic/Blueprint", name: "Blueprint", category: "Blueprints" },
];

export const INVENTORY_QUANTITIES: Record<string, number> = {
  "/Res/Ferrite": 12_450,
  "/Res/Plastids": 830,
  "/Res/OrokinCell": 14,
  "/Mods/Serration": 3,
  "/Mods/Vitality": 1,
  "/Arcanes/Energize": 2,
  "/Frames/Excalibur": 1,
  "/Weapons/Soma": 1,
};

export const INVENTORY_MASTERY: Record<string, number> = { "/Frames/Excalibur": 30, "/Weapons/Soma": 22 };

export const MOD_COUNTS: ModCounts = {
  "/Mods/Serration": { total: 3, by_rank: { "0": 1, "5": 1, "10": 1 } },
  "/Mods/Vitality": { total: 1, by_rank: { "10": 1 } },
  "/Arcanes/Energize": { total: 2, by_rank: { "0": 1, "5": 1 } },
};

export const CRAFTING = [{ unique_name: "/Weapons/Lato", item_name: "Lato", completion_ms: Date.now() + 3_600_000 }];

const now = () => Math.floor(Date.now() / 1000);

export const changeLog: Fixture<ChangeEntry[], { limit: number }> = {
  default: () => [
    { id: 41, unique_name: "/Res/Ferrite", item_name: "Ferrite", old_qty: 12_400, new_qty: 12_650, delta: 250, timestamp: now() - 60 },
    { id: 40, unique_name: "/Res/OrokinCell", item_name: "Orokin Cell", old_qty: 14, new_qty: 12, delta: -2, timestamp: now() - 63 },
    { id: 39, unique_name: "/Mods/Serration", item_name: "Serration", old_qty: 1, new_qty: 2, delta: 1, timestamp: now() - 900, rank: 10 },
    { id: 38, unique_name: "/Res/Plastids", item_name: "Plastids", old_qty: 870, new_qty: 900, delta: 30, timestamp: now() - 7200 },
  ],
  empty: () => [],
};

export const bulkPrices: Fixture<Record<string, number>> = {
  default: () => ({ serration: 12, "arcane energize": 45, "ash prime systems blueprint": 18, "braton prime blueprint": 6 }),
  empty: () => ({}),
};

export const itemListStatus: Fixture<{ count: number; recipe_count: number }> = {
  default: () => ({ count: 18_342, recipe_count: 2_114 }),
  empty: () => ({ count: 0, recipe_count: 0 }),
};
