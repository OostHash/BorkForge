/** Relic pick overlay rules. Pure functions. */

export type PickReward = { name: string; rarity: string; drop_rate: number; ducats: number; plat: number; vaulted: boolean; owned: boolean };
export type PickRelic = {
  name: string;
  base_name: string;
  refinement: string;
  count: number;
  unowned_score: number;
  ducat_score: number;
  plat_score: number;
  rewards: PickReward[];
};
export type RelicPick = { era: string; relics: PickRelic[] };

export const PICK_PRIORITIES = ["unowned", "ducat", "platinum"] as const;
export type PickPriority = (typeof PICK_PRIORITIES)[number];
export const PICK_LINES = ["all", "best", "estimated"] as const;
export type PickLines = (typeof PICK_LINES)[number];

export const pickPriorityFrom = (v: unknown): PickPriority => ((PICK_PRIORITIES as readonly unknown[]).includes(v) ? (v as PickPriority) : "unowned");
export const pickLinesFrom = (v: unknown): PickLines => ((PICK_LINES as readonly unknown[]).includes(v) ? (v as PickLines) : "all");

/**
 * Keys that can show and hide the relic pick overlay, with their Windows virtual-key
 * codes. Keys only, no combinations: the game receives the key as well, so a
 * key without a game action is the best choice.
 */
export const PICK_KEYS = [
  { id: "off", label: "None", vk: 0 },
  { id: "Home", label: "Home", vk: 0x24 },
  { id: "End", label: "End", vk: 0x23 },
  { id: "Insert", label: "Insert", vk: 0x2d },
  { id: "Delete", label: "Delete", vk: 0x2e },
  { id: "PageUp", label: "Page Up", vk: 0x21 },
  { id: "PageDown", label: "Page Down", vk: 0x22 },
  { id: "Pause", label: "Pause", vk: 0x13 },
  { id: "ScrollLock", label: "Scroll Lock", vk: 0x91 },
  ...Array.from({ length: 12 }, (_, i) => ({ id: `F${String(i + 1)}`, label: `F${String(i + 1)}`, vk: 0x70 + i })),
] as const satisfies ReadonlyArray<{ id: string; label: string; vk: number }>;
export type PickKey = string;

export const DEFAULT_PICK_KEY: PickKey = "Home";
export const pickKeyFrom = (v: unknown): PickKey => (PICK_KEYS.some((k) => k.id === v) ? (v as PickKey) : DEFAULT_PICK_KEY);
/** The virtual-key code the backend listens for; 0 for none. */
export const pickKeyCode = (key: PickKey): number => PICK_KEYS.find((k) => k.id === key)?.vk ?? 0;

export const PICK_PRIORITY_LABEL: Readonly<Record<PickPriority, string>> = {
  unowned: "Unowned / mastery",
  ducat: "Most ducats (EV)",
  platinum: "Most platinum (EV)",
};
export const PICK_LINES_LABEL: Readonly<Record<PickLines, string>> = {
  all: "All rewards",
  best: "Best reward",
  estimated: "Estimated value",
};

const ERA_LABEL: Readonly<Record<string, string>> = { LITH: "Lith", MESO: "Meso", NEO: "Neo", AXI: "Axi", ALL: "All Eras" };
export const eraLabel = (era: string) => ERA_LABEL[era] ?? era;

export function pickScore(relic: PickRelic, priority: PickPriority): number {
  if (priority === "platinum") return relic.plat_score;
  if (priority === "ducat") return relic.ducat_score;
  return relic.unowned_score;
}

/** "38% new", "5p EV" or "20 ducats EV". */
export function scoreLabel(relic: PickRelic, priority: PickPriority): string {
  const s = pickScore(relic, priority);
  if (priority === "platinum") return `${s.toFixed(0)}p EV`;
  if (priority === "ducat") return `${s.toFixed(0)} ducats EV`;
  return `${(s * 100).toFixed(0)}% new`;
}

/** The three best relics for the priority. */
export const topRelics = (pick: RelicPick, priority: PickPriority): PickRelic[] =>
  [...pick.relics].sort((a, b) => pickScore(b, priority) - pickScore(a, priority)).slice(0, 3);

const RARITY_ORDER: Readonly<Record<string, number>> = { Gold: 0, Silver: 1, Bronze: 2 };

