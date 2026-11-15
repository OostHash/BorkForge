import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { emit, listen } from "@tauri-apps/api/event";
import { clearMocks, mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import type { OcrRiven, RivenView } from "../domain/rivenOverlay";
import { RivenOverlayController } from "./RivenOverlayController";

afterEach(async () => {
  await cleanup();
  clearMocks();
  localStorage.clear();
});

const OCR: OcrRiven = {
  weapon: "tenora prime",
  positives: ["Critical Chance"],
  negatives: ["Zoom"],
  rolled_stats: [{ name: "Critical Chance", value: "+180%", positive: true }],
  is_comparison: false,
  original_rolled_stats: [],
  raw: "TENORA PRIME",
};

function setup(settings: Record<string, unknown> = {}, ocr: () => unknown = () => OCR) {
  const calls: Array<{ cmd: string; args: unknown }> = [];
  mockWindows("main");
  mockIPC(
    (cmd, args) => {
      calls.push({ cmd, args });
      if (cmd === "load_settings") return JSON.stringify(settings);
      if (cmd === "get_warframe_window_rect") return [0, 0, 1920, 1080];
      if (cmd === "ocr_riven_screen") return ocr();
      if (cmd === "analyze_riven")
        return {
          weapon: "Tenora Prime",
          matched_positives: ["Critical Chance"],
          safe_negatives_present: ["Zoom"],
          harmful_negatives: [],
          score: 0.9,
          verdict: "GREAT",
          notes: "",
          alternatives: [],
        };
      return null;
    },
    { shouldMockEvents: true },
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const find = (cmd: string) => calls.filter((c) => c.cmd === cmd);
  return { client, calls, find };
}

const mount = (client: QueryClient) =>
  render(
    <QueryClientProvider client={client}>
      <RivenOverlayController />
    </QueryClientProvider>,
  );

async function views() {
  const seen: RivenView[] = [];
  await listen<RivenView>("riven-view", (e) => seen.push(e.payload));
  return seen;
}

/** Fires an event until the controller has reacted (its listeners attach after mount). */
async function fireUntil(event: string, done: () => void) {
  await vi.waitFor(async () => {
    await emit(event, {});
    done();
  });
}

it("opens the window, sends scanning, then the result", async () => {
  const { client, find } = setup();
  const seen = await views();
  await mount(client);
  await fireUntil("riven-screen-open", () => {
    expect(seen.some((v) => v.kind === "result")).toBe(true);
  });
  expect(find("plugin:webview|create_webview_window")[0]?.args).toMatchObject({
    options: { label: "riven-overlay", x: 10, y: 216, width: 300, height: 648 },
  });
  expect(seen[0]).toEqual({ kind: "scanning", rollCount: 1 });
  expect(seen[1]).toMatchObject({ kind: "result", preview: false, rollCount: 1, weapon: "tenora prime", analysis: { verdict: "GREAT" } });
  expect(find("analyze_riven")[0]?.args).toEqual({ weapon: "tenora prime", positives: ["Critical Chance"], negatives: ["Zoom"] });
});

it("ignores the screen while the riven overlay is off, but still checks on request", async () => {
  const { client, find } = setup({ rivenEnabled: false });
  await mount(client);
  await vi.waitFor(() => {
    expect(find("load_settings")).toHaveLength(1);
    expect(client.isFetching()).toBe(0);
  });
  await new Promise((r) => setTimeout(r, 50));
  await emit("riven-screen-open", {});
  await new Promise((r) => setTimeout(r, 100));
  expect(find("ocr_riven_screen")).toHaveLength(0);
  await fireUntil("riven-manual-check", () => {
    expect(find("ocr_riven_screen").length).toBeGreaterThan(0);
  });
});

it("sends the OCR error and logs it", async () => {
  const { client, find } = setup({}, () => {
    throw new Error("no window");
  });
  const seen = await views();
  await mount(client);
  await fireUntil("riven-manual-check", () => {
    expect(seen.some((v) => v.kind === "result")).toBe(true);
  });
  expect(seen.find((v) => v.kind === "result")).toMatchObject({ analysis: null, ocrRaw: expect.stringContaining("OCR ERROR") as unknown });
  expect(find("analyze_riven")).toHaveLength(0);
  await vi.waitFor(() => {
    expect(find("ocr_riven_log_error").length).toBeGreaterThan(0);
  });
});

it("resends the latest view to a window that just opened", async () => {
  const { client } = setup();
  const seen = await views();
  await mount(client);
  await fireUntil("riven-manual-check", () => {
    expect(seen.some((v) => v.kind === "result")).toBe(true);
  });
  const before = seen.length;
  await emit("riven-window-ready", {});
  await vi.waitFor(() => {
    expect(seen.length).toBe(before + 1);
  });
  expect(seen.at(-1)).toMatchObject({ kind: "result", rollCount: 1 });
});

it("closes the window and forgets the view when the screen closes or the overlay asks", async () => {
  const { client, find } = setup();
  const seen = await views();
  await mount(client);
  await fireUntil("riven-manual-check", () => {
    expect(seen.some((v) => v.kind === "result")).toBe(true);
  });
  await emit("riven-overlay-hide", { reason: "x-button" });
  await vi.waitFor(() => {
    expect(find("ocr_riven_log_error").some((c) => (c.args as { error: string }).error === "[HIDE] x-button")).toBe(true);
  });
  const before = seen.length;
  await emit("riven-window-ready", {});
  await new Promise((r) => setTimeout(r, 100));
  expect(seen.length).toBe(before);
});

it("shows the preview only while no live check is shown", async () => {
  const { client } = setup();
  const seen = await views();
  await mount(client);
  await fireUntil("riven-preview", () => {
    expect(seen.some((v) => v.kind === "result" && v.preview)).toBe(true);
  });
  await emit("riven-manual-check", {});
  await vi.waitFor(() => {
    expect(seen.at(-1)).toMatchObject({ kind: "result", preview: false });
  });
  const before = seen.length;
  await emit("riven-preview", {});
  await emit("riven-preview-close", {});
  await new Promise((r) => setTimeout(r, 100));
  expect(seen.length).toBe(before);
});
