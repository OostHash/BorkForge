import type { RecipeComponent } from "./foundry";
import type { CatalogItem } from "./relics";

/** Relic reward overlay rules (vault overlay-relic-reward.md). Pure functions. */

export const OVERLAY_PRIORITIES = ["completion", "setPlat", "plat", "ducat"] as const;
export type OverlayPriority = (typeof OVERLAY_PRIORITIES)[number];
export const overlayPriorityFrom = (v: unknown): OverlayPriority =>
  (OVERLAY_PRIORITIES as readonly unknown[]).includes(v) ? (v as OverlayPriority) : "completion";
export const OVERLAY_PRIORITY_LABEL: Readonly<Record<OverlayPriority, string>> = {
  completion: "Item completion",
  setPlat: "Most set value (platinum)",
  plat: "Most platinum (item)",
  ducat: "Most ducats",
};

export type RewardComponent = { unique_name: string; name: string; needed: number; owned: number; plat?: number; ducats?: number };

export type RewardCard = {
  /** Path plus slot index: unique per card. */
  key: string;
  name: string;
  unknown: boolean;
  category?: string;
  vaulted?: boolean;
  ducats?: number;
  plat?: number;
  setName?: string;
  components?: RewardComponent[];
  completeSets?: number;
  missingPlat?: number;
  totalPlat?: number;
};

const STORE = "/Lotus/StoreItems/";
/** Catalogue paths drop the StoreItems segment the game uses. */
export const catalogPath = (path: string) => path.replace(STORE, "/Lotus/");

// ── Set names ───────────────────────────────────────────────────────────────

const FRAME_PARTS = [" Neuroptics Blueprint", " Chassis Blueprint", " Systems Blueprint"];
const PART_SUFFIXES = [
  " Upper Limb",
  " Lower Limb",
  " Receiver",
  " Barrel",
  " Stock",
  " Blade",
  " Handle",
  " Guard",
  " Hilt",
  " Link",
  " Gauntlet",
  " Carapace",
  " Cerebrum",
  " Systems",
  " Head",
  " Strike",
  " Boot",
  " String",
  " Disc",
  " Neuroptics",
  " Chassis",
  " Stars",
];

/** "Rhino Prime Chassis Blueprint" → "Rhino Prime"; null when it is not part of a set. */
export function setNameOf(itemName: string): string | null {
  for (const s of FRAME_PARTS) if (itemName.endsWith(s)) return itemName.slice(0, -s.length);
  for (const s of PART_SUFFIXES) if (itemName.endsWith(s)) return itemName.slice(0, -s.length);
  if (itemName.endsWith(" Blueprint")) {
    const base = itemName.slice(0, -" Blueprint".length);
    for (const s of PART_SUFFIXES) if (base.endsWith(s)) return base.slice(0, -s.length);
    return base;
  }
  return null;
}

/** "Rhino Prime Chassis Blueprint" in set "Rhino Prime" → "Chassis Blueprint". */
export const shortName = (fullName: string, setName: string) => (fullName.startsWith(`${setName} `) ? fullName.slice(setName.length + 1) : fullName);

/** Cell label: the short name without a trailing " Blueprint" (a lone "Blueprint" stays). */
export function cellLabel(fullName: string, setName: string): string {
  const s = shortName(fullName, setName);
  return s !== "Blueprint" && s.endsWith(" Blueprint") ? s.slice(0, -" Blueprint".length) : s;
}

// ── Ownership ───────────────────────────────────────────────────────────────

export type Stock = { quantities: Readonly<Record<string, number>>; crafting: Readonly<Record<string, number>> };

const lookup = (map: Readonly<Record<string, number>>, ...keys: Array<string | undefined>) => {
  for (const k of keys) if (k !== undefined && map[k] !== undefined) return map[k];
  return undefined;
};

/**
 * Copies of a set component you can use: the item itself, its other form
 * (a blueprint ↔ the built part) and Foundry jobs for either.
 */
