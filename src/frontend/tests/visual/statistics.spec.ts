import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** Market statistics (Trade report, Item report tabs) in browser mode: trade analytics, log, item report with a keyboard-readable chart — with axe. */

async function open(page: Page, query = "", viewport = { width: 1280, height: 900 }) {
  await page.setViewportSize(viewport);
  await page.clock.setFixedTime(new Date("2026-11-12T12:00:00Z"));
  await page.addInitScript(() => {
    localStorage.removeItem("ff-item-report-order");
  });
  await page.goto(`/mock.html${query}`);
  await page.getByRole("button", { name: "Market", exact: true }).click();
  await page.getByRole("tab", { name: "Trade report" }).click();
}

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations).toEqual([]);
}

test("trade analytics", async ({ page }) => {
  await open(page);
  await expect(page.getByRole("table", { name: "Top warframe.market items" })).toBeVisible();
  await expect(page.getByText("8 trades")).toBeVisible();
  await axe(page);
  await expect(page).toHaveScreenshot("statistics-analytics.png");
});

test("trade log, all time", async ({ page }) => {
  await open(page);
  await page.getByText("Log", { exact: true }).click();
  await page.getByText("All", { exact: true }).click();
  await expect(page.getByText("9 trades")).toBeVisible();
  await expect(page.getByRole("list", { name: "Trade log" }).getByRole("article")).toHaveCount(8);
  await axe(page);
  await expect(page).toHaveScreenshot("statistics-log.png");
});

test("item report, chart by keyboard", async ({ page }) => {
  await open(page);
  await page.getByRole("tab", { name: "Item report" }).click();
  const chart = page.getByRole("slider", { name: "Ferrite quantity, last 30 days" });
  await chart.focus();
  await page.keyboard.press("Home");
  await expect(chart).toHaveAttribute("aria-valuetext", /^13 Oct: /);
  await page.keyboard.press("ArrowRight");
  await expect(chart).toHaveAttribute("aria-valuenow", "1");
  await axe(page);
  await expect(page).toHaveScreenshot("statistics-items.png");
});

test("narrow window", async ({ page }) => {
  await open(page, "", { width: 640, height: 480 });
  await expect(page.getByRole("table", { name: "Top warframe.market items" })).toBeVisible();
  await axe(page);
  await expect(page).toHaveScreenshot("statistics-narrow.png");
});

test("scenario empty", async ({ page }) => {
  await open(page, "?scenario=empty");
  await expect(page.getByText("No trade history yet.")).toBeVisible();
  await axe(page);
  await expect(page).toHaveScreenshot("statistics-empty.png");
});
