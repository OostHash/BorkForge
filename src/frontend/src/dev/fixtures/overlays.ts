import type { CatalogItem } from "../../domain/relics";
import type { OcrRiven } from "../../domain/rivenOverlay";
import { noResult } from "./market";
import type { Fixture } from "./scenario";

/** A small prime catalogue for the relic reward overlay (paths use the catalogue form). */
export const OVERLAY_CATALOG: CatalogItem[] = [
  { unique_name: "/Lotus/Powersuits/Rhino/RhinoPrime", name: "Rhino Prime", category: "Warframes", vaulted: true },
  {
    unique_name: "/Lotus/Types/Recipes/WarframeRecipes/RhinoPrimeBlueprint",
    name: "Rhino Prime Blueprint",
    category: "Blueprints",
    vaulted: true,
    ducats: 15,
  },
  {
    unique_name: "/Lotus/Types/Recipes/WarframeRecipes/RhinoPrimeChassisBlueprint",
    name: "Rhino Prime Chassis Blueprint",
    category: "Blueprints",
    vaulted: true,
    ducats: 45,
  },
  {
    unique_name: "/Lotus/Types/Recipes/WarframeRecipes/RhinoPrimeHelmetBlueprint",
    name: "Rhino Prime Neuroptics Blueprint",
    category: "Blueprints",
    vaulted: true,
    ducats: 100,
  },
  {
    unique_name: "/Lotus/Types/Recipes/WarframeRecipes/RhinoPrimeSystemsBlueprint",
    name: "Rhino Prime Systems Blueprint",
    category: "Blueprints",
    vaulted: true,
    ducats: 45,
  },
  { unique_name: "/Lotus/Types/Items/MiscItems/OrokinCell", name: "Orokin Cell", category: "Resources" },
  {
    unique_name: "/Lotus/Weapons/Tenno/Melee/Glaive/PrimeGlaive/PrimeGlaiveDisc",
    name: "Glaive Prime Disc",
    category: "Parts",
    vaulted: true,
    ducats: 45,
  },
  { unique_name: "/Lotus/Types/Items/MiscItems/Forma", name: "Forma Blueprint", category: "Blueprints", ducats: 0 },
];

export const OVERLAY_PRICES: Record<string, number> = {
  "Rhino Prime Blueprint": 20,
  "Rhino Prime Chassis Blueprint": 9,
  "Rhino Prime Neuroptics Blueprint": 12,
  "Rhino Prime Systems Blueprint": 7,
  "Glaive Prime Disc": 9,
};

export const overlayFixtures = {
  get_warframe_window_rect: { alwaysDefault: true, default: () => [0, 0, 1920, 1080] } satisfies Fixture<[number, number, number, number]>,
  show_overlay_window: noResult<{ x: number; y: number; w: number; h: number }>(),
  move_overlay_offscreen: noResult(),
  get_pending_relic_rewards: { alwaysDefault: true, default: () => null } satisfies Fixture<{ items: string[]; positions: number[] } | null>,
  get_items_by_paths: { default: () => OVERLAY_CATALOG, empty: () => [] } satisfies Fixture<CatalogItem[], { paths: string[] }>,
  get_item_price: { default: ({ itemName }) => OVERLAY_PRICES[itemName] ?? null, empty: () => null } satisfies Fixture<
    number | null,
    { itemName: string }
  >,
  get_current_crafting: { default: () => [], empty: () => [] } satisfies Fixture<
    Array<{ unique_name: string; item_name: string; completion_ms: number }>
  >,
  set_overlays_enabled: noResult<{ enabled: boolean }>(),
  set_relic_pick_enabled: noResult<{ enabled: boolean }>(),
  set_overlay_key: noResult<{ vk: number }>(),
  ocr_riven_screen: {
    default: () => ({
      weapon: "soma",
      positives: ["Critical Chance", "Critical Damage"],
      negatives: ["Zoom"],
      rolled_stats: [
        { name: "Critical Chance", value: "+120%", positive: true },
        { name: "Critical Damage", value: "+95%", positive: true },
        { name: "Zoom", value: "-30%", positive: false },
      ],
      is_comparison: false,
      original_rolled_stats: [],
      raw: "SOMA\n+120% Critical Chance",
    }),
  } satisfies Fixture<OcrRiven>,
  ocr_riven_log_error: noResult<{ error: string }>(),
  log_relic_fe: noResult<{ msg: string }>(),
  show_relic_pick_window: noResult(),
};