export function ownedCopies(uniqueName: string, displayName: string, catalog: readonly CatalogItem[], stock: Stock): number {
  const path = catalogPath(uniqueName);
  const entry = catalog.find((c) => catalogPath(c.unique_name) === path) ?? catalog.find((c) => c.name === displayName);
  const entryPath = entry ? catalogPath(entry.unique_name) : path;
  const direct = lookup(stock.quantities, entryPath, entry?.unique_name, path, uniqueName) ?? 0;

  const other = displayName.endsWith(" Blueprint")
    ? catalog.find((c) => c.name === displayName.slice(0, -" Blueprint".length) && c.category === "Parts")
    : catalog.find((c) => c.name === `${displayName} Blueprint` && c.category === "Blueprints");
  const otherPath = other ? catalogPath(other.unique_name) : undefined;
  const alt = other ? (lookup(stock.quantities, otherPath, other.unique_name) ?? 0) : 0;
  const crafting = lookup(stock.crafting, entryPath, path, uniqueName) ?? (otherPath ? (stock.crafting[otherPath] ?? 0) : 0);
  return direct + alt + crafting;
}

/** Foundry jobs per catalogue path. */
export function craftingCounts(jobs: ReadonlyArray<{ unique_name: string }>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const j of jobs) {
    const p = catalogPath(j.unique_name);
    out[p] = (out[p] ?? 0) + 1;
  }
  return out;
}

// ── Cards ───────────────────────────────────────────────────────────────────

/** The built item of a set (not a blueprint or part). */
export const setEntryOf = (setName: string, catalog: readonly CatalogItem[]) =>
  catalog.find((c) => c.name === setName && c.category !== "Blueprints" && c.category !== "Parts");

/** A card per reward path, before prices and set data arrive. "?:text" is unrecognised OCR text. */
export function baseCards(paths: readonly string[], catalog: readonly CatalogItem[]): RewardCard[] {
  return paths.map((path, i) => {
    if (path.startsWith("?:")) return { key: `${path}-${String(i)}`, name: path.slice(2), unknown: true, category: "Unrecognized" };
    const p = catalogPath(path);
    const meta = catalog.find((c) => catalogPath(c.unique_name) === p);
    return {
      key: `${path}-${String(i)}`,
      name: meta?.name ?? path.split("/").pop() ?? path,
      unknown: false,
      ...(meta?.category ? { category: meta.category } : {}),
      ...(meta?.vaulted != null ? { vaulted: meta.vaulted } : {}),
      ...(meta?.ducats != null ? { ducats: meta.ducats } : {}),
    };
  });
}

/**
 * The parts of a set with what you own: from the built item's recipe (parts
 * and blueprints only), else every catalogue part or blueprint named after
 * the set (at least two, one needed each).
 */
export function setComponents(
  setName: string,
  recipe: readonly RecipeComponent[] | undefined,
  catalog: readonly CatalogItem[],
  stock: Stock,
): RewardComponent[] | null {
  const isPart = (uniqueName: string) => {
    const meta = catalog.find((c) => catalogPath(c.unique_name) === catalogPath(uniqueName));
    return meta?.category === "Parts" || meta?.category === "Blueprints";
  };
  const fromRecipe = (recipe ?? []).filter((c) => isPart(c.unique_name));
  if (fromRecipe.length > 0) {
    return fromRecipe.map((c) => {
      const meta = catalog.find((m) => catalogPath(m.unique_name) === catalogPath(c.unique_name));
      return {
        unique_name: c.unique_name,
        name: c.name,
        needed: c.count || 1,
        owned: ownedCopies(c.unique_name, c.name, catalog, stock),
        ...(meta?.ducats != null ? { ducats: meta.ducats } : {}),
      };
    });
  }
  const byPrefix = catalog
    .filter((c) => c.name.startsWith(`${setName} `) && (c.category === "Parts" || c.category === "Blueprints"))
    .map((c) => ({
      unique_name: c.unique_name,
      name: c.name,
      needed: 1,
      owned: ownedCopies(c.unique_name, c.name, catalog, stock),
      ...(c.ducats != null ? { ducats: c.ducats } : {}),
    }));
  return byPrefix.length >= 2 ? byPrefix : null;
}

