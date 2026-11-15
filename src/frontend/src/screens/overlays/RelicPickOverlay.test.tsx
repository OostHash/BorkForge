import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { emit } from "@tauri-apps/api/event";
import { clearMocks, mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { afterEach, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";
import { PREVIEW_PICK } from "../../domain/relicPick";
import { RelicPickOverlay } from "./RelicPickOverlay";

afterEach(async () => {
  await cleanup();
  clearMocks();
});

function setup(settings: Record<string, unknown> = {}) {
  const calls: Array<{ cmd: string; args: unknown }> = [];
  mockWindows("relic-pick-overlay");
  mockIPC(
    (cmd, args) => {
      calls.push({ cmd, args });
      if (cmd === "load_settings") return JSON.stringify(settings);
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
      <RelicPickOverlay />
    </QueryClientProvider>,
  );

const open = async () => {
  await vi.waitFor(async () => {
    await emit("relic-pick-open", PREVIEW_PICK);
    expect(page.getByRole("main", { name: "Relic pick" }).query()).not.toBeNull();
  });
};

it("lets clicks through to the game from the start", async () => {
  const { client, calls } = setup();
  await mount(client);
  await vi.waitFor(() => {
    expect(calls.find((c) => c.cmd === "plugin:window|set_ignore_cursor_events")?.args).toMatchObject({ value: true });
  });
});

it("ranks the relics for the priority and lists their rewards", async () => {
  const { client } = setup({ relicPickPriority: "ducat" });
  await mount(client);
  await open();
  await expect.element(page.getByRole("heading", { name: "All Eras Fissure" })).toBeVisible();
  const order = () => [...document.querySelectorAll("ol[aria-label='Recommended relics'] h2")].map((h) => h.textContent);
  await vi.waitFor(() => {
    expect(order()).toEqual(["#1Meso N1Intact×226 ducats EV", "#2Axi R4Intact×120 ducats EV", "#3Lith S1Intact×318 ducats EV"]);
  });
  await expect.element(page.getByRole("list", { name: "Meso N1 rewards" }).getByRole("listitem")).toHaveLength(6);
});

it("shows the estimate line instead of rewards when asked", async () => {
  const { client } = setup({ relicPickLines: "estimated" });
  await mount(client);
  await open();
  await expect.element(page.getByText("5p · 20 ducats · 3/6 new")).toBeVisible();
  expect(page.getByRole("list", { name: "Axi R4 rewards" }).query()).toBeNull();
});

it("hides the window from the close button", async () => {
  const { client, calls } = setup();
  await mount(client);
  await open();
  await page.getByRole("button", { name: "Close relic pick" }).click();
  await expect.element(page.getByRole("main", { name: "Relic pick" })).not.toBeInTheDocument();
  expect(calls.some((c) => c.cmd === "plugin:window|hide")).toBe(true);
});

it("shows the preview, which live data replaces", async () => {
  const { client } = setup();
  await mount(client);
  await vi.waitFor(async () => {
    await emit("relic-pick-preview", {});
    expect(page.getByRole("main", { name: "Relic pick" }).query()).not.toBeNull();
  });
  await emit("relic-pick-open", { era: "NEO", relics: [] });
  await expect.element(page.getByText("No Neo relics in inventory")).toBeVisible();
  await emit("relic-pick-preview-close", {});
  await expect.element(page.getByText("No Neo relics in inventory")).toBeVisible();
});
