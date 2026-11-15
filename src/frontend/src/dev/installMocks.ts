import { emit } from "@tauri-apps/api/event";
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { MASTERY, OWNED_QUANTITIES } from "./fixtures/completionist";
import { FOUNDRY_CRAFTING, FOUNDRY_FORMA, FOUNDRY_MASTERY, FOUNDRY_QUANTITIES, FOUNDRY_SHARDS } from "./fixtures/foundry";
import { MARKET_QUANTITIES } from "./fixtures/market";
import { CRAFTING, INVENTORY_MASTERY, INVENTORY_QUANTITIES, MOD_COUNTS } from "./fixtures/inventory";
import { RELIC_MASTERY, RELIC_QUANTITIES } from "./fixtures/relics";
import { handleCommand } from "./fixtures";
import { readScenario } from "./fixtures/scenario";

/**
 * Pretends to be Tauri: window label from ?window=…, IPC answered by typed
 * fixtures, scenario from ?scenario=…. Must run before any app module loads.
 */
export function installMocks(search: string = window.location.search) {
  const params = new URLSearchParams(search);
  mockWindows(params.get("window") ?? "main");
  const scenario = readScenario(search);
  mockIPC((cmd, payload) => handleCommand(cmd, payload, scenario), { shouldMockEvents: true });
}

/**
 * Mastery only reaches the app through inventory-update events (there is no
 * command for it). Mock mode pushes often while the app starts and then
 * every few seconds, like the real scanner heartbeat.
 */
export function startMockInventoryEvents(intervalMs = 5000): () => void {
  const push = () => {
    void emit("inventory-update", {
      quantities: {
        "/Mods/PrimedContinuity": 1,
        "/Warframes/MagPrime": 1,
        ...OWNED_QUANTITIES,
        ...RELIC_QUANTITIES,
        ...INVENTORY_QUANTITIES,
        ...FOUNDRY_QUANTITIES,
        ...MARKET_QUANTITIES,
      },
      mastery_data: { ...MASTERY, ...RELIC_MASTERY, ...INVENTORY_MASTERY, ...FOUNDRY_MASTERY },
      consumed_suits: [],
      mods: MOD_COUNTS,
      crafting: [...CRAFTING, ...FOUNDRY_CRAFTING],
      changes: [],
      warframe_running: false,
      mastery_rank: 27,
      player_name: "Tenno-Mock",
      scanned_at: Math.floor(Date.now() / 1000),
      socketed_shards: FOUNDRY_SHARDS,
      forma_counts: FOUNDRY_FORMA,
      is_full_pass: true,
    });
  };
  // A push before the event bridge listens is lost, and under load (parallel
  // Playwright workers) the app can take seconds to mount. So push often at
  // first, then at the heartbeat interval.
  const early = window.setInterval(push, 500);
  const settle = window.setTimeout(() => {
    window.clearInterval(early);
  }, 10_000);
  const every = window.setInterval(push, intervalMs);
  return () => {
    window.clearInterval(early);
    window.clearTimeout(settle);
    window.clearInterval(every);
  };
}