/** Whole sets you could build; owning the built item counts as at least one. */
export function completeSets(components: readonly RewardComponent[], builtOwned: boolean): number {
  const sets = components.length > 0 ? Math.floor(Math.min(...components.map((c) => c.owned / c.needed))) : 0;
  return builtOwned ? Math.max(sets, 1) : sets;
}

/** Platinum still missing and the whole set's value, from known part prices. */
export function setPlatinum(components: readonly RewardComponent[]): { missing: number; total: number } {
  let missing = 0;
  let total = 0;
  for (const c of components) {
    if (c.plat == null) continue;
    total += c.plat * c.needed;
    if (c.owned < c.needed) missing += c.plat * (c.needed - c.owned);
  }
  return { missing, total };
}

/** Index of the card to pick, or -1 when no card scores above 0. */
export function bestPick(cards: readonly RewardCard[], priority: OverlayPriority): number {
  const score = (card: RewardCard): number => {
    switch (priority) {
      case "plat":
        return card.plat ?? 0;
      case "ducat":
        return card.ducats ?? 0;
      case "setPlat":
        return card.missingPlat ?? card.plat ?? 0;
      case "completion": {
        if (!card.components || !card.setName) return card.plat ?? 0;
        const setName = card.setName;
        const self = card.components.find((c) => shortName(c.name, setName) === shortName(card.name, setName));
        if (!self) return 0;
        const stillNeed = self.needed - self.owned;
        if (stillNeed <= 0) return -1;
        const totalNeeded = card.components.reduce((a, c) => a + Math.max(0, c.needed - c.owned), 0);
        return stillNeed * 100 - totalNeeded;
      }
    }
  };
  let best = -1;
  let bestScore = 0;
  cards.forEach((card, i) => {
    const s = score(card);
    if (s > bestScore) {
      best = i;
      bestScore = s;
    }
  });
  return best;
}

// ── Layout ──────────────────────────────────────────────────────────────────

/** Distance between reward columns as a share of the game width (measured in game). */
export const COLUMN_SPACING = 0.127;

/** Column centres symmetric around the middle, matching the game's slots. */
export function columnCenters(width: number, n: number): number[] {
  const s = width * COLUMN_SPACING;
  const c = width / 2;
  if (n <= 1) return [c];
  if (n === 2) return [c - 0.5 * s, c + 0.5 * s];
  if (n === 3) return [c - s, c, c + s];
  return [c - 1.5 * s, c - 0.5 * s, c + 0.5 * s, c + 1.5 * s];
}

export const cardWidth = (width: number) => Math.max(80, Math.round(width * COLUMN_SPACING - 10));

// ── Window placement ────────────────────────────────────────────────────────

/** The strip as a share of the game window: on trigger, and when rewards arrive first. */
export const STRIP = { trigger: { top: 0.6, height: 0.3 }, rewards: { top: 0.54, height: 0.28 } } as const;

/** Strip bounds in physical pixels; never past the game window's bottom. */
export function stripBounds(
  rect: readonly [number, number, number, number],
  strip: { top: number; height: number },
  scale: number,
): { x: number; y: number; w: number; h: number } {
  const [x, y, w, h] = rect;
  const offset = Math.round(h * strip.top);
  return { x, y: y + offset, w, h: Math.min(Math.round(h * strip.height * scale), h - offset) };
}

// ── Preview ─────────────────────────────────────────────────────────────────