/** Which rewards a relic lists: all by rarity, or only the best for the priority. */
export function shownRewards(relic: PickRelic, lines: PickLines, priority: PickPriority): PickReward[] {
  if (lines !== "best") return [...relic.rewards].sort((a, b) => (RARITY_ORDER[a.rarity] ?? 3) - (RARITY_ORDER[b.rarity] ?? 3));
  if (priority === "platinum") return [...relic.rewards].sort((a, b) => b.plat - a.plat).slice(0, 1);
  if (priority === "ducat") return [...relic.rewards].sort((a, b) => b.ducats - a.ducats).slice(0, 1);
  return relic.rewards.filter((r) => !r.owned).sort((a, b) => b.drop_rate - a.drop_rate);
}

/** Refinement worth running for a reward: rare items gain most from refining. */
export function recommendedRefinement(rarity: string): "Radiant" | "Exceptional" | "Intact" {
  if (rarity === "Gold") return "Radiant";
  if (rarity === "Silver") return "Exceptional";
  return "Intact";
}

export const refinementLabel = (r: string) => r.charAt(0).toUpperCase() + r.slice(1);

/** The example for Settings → Overlays → Show. */
export const PREVIEW_PICK: RelicPick = {
  era: "ALL",
  relics: [
    {
      name: "Axi R4 Intact",
      base_name: "Axi R4",
      refinement: "intact",
      count: 1,
      unowned_score: 0.3833,
      ducat_score: 19.5,
      plat_score: 5.4,
      rewards: [
        { name: "Forma Blueprint", rarity: "Bronze", drop_rate: 0.2533, ducats: 0, plat: 0, vaulted: false, owned: true },
        { name: "Boltor Prime Stock", rarity: "Bronze", drop_rate: 0.2533, ducats: 15, plat: 9, vaulted: true, owned: true },
        { name: "Burston Prime Blueprint", rarity: "Bronze", drop_rate: 0.2533, ducats: 15, plat: 3, vaulted: true, owned: false },
        { name: "Glaive Prime Disc", rarity: "Silver", drop_rate: 0.11, ducats: 45, plat: 9, vaulted: true, owned: false },
        { name: "Ember Prime Systems Blueprint", rarity: "Silver", drop_rate: 0.11, ducats: 45, plat: 9, vaulted: true, owned: true },
        { name: "Rhino Prime Blueprint", rarity: "Gold", drop_rate: 0.02, ducats: 100, plat: 20, vaulted: true, owned: false },
      ],
    },
    {
      name: "Meso N1 Intact",
      base_name: "Meso N1",
      refinement: "intact",
      count: 2,
      unowned_score: 0.2733,
      ducat_score: 26,
      plat_score: 2.4,
      rewards: [
        { name: "Fang Prime Handle", rarity: "Bronze", drop_rate: 0.2533, ducats: 25, plat: 2, vaulted: true, owned: false },
        { name: "Braton Prime Stock", rarity: "Bronze", drop_rate: 0.2533, ducats: 25, plat: 1, vaulted: true, owned: true },
        { name: "Fang Prime Blueprint", rarity: "Bronze", drop_rate: 0.2533, ducats: 25, plat: 1, vaulted: true, owned: true },
        { name: "2X Forma Blueprint", rarity: "Silver", drop_rate: 0.11, ducats: 0, plat: 0, vaulted: false, owned: true },
        { name: "Dual Kamas Prime Handle", rarity: "Silver", drop_rate: 0.11, ducats: 45, plat: 7, vaulted: true, owned: true },
        { name: "Nyx Prime Neuroptics Blueprint", rarity: "Gold", drop_rate: 0.02, ducats: 100, plat: 30, vaulted: true, owned: false },
      ],
    },
    {
      name: "Lith S1 Intact",
      base_name: "Lith S1",
      refinement: "intact",
      count: 3,
      unowned_score: 0.13,
      ducat_score: 18.4,
      plat_score: 3.3,
      rewards: [
        { name: "Paris Prime String", rarity: "Bronze", drop_rate: 0.2533, ducats: 15, plat: 2, vaulted: false, owned: true },
        { name: "Hikou Prime Blueprint", rarity: "Bronze", drop_rate: 0.2533, ducats: 15, plat: 4, vaulted: true, owned: true },
        { name: "Bronco Prime Blueprint", rarity: "Bronze", drop_rate: 0.2533, ducats: 15, plat: 3, vaulted: true, owned: true },
        { name: "Paris Prime Grip", rarity: "Silver", drop_rate: 0.11, ducats: 45, plat: 3, vaulted: false, owned: false },
        { name: "2X Forma Blueprint", rarity: "Silver", drop_rate: 0.11, ducats: 0, plat: 0, vaulted: false, owned: true },
        { name: "Spira Prime Pouch", rarity: "Gold", drop_rate: 0.02, ducats: 100, plat: 35, vaulted: true, owned: false },
      ],
    },
  ],
};
