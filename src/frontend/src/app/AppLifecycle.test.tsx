import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { emit } from "@tauri-apps/api/event";
import { clearMocks, mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { appKeys } from "../api/app";
import { AppLifecycle } from "./AppLifecycle";

type Call = { cmd: string; args: unknown };

afterEach(async () => {
  await cleanup();
  clearMocks();
});

/** Mocks the backend; settings and session are mutable so a test can change them. */
function setup(initial: { settings?: Record<string, unknown>; session?: [string, string] | null } = {}) {
  const calls: Call[] = [];
  const state = { settings: initial.settings ?? {}, session: initial.session ?? null, monitoring: false };
  mockWindows("main");
  mockIPC(
    (cmd, args) => {
      calls.push({ cmd, args });
      switch (cmd) {
        case "load_settings":
          return JSON.stringify(state.settings);
        case "wfm_get_session":
          return state.session;
        case "get_monitor_status":
          return state.monitoring;
        case "start_monitor":
          state.monitoring = true;
          return null;
        case "stop_monitor":
          state.monitoring = false;
          return null;
        case "fetch_item_list":
          return 100;
        case "get_item_list_status":
          return { count: 100, recipe_count: 40 };
        default:
          return null;
      }
    },
    { shouldMockEvents: true },
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const commands = (name: string) => calls.filter((c) => c.cmd === name);
  return { calls, state, client, commands };
}

const mount = (client: QueryClient) =>
  render(
    <QueryClientProvider client={client}>
      <AppLifecycle />
    </QueryClientProvider>,
  );

it("starts the memory scanner when the setting is on, and stops it when it goes off", async () => {
  const { state, client, commands } = setup({ settings: { memoryScannerEnabled: true } });
  await mount(client);
  await vi.waitFor(() => {
    expect(commands("start_monitor")).toHaveLength(1);
  });
  expect(client.getQueryData(appKeys.monitor)).toBe(true);

  state.settings = { memoryScannerEnabled: false };
  await client.invalidateQueries({ queryKey: ["settings"] });
  await vi.waitFor(() => {
    expect(commands("stop_monitor")).toHaveLength(1);
  });
  expect(client.getQueryData(appKeys.monitor)).toBe(false);
});

it("leaves the scanner off by default", async () => {
  const { client, commands } = setup();
  await mount(client);
  await vi.waitFor(() => {
    expect(commands("stop_monitor")).toHaveLength(1);
  });
  expect(commands("start_monitor")).toHaveLength(0);
});

it("loads the catalogue and warms the caches once at start", async () => {
  const { client, commands } = setup();
  await mount(client);
  await vi.waitFor(() => {
    expect(commands("prewarm_image_cache")).toHaveLength(1);
  });
  expect(commands("fetch_item_list")).toEqual([{ cmd: "fetch_item_list", args: { force: false } }]);
  expect(commands("get_wfm_top_items")).toHaveLength(1);
});

it("keeps the blob capture status in the cache", async () => {
  const { client } = setup();
  await mount(client);
  await vi.waitFor(async () => {
    await emit("blob-status", { stage: "scanning", detail: "Reading Warframe memory…" });
    expect(client.getQueryData(appKeys.blob)).toEqual({ stage: "scanning", detail: "Reading Warframe memory…" });
  });
  await emit("blob-status", { stage: "done", detail: "12 unique" });
  expect(client.getQueryData(appKeys.blob)).toEqual({ stage: "done", detail: "12 unique" });
});

it("goes invisible on warframe.market before quitting when the setting asks for it", async () => {
  const { client, calls } = setup({ settings: { wfmInvisibleOnClose: true }, session: ["tenno", "online"] });
  await mount(client);
  // Wait until settings and session are loaded, then close.
  await vi.waitFor(() => {
    expect(client.getQueryData(["market", "session"])).toEqual(["tenno", "online"]);
    expect(client.getQueryData(["settings"])).toEqual({ wfmInvisibleOnClose: true });
  });
  await vi.waitFor(async () => {
    await emit("tauri://close-requested");
    expect(calls.some((c) => c.cmd === "force_quit")).toBe(true);
  });
  const order = calls.map((c) => c.cmd).filter((cmd) => cmd === "wfm_set_status" || cmd === "force_quit");
  expect(order[0]).toBe("wfm_set_status");
  expect(calls.find((c) => c.cmd === "wfm_set_status")?.args).toEqual({ status: "invisible" });
});

it("quits without touching warframe.market when the setting is off", async () => {
  const { client, calls } = setup({ session: ["tenno", "online"] });
  await mount(client);
  await vi.waitFor(() => {
    expect(client.getQueryData(["settings"])).toEqual({});
  });
  await vi.waitFor(async () => {
    await emit("tauri://close-requested");
    expect(calls.some((c) => c.cmd === "force_quit")).toBe(true);
  });
  expect(calls.some((c) => c.cmd === "wfm_set_status")).toBe(false);
});
