import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { clearMocks, mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";
import { SettingsDialog, type SettingsTab } from "./SettingsDialog";

type Call = { cmd: string; args: unknown };

beforeEach(() => {
  localStorage.clear();
});

afterEach(async () => {
  await cleanup();
  clearMocks();
});

/** A backend whose settings file merges saves, like the real one. */
function setup(initial: { settings?: Record<string, unknown>; session?: [string, string] | null } = {}) {
  const calls: Call[] = [];
  let settings: Record<string, unknown> = { ...initial.settings };
  mockWindows("main");
  mockIPC((cmd, args) => {
    calls.push({ cmd, args });
    switch (cmd) {
      case "load_settings":
        return JSON.stringify(settings);
      case "save_settings":
        settings = { ...settings, ...(JSON.parse((args as { json: string }).json) as Record<string, unknown>) };
        return null;
      case "wfm_get_session":
        return initial.session ?? null;
      case "get_item_list_status":
        return { count: 1200, recipe_count: 300 };
      case "get_system_locale":
        return "nl-NL";
      default:
        return null;
    }
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const saved = () => settings;
  return { calls, client, saved };
}

function Harness({ initialTab }: { initialTab: SettingsTab }) {
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  return <SettingsDialog open tab={tab} onTabChange={setTab} onClose={() => undefined} />;
}

const mount = (client: QueryClient, tab: SettingsTab = "general") =>
  render(
    <QueryClientProvider client={client}>
      <Harness initialTab={tab} />
    </QueryClientProvider>,
  );

it("turns the memory scanner on in the settings file", async () => {
  const { client, saved } = setup();
  await mount(client);
  const toggle = page.getByRole("switch", { name: "Enable memory scanner" });
  await expect.element(toggle).not.toBeChecked();
  await toggle.click();
  await expect.element(toggle).toBeChecked();
  expect(saved().memoryScannerEnabled).toBe(true);
});

it("no longer has a Foundry page size; it moved to the Foundry toolbar", async () => {
  const { client } = setup();
  await mount(client);
  await expect.element(page.getByRole("combobox", { name: "Items per page" })).not.toBeInTheDocument();
});

it("disables status automation while logged out", async () => {
  const { client } = setup();
  await mount(client, "market");
  await expect.element(page.getByText("Log in to warframe.market in Market → Trading to use these.")).toBeVisible();
  await expect.element(page.getByRole("switch", { name: "Go invisible on close" })).toBeDisabled();
});

it("clamps the auto-invisible minutes when the field is left", async () => {
  const { client, saved } = setup({ settings: { wfmAutoInvisible: true }, session: ["tenno", "online"] });
  await mount(client, "market");
  const field = page.getByRole("spinbutton", { name: "Minutes before going invisible" });
  await expect.element(field).toBeEnabled();
  await field.fill("900");
  await userEvent.tab();
  await expect.element(field).toHaveValue(480);
  expect(saved().wfmAutoInvisibleMins).toBe(480);
});

it("saves what Changed recently counts, defaulting to since HexDesk started", async () => {
  const { client, saved } = setup();
  await mount(client, "filters");
  const select = page.getByRole("combobox", { name: "Counts changes from" });
  await expect.element(select).toHaveValue("session");
  await select.selectOptions("Last 7 days");
  await vi.waitFor(() => {
    expect(saved().recentWindow).toBe("week");
  });
});

it("renames and deletes presets of the chosen page, keeping other pages", async () => {
  const presets = [
    { id: "a", name: "Primes", module: "inventory", createdAt: 1, filters: {} },
    { id: "b", name: "Ready", module: "foundry", createdAt: 2, filters: {} },
  ];
  const { client, saved } = setup({ settings: { filterPresets: { presets, restorePreviousFiltersOnPresetClick: false } } });
  await mount(client, "filters");
  await page.getByRole("button", { name: "Rename Primes" }).click();
  await page.getByRole("textbox", { name: "New name for Primes" }).fill("Prime parts");
  await page.getByRole("button", { name: "Save" }).click();
  await expect.element(page.getByText("Prime parts")).toBeVisible();

  await page.getByRole("button", { name: "Delete Prime parts" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect.element(page.getByText("No presets yet.")).toBeVisible();
  const stored = saved().filterPresets as { presets: Array<{ id: string }> };
  expect(stored.presets.map((p) => p.id)).toEqual(["b"]);
});

it("stores the colour-blind palette and density as preferences", async () => {
  const { client } = setup();
  await mount(client);
  await page.getByRole("switch", { name: "Colour-blind palette" }).click();
  expect(localStorage.getItem("ff-colorblind")).toBe("true");
  expect(document.documentElement.dataset.cvd).toBe("on");
  await page.getByText("Compact", { exact: true }).click();
  expect(localStorage.getItem("ff-density")).toBe("compact");
  expect(document.documentElement.dataset.density).toBe("compact");
  await page.getByRole("group", { name: "Theme" }).getByText("Light", { exact: true }).click();
  expect(localStorage.getItem("ff-theme")).toBe("light");
  expect(document.documentElement.dataset.resolvedTheme).toBe("light");
  await page.getByRole("group", { name: "Contrast" }).getByText("High", { exact: true }).click();
  expect(document.documentElement.dataset.resolvedContrast).toBe("high");
  await expect.element(page.getByText(/System locale: nl-NL/)).toBeVisible();
});

it("clears the inventory cache only after confirming", async () => {
  const { client, calls } = setup();
  client.setQueryData(["mastery"], { "/a": 30 });
  await mount(client, "data");
  await expect.element(page.getByText("1,200 items · 300 recipes cached")).toBeVisible();
  await page.getByRole("button", { name: "Clear cache" }).click();
  expect(calls.some((c) => c.cmd === "clear_cache")).toBe(false);
  await page.getByRole("dialog", { name: "Clear the inventory cache?" }).getByRole("button", { name: "Clear cache" }).click();
  await expect.element(page.getByText("Cache cleared.")).toBeVisible();
  expect(calls.some((c) => c.cmd === "clear_cache")).toBe(true);
  expect(client.getQueryData(["mastery"])).toEqual({});
});

it("refreshes the catalogue and reports the result", async () => {
  const { client } = setup();
  mockIPC((cmd) => {
    if (cmd === "fetch_item_list") return 1250;
    if (cmd === "get_item_list_status") return { count: 1250, recipe_count: 310 };
    if (cmd === "load_settings") return "{}";
    return null;
  });
  await mount(client, "data");
  await page.getByRole("button", { name: "Refresh catalogue" }).click();
  await expect.element(page.getByText("Loaded 1,250 items, 310 recipes.")).toBeVisible();
});
