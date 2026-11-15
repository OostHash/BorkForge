import { QueryClient } from "@tanstack/react-query";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { afterEach, expect, it } from "vitest";
import { appKeys, applyGameState, refreshCatalogue, setPlayerName, type Player } from "./app";
import type { InventoryUpdatePayload } from "./events";

afterEach(() => {
  clearMocks();
});

const update = (extra: Partial<InventoryUpdatePayload>): InventoryUpdatePayload => ({
  quantities: {},
  mastery_data: {},
  consumed_suits: [],
  mods: {},
  crafting: [],
  changes: [],
  warframe_running: true,
  ...extra,
});

it("a forced catalogue refresh stops a running scanner and starts it again", async () => {
  const calls: string[] = [];
  let monitoring = true;
  mockIPC((cmd) => {
    calls.push(cmd);
    if (cmd === "get_monitor_status") return monitoring;
    if (cmd === "stop_monitor") monitoring = false;
    if (cmd === "start_monitor") monitoring = true;
    if (cmd === "fetch_item_list") return 250;
    if (cmd === "get_item_list_status") return { count: 250, recipe_count: 90 };
    return null;
  });
  const result = await refreshCatalogue(new QueryClient(), true);
  expect(result).toEqual({ items: 250, recipes: 90 });
  expect(calls.filter((c) => c !== "prewarm_image_cache")).toEqual([
    "get_monitor_status",
    "stop_monitor",
    "fetch_item_list",
    "get_item_list_status",
    "start_monitor",
  ]);
});

it("a forced refresh restarts the scanner even when the download fails", async () => {
  const calls: string[] = [];
  mockIPC((cmd) => {
    calls.push(cmd);
    if (cmd === "get_monitor_status") return true;
    if (cmd === "fetch_item_list") throw new Error("offline");
    return null;
  });
  await expect(refreshCatalogue(new QueryClient(), true)).rejects.toThrow("offline");
  expect(calls.at(-1)).toBe("start_monitor");
});

it("the start-up refresh leaves the scanner alone", async () => {
  const calls: string[] = [];
  mockIPC((cmd) => {
    calls.push(cmd);
    if (cmd === "fetch_item_list") return 1;
    if (cmd === "get_item_list_status") return { count: 1, recipe_count: 0 };
    return null;
  });
  await refreshCatalogue(new QueryClient(), false);
  expect(calls).not.toContain("stop_monitor");
  expect(calls).not.toContain("get_monitor_status");
});

it("inventory updates set the game state and merge the account", () => {
  const client = new QueryClient();
  setPlayerName(client, "Tenno");
  applyGameState(client, update({ mastery_rank: 28, scanned_at: 1000 }));
  expect(client.getQueryData<Player>(appKeys.player)).toEqual({ name: "Tenno", masteryRank: 28 });
  expect(client.getQueryData(appKeys.game)).toEqual({ running: true, scannedAt: 1000 });

  // A heartbeat without account data keeps what we know.
  applyGameState(client, update({ warframe_running: false }));
  expect(client.getQueryData<Player>(appKeys.player)).toEqual({ name: "Tenno", masteryRank: 28 });
  expect(client.getQueryData(appKeys.game)).toEqual({ running: false, scannedAt: 1000 });
});
