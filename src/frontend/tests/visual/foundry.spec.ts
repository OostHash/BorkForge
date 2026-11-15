import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** Foundry equipment view in browser mode: cards, list, recipe modal, ready filter, states — with axe. */

async function open(page: Page, query = "", viewport = { width: 1280, height: 900 }) {
  await page.setViewportSize(viewport);
  await page.clock.setFixedTime(new Date("2026-11-12T12:00:00Z"));
  await page.addInitScript(() => {
    localStorage.removeItem("ff-view-foundry");
  });
  await page.goto(`/mock.html${query}`);
  await page.getByRole("button", { name: "Foundry", exact: true }).click();
}

/** Mastery, shards, Forma and Foundry jobs arrive by the mock inventory-update event. */
async function liveLoaded(page: Page) {
  await expect(page.getByText("Forma ×3")).toBeVisible();
  await expect(page.getByText("Building", { exact: true }).first()).toBeVisible();
}

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations).toEqual([]);
}

test("cards", async ({ page }) => {
  await open(page);
  await liveLoaded(page);
  await expect(page.getByRole("list", { name: "Parts of Excalibur Prime", exact: true })).toBeVisible();
  await axe(page);
  await expect(page).toHaveScreenshot("foundry-cards.png");
});

test("ready filter", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Ready to build", exact: true }).click();
  await expect(page.getByText(/^1 item · /)).toBeVisible();
  await axe(page);
  await expect(page).toHaveScreenshot("foundry-ready.png");
});

test("list view", async ({ page }) => {
  await open(page);
  await page.getByTitle("List", { exact: true }).click();
  await expect(page.getByRole("table", { name: "Foundry" })).toBeVisible();
  await expect(page.getByText("Building", { exact: true }).first()).toBeVisible();
  await axe(page);
  await expect(page).toHaveScreenshot("foundry-list.png");
});

test("recipe tree", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: /^Excalibur Prime — show recipe/ }).click();
  const dialog = page.getByRole("dialog", { name: /Excalibur Prime/ });
  await expect(dialog.getByRole("treegrid")).toBeVisible();
  await expect(dialog.getByText("14 / 20 · −6")).toBeVisible();
  await axe(page);
  await expect(dialog).toHaveScreenshot("foundry-recipe-tree.png");
});

test("recipe shopping list, keyboard", async ({ page }) => {
  await open(page);
  const recipe = page.getByRole("button", { name: /^Excalibur Prime — show recipe/ });
  await recipe.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: /Excalibur Prime/ });
  await dialog.getByRole("tab", { name: "Full tree" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(dialog.getByRole("tab", { name: "What I need" })).toHaveAttribute("aria-selected", "true");
  await expect(dialog.getByRole("table", { name: "Missing for Excalibur Prime" })).toBeVisible();
  await axe(page);
  await expect(dialog).toHaveScreenshot("foundry-recipe-needs.png");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(recipe).toBeFocused();
});

test("narrow window", async ({ page }) => {
  await open(page, "", { width: 640, height: 480 });
  await liveLoaded(page);
  await axe(page);
  await expect(page).toHaveScreenshot("foundry-narrow.png");
});

test("scenario empty", async ({ page }) => {
  await open(page, "?scenario=empty");
  await expect(page.getByText("No recipes loaded.")).toBeVisible();
  await axe(page);
  await expect(page).toHaveScreenshot("foundry-empty.png");
});

test("scenario error", async ({ page }) => {
  await open(page, "?scenario=error");
  await expect(page.getByText("Could not load the recipes.")).toBeVisible();
  await axe(page);
  await expect(page).toHaveScreenshot("foundry-error.png");
});
