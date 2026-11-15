import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** Foundry syndicate views in browser mode: syndicates, labs and states, with axe. Equipment: foundry.spec.ts. */

async function open(page: Page, query = "", viewport = { width: 1280, height: 900 }) {
  await page.setViewportSize(viewport);
  await page.clock.setFixedTime(new Date("2026-11-12T12:00:00Z"));
  await page.goto(`/mock.html${query}`);
  await page.getByRole("button", { name: "Foundry", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Foundry" })
    .getByRole("button", { name: /^Main Syndicates/ })
    .click();
}

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations).toEqual([]);
}

test("syndicates", async ({ page }) => {
  await open(page);
  await expect(page.getByText("Steel Meridian · 3 / 6 collected · 50%")).toBeVisible();
  await axe(page);
  await expect(page).toHaveScreenshot("completionist-syndicates.png");
});

test("research labs with Helminth", async ({ page }) => {
  await open(page);
  await page
    .getByRole("navigation", { name: "Foundry" })
    .getByRole("button", { name: /^Research Labs/ })
    .click();
  await expect(page.getByText("Helminth")).toBeVisible();
  await axe(page);
  await expect(page).toHaveScreenshot("completionist-labs.png");
});

test("narrow window", async ({ page }) => {
  await open(page, "", { width: 640, height: 480 });
  await expect(page.getByText("Steel Meridian · 3 / 6 collected · 50%")).toBeVisible();
  await axe(page);
  await expect(page).toHaveScreenshot("completionist-narrow.png");
});

for (const scenario of ["empty", "error"] as const) {
  test(`scenario ${scenario}`, async ({ page }) => {
    await open(page, `?scenario=${scenario}`);
    await expect(page.getByText(scenario === "empty" ? "No data yet" : "Could not load syndicate data")).toBeVisible();
    await axe(page);
    await expect(page).toHaveScreenshot(`completionist-${scenario}.png`);
  });
}
