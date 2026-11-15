import type { WfmAuction, WfmManagedOrder } from "../../domain/trading";
import type { Fixture } from "./scenario";

/**
 * warframe.market account in memory: listings (one riven order), two riven
 * auctions, and every write changes this state so the UI can be tested.
 * Login accepts any password except "wrong".
 */
const initialOrders = (): WfmManagedOrder[] => [
  { id: "o1", itemId: "nova_prime_set", type: "sell", platinum: 180, quantity: 2, visible: true, item: { i18n: { en: { name: "Nova Prime Set" } } } },
  { id: "o2", itemId: "serration", type: "sell", platinum: 14, quantity: 1, visible: false, rank: 10, item: { i18n: { en: { name: "Serration" } } } },
  { id: "o3", itemId: "arcane_energize", type: "buy", platinum: 40, quantity: 1, visible: true, item: { i18n: { en: { name: "Arcane Energize" } } } },
  { id: "o4", itemId: "braton_prime_barrel", type: "sell", platinum: 30, quantity: 1, visible: true, item: { slug: "braton_prime_barrel" } },
  {
    id: "o5",
    itemId: "rifle_riven_mod_veiled",
    type: "sell",
    platinum: 25,
    quantity: 3,
    visible: true,
    item: { i18n: { en: { name: "Rifle Riven Mod (Veiled)" } } },
  },
];

const initialAuctions = (): WfmAuction[] => [
  {
    id: "a1",
    starting_price: 400,
    buyout_price: null,
    top_bid: null,
    bids: 2,
    is_closed: false,
    is_direct_sell: false,
    visible: true,
    item: { weapon_url_name: "soma_prime", name: "critaata" },
  },
  {
    id: "a2",
    starting_price: 150,
    buyout_price: 150,
    top_bid: null,
    bids: 0,
    is_closed: false,
    is_direct_sell: true,
    visible: false,
    item: { weapon_url_name: "lato", name: "visi-tron" },
  },
  {
    id: "a3",
    starting_price: 90,
    buyout_price: null,
    top_bid: null,
    bids: 0,
    is_closed: true,
    is_direct_sell: true,
    visible: true,
    item: { weapon_url_name: "braton", name: "old" },
  },
];

let orders = initialOrders();
let auctions = initialAuctions();
let session: [string, string] | null = ["Tenno", "invisible"];

/** Tests start from the same account. */
export function resetMockTrading(loggedIn = true) {
  orders = initialOrders();
  auctions = initialAuctions();
  session = loggedIn ? ["Tenno", "invisible"] : null;
}

const patchOrder = (id: string, patch: Partial<WfmManagedOrder>) => {
  orders = orders.map((o) => (o.id === id ? { ...o, ...patch } : o));
};

export const tradingFixtures = {
  wfm_get_session: { default: () => session, empty: () => null } satisfies Fixture<[string, string] | null>,
  wfm_load_credentials: { default: () => null } satisfies Fixture<[string, string] | null>,
  wfm_set_jwt: { alwaysDefault: true, default: () => ["Tenno", "invisible"] } satisfies Fixture<[string, string], { jwt: string }>,
  wfm_get_jwt: { alwaysDefault: true, default: () => '{"token":"mock"}' } satisfies Fixture<string | null>,
  wfm_save_credentials: { alwaysDefault: true, default: () => null } satisfies Fixture<null, { email: string; token: string }>,
  wfm_login: {
    alwaysDefault: true,
    default: ({ password }) => {
      if (password === "wrong") throw new Error("Invalid email or password");
      session = ["Tenno", "invisible"];
      return "Tenno";
    },
  } satisfies Fixture<string, { email: string; password: string }>,
  wfm_logout: {
    alwaysDefault: true,
    default: () => {
      session = null;
      return null;
    },
  } satisfies Fixture<null>,
  wfm_fetch_status: { alwaysDefault: true, default: () => session?.[1] ?? "offline" } satisfies Fixture<string>,
  wfm_set_status: {
    alwaysDefault: true,
    default: ({ status }) => {
      if (session) session = [session[0], status];
      return null;
    },
  } satisfies Fixture<null, { status: "online" | "ingame" | "invisible" }>,
  wfm_get_orders: { default: () => orders, empty: () => [] } satisfies Fixture<WfmManagedOrder[]>,
  wfm_update_order: {
    alwaysDefault: true,
    default: ({ orderId, platinum, quantity, visible }) => {
      patchOrder(orderId, { platinum, quantity, visible });
      return null;
    },
  } satisfies Fixture<unknown, { orderId: string; platinum: number; quantity: number; visible: boolean }>,
  wfm_delete_order: {
    alwaysDefault: true,
    default: ({ orderId }) => {
      orders = orders.filter((o) => o.id !== orderId);
      return null;
    },
  } satisfies Fixture<null, { orderId: string }>,
  wfm_close_order: {
    alwaysDefault: true,
    default: ({ orderId, quantity }) => {
      const o = orders.find((x) => x.id === orderId);
      if (o && o.quantity > quantity) patchOrder(orderId, { quantity: o.quantity - quantity });
      else orders = orders.filter((x) => x.id !== orderId);
      return null;
    },
  } satisfies Fixture<unknown, { orderId: string; quantity: number }>,
  wfm_get_my_riven_auctions: { default: () => ({ payload: { auctions } }), empty: () => ({ payload: { auctions: [] } }) } satisfies Fixture<{
    payload?: { auctions?: WfmAuction[] };
  }>,
  wfm_set_auction_visible: {
    alwaysDefault: true,
    default: ({ auctionId, visible }) => {
      auctions = auctions.map((a) => (a.id === auctionId ? { ...a, visible } : a));
      return null;
    },
  } satisfies Fixture<null, { auctionId: string; visible: boolean }>,
  wfm_delete_auction: {
    alwaysDefault: true,
    default: ({ auctionId }) => {
      auctions = auctions.filter((a) => a.id !== auctionId);
      return null;
    },
  } satisfies Fixture<null, { auctionId: string }>,
  wfm_update_auction: {
    alwaysDefault: true,
    default: ({ auctionId, startingPrice, buyoutPrice, visible }) => {
      auctions = auctions.map((a) => (a.id === auctionId ? { ...a, starting_price: startingPrice, buyout_price: buyoutPrice, visible } : a));
      return null;
    },
  } satisfies Fixture<null, { auctionId: string; startingPrice: number; buyoutPrice: number | null; visible: boolean }>,
  wfm_switch_riven_type: {
    alwaysDefault: true,
    default: ({ auctionId, newIsDirectSell, startingPrice, buyoutPrice, visible }) => {
      auctions = auctions.map((a) =>
        a.id === auctionId
          ? { ...a, id: `${a.id}x`, is_direct_sell: newIsDirectSell, starting_price: startingPrice, buyout_price: buyoutPrice, visible, bids: 0 }
          : a,
      );
      return null;
    },
  } satisfies Fixture<unknown, { auctionId: string; newIsDirectSell: boolean; startingPrice: number; buyoutPrice: number | null; visible: boolean }>,
  add_trade: { alwaysDefault: true, default: () => 1 } satisfies Fixture<unknown, { params: unknown }>,
};
