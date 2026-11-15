import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { clearMocks, mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { afterEach, expect, it } from "vitest";
import { page } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";
import { ModularWindow } from "./ModularWindow";

afterEach(async () => {
  await cleanup();
  clearMocks();
});

const part = (unique_name: string, name: string, count = 1, components: unknown[] = []) => ({
  unique_name,
  name,
  count,
  result_count: 1,
  components,
});

/** A backend whose settings file merges saves, like the real one. */
function setup(initial: Record<string, unknown>) {
  let settings: Record<string, unknown> = { ...initial };
  mockWindows("main");
  mockIPC((cmd, args) => {
    switch (cmd) {
      case "load_settings":
        return JSON.stringify(settings);
      case "save_settings":
        settings = { ...settings, ...(JSON.parse((args as { json: string }).json) as Record<string, unknown>) };
        return null;
      case "get_craftable_items":
        return [
          { unique_name: "/braton", name: "Braton Prime", category: "Primary" },
          { unique_name: "/volt", name: "Volt", category: "Warframes" },
        ];
      case "get_recipes_bulk":
        return {
          "/braton": [part("/bp", "Braton Prime Blueprint"), part("/ferrite", "Ferrite", 100)],
          "/volt": [part("/voltBp", "Volt Blueprint")],
        };
      case "get_current_quantities":
        return { "/ferrite": 150, "/serration": 3 };
      case "get_saved_inventory":
        return { consumedSuits: [] };
      case "get_all_items":
        return [
          { unique_name: "/serration", name: "Serration", category: "Mods" },
          { unique_name: "/ferrite", name: "Ferrite", category: "Resources" },
        ];
      case "fetch_worldstate":
        return {};
      default:
        return null;
    }
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return { client, saved: () => settings };
}

const mount = (client: QueryClient) =>
  render(
    <QueryClientProvider client={client}>
      <ModularWindow />
    </QueryClientProvider>,
  );

it("shows what tracked items still need, and all of it on request", async () => {
  const { client } = setup({ tracked: ["/braton"] });
  await mount(client);
  const needs = page.getByRole("list", { name: "Braton Prime needs" });
  await expect.element(needs.getByText("Braton Prime Blueprint")).toBeVisible();
  // Ferrite is covered (150 / 100): hidden under Missing, shown under All.
  expect(needs.getByText("Ferrite").query()).toBeNull();
  await page.getByText("All", { exact: true }).click();
  await expect.element(needs.getByText("Ferrite")).toBeVisible();
});

it("collapses an item's needs and stops tracking it", async () => {
  const { client, saved } = setup({ tracked: ["/braton", "/volt"] });
  await mount(client);
  const toggle = page.getByRole("button", { name: "Braton Prime" });
  await expect.element(toggle).toHaveAttribute("aria-expanded", "true");
  await toggle.click();
  await expect.element(toggle).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "Stop tracking Braton Prime" }).click();
  await expect.element(page.getByRole("button", { name: "Braton Prime" })).not.toBeInTheDocument();
  expect(saved().tracked).toEqual(["/volt"]);
});

it("reorders favourites and sections, and saves the order", async () => {
  const { client, saved } = setup({ favorites: ["/ferrite", "/serration"] });
  await mount(client);
  await expect.element(page.getByText("150")).toBeVisible();
  await page.getByRole("button", { name: "Move Serration up" }).click();
  expect(saved().favorites).toEqual(["/serration", "/ferrite"]);
  await page.getByRole("button", { name: "Move Favorites section up" }).click();
  expect(saved().modularSectionOrder).toEqual(["favorites", "tracking", "timers", "fissures"]);
});

it("explains empty sections", async () => {
  const { client } = setup({});
  await mount(client);
  await expect.element(page.getByText("Star ☆ items in Foundry to track them.")).toBeVisible();
  await expect.element(page.getByText("Pin ☆ timers in the Timers tab to show them here.")).toBeVisible();
  await expect.element(page.getByText("Add fissure watches in the Timers tab.")).toBeVisible();
});