/** What Settings → Overlays → Show draws: the current app's example cards. */
export const PREVIEW_CARDS: readonly RewardCard[] = [
  {
    key: "preview-0",
    name: "Rhino Prime Blueprint",
    unknown: false,
    category: "Blueprints",
    vaulted: true,
    plat: 20,
    ducats: 100,
    setName: "Rhino Prime",
    completeSets: 0,
    totalPlat: 48,
    missingPlat: 32,
    components: [
      { unique_name: "rp-bp", name: "Rhino Prime Blueprint", needed: 1, owned: 0, plat: 20, ducats: 15 },
      { unique_name: "rp-ch", name: "Rhino Prime Chassis Blueprint", needed: 1, owned: 1, plat: 9, ducats: 45 },
      { unique_name: "rp-ne", name: "Rhino Prime Neuroptics Blueprint", needed: 1, owned: 0, plat: 12, ducats: 90 },
      { unique_name: "rp-sy", name: "Rhino Prime Systems Blueprint", needed: 1, owned: 1, plat: 7, ducats: 45 },
    ],
  },
  {
    key: "preview-1",
    name: "Nyx Prime Neuroptics Blueprint",
    unknown: false,
    category: "Blueprints",
    vaulted: true,
    plat: 30,
    ducats: 100,
    setName: "Nyx Prime",
    completeSets: 1,
    totalPlat: 56,
    missingPlat: 0,
    components: [
      { unique_name: "nx-bp", name: "Nyx Prime Blueprint", needed: 1, owned: 1, plat: 9, ducats: 15 },
      { unique_name: "nx-ch", name: "Nyx Prime Chassis Blueprint", needed: 1, owned: 1, plat: 9, ducats: 45 },
      { unique_name: "nx-ne", name: "Nyx Prime Neuroptics Blueprint", needed: 1, owned: 1, plat: 30, ducats: 100 },
      { unique_name: "nx-sy", name: "Nyx Prime Systems Blueprint", needed: 1, owned: 1, plat: 8, ducats: 45 },
    ],
  },
  { key: "preview-2", name: "Glaive Prime Disc", unknown: false, category: "Parts", vaulted: true, plat: 9, ducats: 45 },
  { key: "preview-3", name: "Spira Prime Pouch", unknown: false, category: "Parts", vaulted: true, plat: 35, ducats: 100 },
];

// ── Everything together ─────────────────────────────────────────────────────

export type RewardSources = {
  catalog: readonly CatalogItem[];
  stock: Stock;
  /** Recipe per built set item uniqueName. */
  recipes: ReadonlyMap<string, readonly RecipeComponent[]>;
  /** Platinum by item name; missing while loading or unknown. */
  prices: ReadonlyMap<string, number>;
};

/** Built set items whose recipes the cards need. */
export function setEntryIds(paths: readonly string[], catalog: readonly CatalogItem[]): string[] {
  const ids = new Set<string>();
  for (const card of baseCards(paths, catalog)) {
    const setName = card.unknown ? null : setNameOf(card.name);
    const entry = setName ? setEntryOf(setName, catalog) : undefined;
    if (entry) ids.add(entry.unique_name);
  }
  return [...ids];
}

/** Every item name whose price a card shows: the rewards and their set parts. */
export function priceNames(cards: readonly RewardCard[]): string[] {
  const names = new Set<string>();
  for (const c of cards) {
    if (c.unknown) continue;
    names.add(c.name);
    for (const part of c.components ?? []) names.add(part.name);
  }
  return [...names];
}

/** The cards with prices, set parts, ownership and set value, from what is loaded so far. */
export function rewardCards(paths: readonly string[], src: RewardSources): RewardCard[] {
  return baseCards(paths, src.catalog).map((card) => {
    if (card.unknown) return card;
    const plat = src.prices.get(card.name);
    const withPrice = plat !== undefined ? { ...card, plat } : card;
    const setName = setNameOf(card.name);
    if (!setName) return withPrice;
    const entry = setEntryOf(setName, src.catalog);
    const parts = setComponents(setName, entry ? src.recipes.get(entry.unique_name) : undefined, src.catalog, src.stock);
    if (!parts) return withPrice;
    const priced = parts.map((p) => {
      const price = src.prices.get(p.name);
      return price !== undefined ? { ...p, plat: price } : p;
    });
    const builtOwned = entry ? (lookup(src.stock.quantities, catalogPath(entry.unique_name), entry.unique_name) ?? 0) > 0 : false;
    const { missing, total } = setPlatinum(priced);
    return { ...withPrice, setName, components: priced, completeSets: completeSets(priced, builtOwned), missingPlat: missing, totalPlat: total };
  });
}
