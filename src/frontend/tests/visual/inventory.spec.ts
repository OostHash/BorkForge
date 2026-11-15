import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** Inventory screen in browser mode: cards, mods per rank, list, presets, states — with axe. */

async function open(page: Page, query = "", viewport = { width: 1280, height: 900 }) {
  await page.setViewportSize(viewport);
  await page.clock.setFixedTime(new Date("2026-11-12T12:00:00Z"));
  await page.addInitScript(() => {
    localStorage.removeItem("ff-view-inventory");
  });
  await page.goto(`/mock.html${query}`);
  await page.getByRole("button", { name: "Inventory", exact: true }).click();
}

/** Mastery, mod ranks and Foundry jobs arrive by the mock inventory-update event. */
async function liveLoaded(page: Page) {
  await expect(page.getByText("Mastered", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("group", { name: "Mod rank" })).toBeVisible();
}

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations).toEqual([]);
}

test("cards, owned only", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Owned", exact: true }).click();
  await liveLoaded(page);
  await expect(page.getByText("12p").first()).toBeVisible();
  await axe(page);
  await expect(page).toHaveScreenshot("inventory-cards.png");
});

test("mods with ranks", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: /^Mods/ }).click();
  await expect(page.getByRole("group", { name: "Mod rank" })).toBeVisible();
  await expect(page.getByRole("definition").first()).toBeVisible();
  await axe(page);
  await expect(page).toHaveScreenshot("inventory-mods.png");
});

test("list view", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Owned", exact: true }).click();
  await page.getByTitle("List", { exact: true }).click();
  await expect(page.getByRole("table", { name: "Inventory" })).toBeVisible();
  await liveLoaded(page);
  await axe(page);
  await expect(page).toHaveScreenshot("inventory-list.png");
});

test("presets popover", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Presets" }).click();
  await page.getByRole("button", { name: "Save current filters" }).click();
  await expect(page.getByRole("textbox", { name: "Preset name" })).toBeFocused();
  await axe(page);
  await expect(page.getByRole("dialog", { name: "Inventory presets" })).toHaveScreenshot("inventory-presets.png");
});

test("narrow window", async ({ page }) => {
  await open(page, "", { width: 640, height: 480 });
  await page.getByRole("button", { name: "Owned", exact: true }).click();
  await liveLoaded(page);
  await axe(page);
  await expect(page).toHaveScreenshot("inventory-narrow.png");
});

test("scenario empty", async ({ page }) => {
  await open(page, "?scenario=empty");
  await expect(page.getByText("No items found.")).toBeVisible();
  await axe(page);
  await expect(page).toHaveScreenshot("inventory-empty.png");
});
