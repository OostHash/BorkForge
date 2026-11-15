import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** Relics screen in browser mode: cards, list, search highlight, planner, states — with axe. */

async function open(page: Page, query = "", viewport = { width: 1280, height: 900 }) {
  await page.setViewportSize(viewport);
  await page.clock.setFixedTime(new Date("2026-11-12T12:00:00Z"));
  await page.addInitScript(() => {
    localStorage.removeItem("ff-view-relic");
  });
  await page.goto(`/mock.html${query}`);
  await page.getByRole("button", { name: "Relics" }).click();
}

/** Mastery arrives by the mock inventory-update event; Ash Prime parts turn "Complete" once it has. */
async function masteryLoaded(page: Page) {
  await expect(page.getByText("Complete", { exact: true }).first()).toBeVisible();
}

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations).toEqual([]);
}

test("cards", async ({ page }) => {
  await open(page);
  // Mastery arrives by the mock inventory event; wait until the count is final.
  await expect(page.getByText("40 relics · 5 owned")).toBeVisible();
  await masteryLoaded(page);
  await axe(page);
  await expect(page).toHaveScreenshot("relics-cards.png");
});

test("search highlights rewards", async ({ page }) => {
  await open(page);
  await page.getByRole("searchbox", { name: "Search relics and rewards" }).fill("ash prime");
  await expect(page.getByText("Rewards matching your search are marked “Match”.")).toBeVisible();
  await masteryLoaded(page);
  await axe(page);
  await expect(page).toHaveScreenshot("relics-search.png");
});

test("list view", async ({ page }) => {
  await open(page);
  await page.getByTitle("List", { exact: true }).click();
  await expect(page.getByRole("table", { name: "Relics" })).toBeVisible();
  await axe(page);
  await expect(page).toHaveScreenshot("relics-list.png");
});

test("planner with details", async ({ page }) => {
  await open(page);
  await page.getByRole("tab", { name: "Planner" }).click();
  await expect(page.getByRole("table", { name: "Relic planner" })).toBeVisible();
  await axe(page);
  await expect(page).toHaveScreenshot("relics-planner.png");
  await page.getByRole("button", { name: "Neo H5" }).click();
  await expect(page.getByRole("dialog", { name: "Neo H5" })).toBeVisible();
  await axe(page);
  await expect(page.getByRole("dialog")).toHaveScreenshot("relics-planner-details.png");
});

test("narrow window", async ({ page }) => {
  await open(page, "", { width: 640, height: 480 });
  await expect(page.getByText("40 relics · 5 owned")).toBeVisible();
  await masteryLoaded(page);
  await axe(page);
  await expect(page).toHaveScreenshot("relics-narrow.png");
});

for (const scenario of ["empty", "error"] as const) {
  test(`scenario ${scenario}`, async ({ page }) => {
    await open(page, `?scenario=${scenario}`);
    await expect(page.getByText(scenario === "empty" ? "No relics match." : "Could not load relic drop data")).toBeVisible();
    await axe(page);
    await expect(page).toHaveScreenshot(`relics-${scenario}.png`);
  });
}
