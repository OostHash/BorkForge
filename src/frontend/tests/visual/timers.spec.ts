import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Timers screen in browser mode. The clock is frozen so countdowns and the
 * Duviri mood are identical on every run (fixtures are relative to "now").
 */
const NOW = new Date("2026-11-12T12:00:00Z");

async function open(page: Page, query = "", viewport = { width: 1280, height: 900 }) {
  await page.setViewportSize(viewport);
  await page.clock.setFixedTime(NOW);
  await page.addInitScript(() => {
    sessionStorage.removeItem("ff-mock-settings");
  });
  await page.goto(`/mock.html${query}`);
  await page.getByRole("button", { name: "Timers", exact: true }).click();
}

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations).toEqual([]);
}

test("default", async ({ page }) => {
  await open(page);
  await expect(page.getByRole("heading", { name: "Void Fissures" })).toBeVisible();
  await axe(page);
  await expect(page).toHaveScreenshot("timers-default.png");
});

test("expanded tiles and watch panel", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Sortie", exact: true }).click();
  await page.getByRole("button", { name: "Baro Ki'Teer", exact: true }).click();
  await page.getByRole("button", { name: /Watches/ }).click();
  await expect(page.getByRole("group", { name: "Mode" })).toBeVisible();
  await axe(page);
  await page.getByRole("heading", { name: "Daily & Weekly" }).scrollIntoViewIfNeeded();
  await expect(page).toHaveScreenshot("timers-expanded.png");
  await page.getByRole("group", { name: "Mode" }).scrollIntoViewIfNeeded();
  await expect(page.getByRole("region", { name: "Void Fissures" })).toHaveScreenshot("timers-watch-panel.png");
});

test("narrow window", async ({ page }) => {
  await open(page, "", { width: 640, height: 480 });
  await expect(page.getByRole("heading", { name: "World Cycles" })).toBeVisible();
  await axe(page);
  await expect(page).toHaveScreenshot("timers-narrow.png");
});

for (const scenario of ["loading", "empty", "error"] as const) {
  test(`scenario ${scenario}`, async ({ page }) => {
    await open(page, `?scenario=${scenario}`);
    const ready = {
      loading: page.getByText("Loading worldstate…"),
      empty: page.getByText("No active normal fissures."),
      error: page.getByText("Could not load the worldstate"),
    }[scenario];
    await expect(ready).toBeAttached();
    await axe(page);
    await expect(page).toHaveScreenshot(`timers-${scenario}.png`);
  });
}

test("the window itself never scrolls, only the screen panel", async ({ page }) => {
  await open(page, "", { width: 1280, height: 600 });
  await expect(page.getByRole("heading", { name: "World Cycles" })).toBeVisible();
  const scroll = await page.evaluate(() => ({ doc: document.documentElement.scrollHeight, view: window.innerHeight }));
  expect(scroll.doc).toBe(scroll.view);
  await page.mouse.move(700, 300);
  await page.mouse.wheel(0, 5000);
  expect(await page.evaluate(() => document.documentElement.scrollTop)).toBe(0);
});
