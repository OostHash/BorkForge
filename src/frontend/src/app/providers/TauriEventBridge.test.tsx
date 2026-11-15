import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { emit } from "@tauri-apps/api/event";
import { clearMocks, mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { TauriEventBridge } from "./TauriEventBridge";

afterEach(async () => {
  // Unmount first: the bridge unlistens on unmount and needs the event mocks.
  await cleanup();
  clearMocks();
});

it("invalidates the mapped queries when a backend event arrives", async () => {
  mockWindows("main");
  mockIPC(() => undefined, { shouldMockEvents: true });
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, "invalidateQueries");

  await render(
    <QueryClientProvider client={client}>
      <TauriEventBridge />
    </QueryClientProvider>,
  );
  await vi.waitFor(async () => {
    await emit("catalogue-updated", 1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["catalog"] });
  });
});

it("writes inventory-update payloads into the cache and merges mastery", async () => {
  mockWindows("main");
  mockIPC(() => undefined, { shouldMockEvents: true });
  const client = new QueryClient();
  client.setQueryData(["mastery"], { "/a": 10 });
  await render(
    <QueryClientProvider client={client}>
      <TauriEventBridge />
    </QueryClientProvider>,
  );
  await vi.waitFor(async () => {
    await emit("inventory-update", {
      quantities: { "/q": 2 },
      mastery_data: { "/b": 30 },
      consumed_suits: [],
      mods: {},
      crafting: [],
      changes: [],
      warframe_running: false,
    });
    expect(client.getQueryData(["inventory", "quantities"])).toEqual({ "/q": 2 });
  });
  expect(client.getQueryData(["mastery"])).toEqual({ "/a": 10, "/b": 30 });
});

it("keeps the account from player-name and inventory-update", async () => {
  mockWindows("main");
  mockIPC(() => undefined, { shouldMockEvents: true });
  const client = new QueryClient();
  await render(
    <QueryClientProvider client={client}>
      <TauriEventBridge />
    </QueryClientProvider>,
  );
  await vi.waitFor(async () => {
    await emit("player-name", "Tenno");
    expect(client.getQueryData(["app", "player"])).toEqual({ name: "Tenno", masteryRank: null });
  });
  await emit("inventory-update", {
    quantities: {},
    mastery_data: {},
    consumed_suits: [],
    mods: {},
    crafting: [],
    changes: [],
    warframe_running: true,
    mastery_rank: 30,
  });
  expect(client.getQueryData(["app", "player"])).toEqual({ name: "Tenno", masteryRank: 30 });
  expect(client.getQueryData(["app", "game"])).toEqual({ running: true, scannedAt: null });
});

it("updates one quantity when a relic reward is picked up", async () => {
  mockWindows("main");
  mockIPC(() => undefined, { shouldMockEvents: true });
  const client = new QueryClient();
  client.setQueryData(["inventory", "quantities"], { "/a": 1, "/b": 2 });
  await render(
    <QueryClientProvider client={client}>
      <TauriEventBridge />
    </QueryClientProvider>,
  );
  await vi.waitFor(async () => {
    await emit("inventory-reward", { path: "/b", qty: 3 });
    expect(client.getQueryData(["inventory", "quantities"])).toEqual({ "/a": 1, "/b": 3 });
  });
});
