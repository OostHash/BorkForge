import type { SnapshotPoint, TopItem, TrackedItem, Trade } from "../../domain/statistics";
import type { Fixture } from "./scenario";

/**
 * Statistics around the fixed test date 2026-11-12: trade sessions of every
 * kind (sale, purchase, trade, a legacy row), a mod with rank stars, a
 * loss-making category, the top-items list, and two tracked items with
 * snapshots (one without any yet).
 */
const day = (n: number, h = 18) => new Date(Date.UTC(2026, 10, 12 - n, h, 0)).toISOString();
const STAR = String.fromCharCode(0xe000);

let id = 0;
const row = (p: Partial<Trade> & Pick<Trade, "direction" | "item_name" | "platinum">): Trade => ({
  id: ++id,
  timestamp: day(1),
  with_player: "Tenno",
  item_url: "",
  quantity: 1,
  source: "eelog",
  notes: "",
  session_id: "",
  trade_type: "sale",
  ...p,
});

export const TRADES: Trade[] = [
  row({
    session_id: "s1",
    timestamp: day(0, 20),
    with_player: "Buyer1",
    direction: "sold",
    item_name: "Nova Prime Set",
    platinum: 180,
    trade_type: "sale",
  }),
  row({
    session_id: "s2",
    timestamp: day(1),
    with_player: "Buyer2",
    direction: "sold",
    item_name: `Serration${STAR.repeat(10)}`,
    platinum: 14,
    trade_type: "sale",
  }),
  row({
    session_id: "s3",
    timestamp: day(2),
    with_player: "Seller1",
    direction: "bought",
    item_name: "Arcane Energize",
    platinum: 45,
    quantity: 2,
    trade_type: "purchase",
  }),
  row({
    session_id: "s4",
    timestamp: day(3),
    with_player: "Friend",
    direction: "traded-out",
    item_name: "Braton Prime Barrel",
    platinum: 0,
    trade_type: "trade",
  }),
  row({
    session_id: "s4",
    timestamp: day(3),
    with_player: "Friend",
    direction: "traded-in",
    item_name: "Lith B1 Relic",
    platinum: 0,
    trade_type: "trade",
  }),
  row({
    session_id: "s5",
    timestamp: day(5),
    with_player: "Buyer3",
    direction: "sold",
    item_name: "Rifle Riven Mod (Veiled)",
    platinum: 25,
    quantity: 3,
    trade_type: "sale",
  }),
  row({
    session_id: "s6",
    timestamp: day(8),
    with_player: "Seller2",
    direction: "bought",
    item_name: "Soma Prime Set",
    platinum: 120,
    trade_type: "purchase",
  }),
  row({ timestamp: day(12), with_player: "OldBuyer", direction: "sold", item_name: "Ash Prime Systems Blueprint", platinum: 30 }),
  row({
    session_id: "s7",
    timestamp: day(45),
    with_player: "Buyer4",
    direction: "sold",
    item_name: "Nova Prime Set",
    platinum: 170,
    trade_type: "sale",
  }),
];

export const TOP_ITEMS: TopItem[] = [
  { name: "Arcane Energize", url_name: "arcane_energize", unit_price: 45, daily_volume: 310.4, total_value_7d: 97_776 },
  { name: "Nova Prime Set", url_name: "nova_prime_set", unit_price: 180, daily_volume: 42, total_value_7d: 52_920 },
  { name: "Primed Continuity", url_name: "primed_continuity", unit_price: 55, daily_volume: 88, total_value_7d: 33_880 },
  { name: "Serration", url_name: "serration", unit_price: 12, daily_volume: 160, total_value_7d: 13_440 },
  { name: "Soma Prime Set", url_name: "soma_prime_set", unit_price: 120, daily_volume: 12.5, total_value_7d: 10_500 },
  { name: "Blind Rage", url_name: "blind_rage", unit_price: 18, daily_volume: 30, total_value_7d: 3_780 },
];

const initialTracked = (): TrackedItem[] => [
  { unique_name: "/Res/Ferrite", display_name: "Ferrite", added_at: "2026-10-01T00:00:00Z" },
  { unique_name: "/Res/OrokinCell", display_name: "Orokin Cell", added_at: "2026-10-01T00:00:00Z" },
  { unique_name: "/Res/Plastids", display_name: "Plastids", added_at: "2026-11-12T00:00:00Z" },
];

function series(start: number, step: (i: number) => number, days: number): SnapshotPoint[] {
  const out: SnapshotPoint[] = [];
  let q = start;
  for (let i = days; i >= 0; i--) {
    const change = out.length === 0 ? 0 : step(i);
    q += change;
    out.push({ date: new Date(Date.UTC(2026, 10, 12 - i)).toISOString().slice(0, 10), quantity: q, change });
  }
  return out;
}

const SNAPSHOTS: Record<string, SnapshotPoint[]> = {
  "/Res/Ferrite": series(9_000, (i) => (i % 5 === 0 ? -400 : 120 + (i % 3) * 40), 40),
  "/Res/OrokinCell": series(30, (i) => (i % 4 === 0 ? 2 : -1), 20),
  "/Res/Plastids": [],
};

let tracked = initialTracked();

export function resetMockStatistics() {
  tracked = initialTracked();
}

export const statisticsFixtures = {
  get_trades: { default: () => TRADES, empty: () => [] } satisfies Fixture<Trade[]>,
  get_wfm_top_items: { default: () => TOP_ITEMS, empty: () => [] } satisfies Fixture<TopItem[]>,
  get_tracked_items: { default: () => tracked, empty: () => [] } satisfies Fixture<TrackedItem[]>,
  add_tracked_item: {
    alwaysDefault: true,
    default: ({ uniqueName, displayName }) => {
      tracked = [...tracked, { unique_name: uniqueName, display_name: displayName, added_at: "2026-11-12T12:00:00Z" }];
      return null;
    },
  } satisfies Fixture<null, { uniqueName: string; displayName: string }>,
  remove_tracked_item: {
    alwaysDefault: true,
    default: ({ uniqueName }) => {
      tracked = tracked.filter((t) => t.unique_name !== uniqueName);
      return null;
    },
  } satisfies Fixture<null, { uniqueName: string }>,
  get_item_snapshots: { default: ({ uniqueName }) => SNAPSHOTS[uniqueName] ?? [] } satisfies Fixture<
    SnapshotPoint[],
    { uniqueName: string; days: number | null }
  >,
  get_system_locale: { alwaysDefault: true, default: () => "en-GB" } satisfies Fixture<string>,
};
