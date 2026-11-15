import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** Tabs, tree and the 5000-row table on the kitchen sink: axe, keyboard and screenshots. */

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/mock.html?view=kitchen-sink");
  await expect(page.getByRole("heading", { name: "Navigation and data" })).toBeVisible();
});

test("tabs, sidebar and pagination", async ({ page }) => {
  const section = page.getByRole("region", { name: "Navigation and data" });
  await axe(page);
  await expect(section).toHaveScreenshot("navdata-overview.png");
});

test("recipe tree", async ({ page }) => {
  await page.getByRole("tab", { name: "Recipe" }).click();
  const tree = page.getByRole("treegrid", { name: "Recipes" });
  await expect(tree).toBeVisible();
  await axe(page);
  await expect(tree).toHaveScreenshot("navdata-tree.png");
});

test("5000-row table scrolls to the end", async ({ page }) => {
  await page.getByRole("tab", { name: "Prices" }).click();
  const table = page.getByRole("table", { name: "Prices (5000 rows)" });
  await expect(table).toBeVisible();
  await axe(page);
  expect(await table.locator("tbody tr").count()).toBeLessThan(80);
  await table.locator("xpath=..").evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect(page.getByText("Part 5000", { exact: true })).toBeVisible();
});
