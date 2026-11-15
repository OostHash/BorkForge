import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** Modular window in browser mode: docked, pop-out page, reorder by keyboard, narrow window — with axe. */

const SETTINGS = {
  timerFavorites: ["cetus-cycle", "duviri-cycle"],
  fissureWatches: [
    { id: "w1", tier: "Lith", missionType: "Capture", variant: "any" },
    { id: "w2", tier: "Any", missionType: "Defense", variant: "any" },
  ],
  fissureNotifications: true,
  tracked: ["/Foundry/BratonPrime", "/Foundry/Volt"],
  favorites: ["/Res/Ferrite", "/Mods/Serration"],
};

async function open(page: Page, query = "", viewport = { width: 1280, height: 900 }) {
  await page.setViewportSize(viewport);
  await page.clock.setFixedTime(new Date("2026-11-12T12:00:00Z"));
  await page.addInitScript((settings) => {
    sessionStorage.setItem("ff-mock-settings", JSON.stringify(settings));
  }, SETTINGS);
  await page.goto(`/mock.html${query}`);
  await expect(page.getByRole("complementary", { name: "Modular window" }).getByText("Braton Prime")).toBeVisible();
}

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations).toEqual([]);
}

const panel = (page: Page) => page.getByRole("complementary", { name: "Modular window" });

test("docked", async ({ page }) => {
  await open(page);
  await expect(panel(page).getByText("Ready", { exact: true })).toBeVisible();
  await expect(panel(page).getByRole("list", { name: "Volt needs" }).getByText("Volt Chassis")).toBeVisible();
  await expect(panel(page).getByText("Capture")).toBeVisible();
  await axe(page);
  await expect(page).toHaveScreenshot("modular-docked.png");
});

test("reorder by keyboard", async ({ page }) => {
  await open(page);
  const up = panel(page).getByRole("button", { name: "Move Serration up" });
  await up.focus();
  await page.keyboard.press("Enter");
  const favorites = panel(page).getByRole("region", { name: /^Favorites/ });
  await expect(favorites.getByRole("listitem").first()).toContainText("Serration");
  await panel(page).getByRole("button", { name: "Move Favorites section up" }).click();
  await expect(panel(page).getByRole("heading", { level: 2 }).first()).toHaveText("Favorites (2)");
});

test("pop-out window", async ({ page }) => {
  await open(page, "?window=modular", { width: 360, height: 760 });
  await axe(page);
  await expect(page).toHaveScreenshot("modular-popout.png");
});

test("narrow window", async ({ page }) => {
  await open(page, "", { width: 900, height: 700 });
  await axe(page);
  await expect(page).toHaveScreenshot("modular-narrow.png");
});
