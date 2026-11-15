import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { emit, listen } from "@tauri-apps/api/event";
import { clearMocks, mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { afterEach, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";
import { PREVIEW_VIEW, type RivenView } from "../../domain/rivenOverlay";
import { RivenOverlay } from "./RivenOverlay";

afterEach(async () => {
  await cleanup();
  clearMocks();
});

function setup() {
  const calls: Array<{ cmd: string; args: unknown }> = [];
  mockWindows("riven-overlay");
  mockIPC(
    (cmd, args) => {
      calls.push({ cmd, args });
      if (cmd === "save_riven_roll") return "roll-1";
      return null;
    },
    { shouldMockEvents: true },
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return { client, calls };
}

const mount = (client: QueryClient) =>
  render(
    <QueryClientProvider client={client}>
      <RivenOverlay />
    </QueryClientProvider>,
  );

/** Sends a view once the window listens (it says so with riven-window-ready). */
async function show(view: RivenView) {
  await vi.waitFor(async () => {
    await emit("riven-view", view);
    expect(page.getByText("Scanning stats…").query()).toBeNull();
  });
}

const comparison: RivenView = {
  kind: "result",
  preview: false,
  rollCount: 2,
  weapon: "tenora prime",
  isComparison: true,
  ocrRaw: "",
  analysis: PREVIEW_VIEW.kind === "result" ? PREVIEW_VIEW.analysis : null,
  rolledStats: [
    { name: "Critical Chance", value: "+170%", positive: true },
    { name: "Zoom", value: "-25%", positive: false },
  ],
  originalStats: [
    { name: "Multi-shot", value: "+90%", positive: true },
    { name: "Damage to Corpus", value: "-15%", positive: false },
  ],
};

it("asks the main window for the current view once it listens", async () => {
  const { client } = setup();
  const ready = vi.fn();
  await listen("riven-window-ready", ready);
  await mount(client);
  await vi.waitFor(() => {
    expect(ready).toHaveBeenCalled();
  });
  await expect.element(page.getByText("Scanning stats…")).toBeVisible();
});

it("shows verdict, score, negatives and the rolled stats", async () => {
  const { client } = setup();
  await mount(client);
  await show(PREVIEW_VIEW);
  await expect.element(page.getByRole("heading", { name: "Tenora Prime" })).toBeVisible();
  await expect.element(page.getByText("GOOD — usable")).toBeVisible();
  await expect.element(page.getByRole("progressbar", { name: "Score" })).toBeVisible();
  await expect.element(page.getByRole("list", { name: "Negatives" }).getByRole("listitem")).toHaveLength(2);
  await expect.element(page.getByText("Multi-shot", { exact: true }).last()).toBeVisible();
  const rolled = page.getByRole("region", { name: "Rolled stats" }).getByRole("listitem");
  await expect.element(rolled).toHaveLength(4);
  await expect.element(rolled.first()).toHaveTextContent("WantedCritical Chance+180%");
  await expect.element(rolled.last()).toHaveTextContent("HarmfulDamage to Corpus-20%");
});

it("shows the new and the original roll of a comparison", async () => {
  const { client } = setup();
  await mount(client);
  await show(comparison);
  await expect.element(page.getByRole("button", { name: "Refresh" })).toBeVisible();
  const fresh = page.getByRole("region", { name: "New roll" }).getByRole("listitem");
  await expect.element(fresh.last()).toHaveTextContent("SafeZoom-25%");
  const original = page.getByRole("region", { name: "Original roll" }).getByRole("listitem");
  await expect.element(original.first()).toHaveTextContent("WantedMulti-shot+90%");
  await expect.element(original.last()).toHaveTextContent("NeutralDamage to Corpus-15%");
});

it("says so when the card could not be read", async () => {
  const { client } = setup();
  await mount(client);
  await show({ ...comparison, analysis: null, rolledStats: [], originalStats: [], weapon: "tenora", ocrRaw: "OCR ERROR: x" });
  await expect.element(page.getByText(/^Could not read card stats/)).toHaveTextContent("Could not read card statsWeapon: “tenora”");
});

it("shows raw OCR when the weapon has no database entry", async () => {
  const { client } = setup();
  await mount(client);
  await show({ ...comparison, analysis: null, isComparison: false, ocrRaw: "SOME RIVEN" });
  await expect.element(page.getByText("No database entry for Tenora Prime")).toBeVisible();
  await expect.element(page.getByText("Raw OCR")).toBeVisible();
});

it("saves the roll and tells the other windows", async () => {
  const { client, calls } = setup();
  const saved = vi.fn();
  await listen("riven-roll-saved", saved);
  await mount(client);
  await show(PREVIEW_VIEW);
  await page.getByRole("button", { name: "Save this roll" }).click();
  await expect.element(page.getByRole("status")).toHaveTextContent("Roll saved.");
  const save = calls.find((c) => c.cmd === "save_riven_roll");
  expect(save?.args).toMatchObject({ weapon: "Tenora Prime", verdict: "GOOD — usable", score: 0.78 });
  expect((save?.args as { label: string }).label).toMatch(/^Tenora Prime · Roll #4 · \d+ \w+$/);
  await vi.waitFor(() => {
    expect(saved).toHaveBeenCalled();
  });
});

it("asks for a new check and for closing", async () => {
  const { client } = setup();
  const check = vi.fn();
  const hide = vi.fn<(payload: { reason?: string }) => void>();
  await listen("riven-manual-check", check);
  await listen<{ reason?: string }>("riven-overlay-hide", (e) => {
    hide(e.payload);
  });
  await mount(client);
  await show(PREVIEW_VIEW);
  await page.getByRole("button", { name: "New roll" }).click();
  await vi.waitFor(() => {
    expect(check).toHaveBeenCalled();
  });
  await page.getByRole("button", { name: "Close riven check" }).click();
  await vi.waitFor(() => {
    expect(hide).toHaveBeenCalledWith({ reason: "x-button" });
  });
});
