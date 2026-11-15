import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** Header in browser mode: account, status chips, data caches panel, narrow window — with axe. */

async function open(page: Page, query = "", viewport = { width: 1280, height: 900 }) {
  await page.setViewportSize(viewport);
  await page.clock.setFixedTime(new Date("2026-11-12T12:00:00Z"));
  await page.goto(`/mock.html${query}`);
  // Mock inventory-update events (default scenario only) carry the mastery rank.
  if (!query.includes("scenario=")) await expect(page.getByRole("banner").getByText("MR 27")).toBeVisible();
}

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations).toEqual([]);
}

test("account and status chips", async ({ page }) => {
  await open(page);
  const header = page.getByRole("banner");
  await expect(header.getByText("Tenno-Mock")).toBeVisible();
  await expect(header.getByText("Memory")).toBeVisible();
  // Logged in: the WFM chip is plain status, not a button.
  await expect(header.getByText("Online")).toBeVisible();
  await expect(header.getByRole("button", { name: /WFM/ })).toHaveCount(0);
  await expect(header.getByRole("button", { name: /^Data ?: stale$/ })).toBeVisible();
  await axe(page);
  await expect(header).toHaveScreenshot("header-default.png");
});

test("data caches panel, by keyboard", async ({ page }) => {
  await open(page);
  const chip = page.getByRole("button", { name: /^Data ?: stale$/ });
  await chip.focus();
  await page.keyboard.press("Enter");
  const panel = page.getByRole("dialog", { name: "Data caches" });
  await expect(panel.getByText("Drop Data")).toBeVisible();
  await expect(panel.getByText("stale · 2d ago")).toBeVisible();
  await expect(panel.getByText("fresh · 42s ago")).toBeVisible();
  await axe(page);
  await expect(page).toHaveScreenshot("header-data-panel.png");
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
});

test("logged out: the WFM chip opens Market on Trading", async ({ page }) => {
  await open(page, "?scenario=empty");
  await page.getByRole("button", { name: /^WFM ?: Not logged in$/ }).click();
  await expect(page.getByRole("tab", { name: "Trading", selected: true })).toBeVisible();
});

test("narrow window", async ({ page }) => {
  await open(page, "", { width: 760, height: 700 });
  await axe(page);
  await expect(page).toHaveScreenshot("header-narrow.png");
});
