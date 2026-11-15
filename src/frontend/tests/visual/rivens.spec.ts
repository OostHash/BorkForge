import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** Rivens in browser mode: analyzer with keyboard weapon pick, saved rolls, owned rivens, selling — with axe. */

async function open(page: Page, query = "", viewport = { width: 1280, height: 900 }) {
  await page.setViewportSize(viewport);
  await page.clock.setFixedTime(new Date("2026-11-12T12:00:00Z"));
  await page.goto(`/mock.html${query}`);
  await page.getByRole("button", { name: "Rivens", exact: true }).click();
}

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations).toEqual([]);
}

async function pickSoma(page: Page) {
  const weapon = page.getByRole("combobox", { name: "Weapon" });
  await weapon.fill("som");
  await expect(page.getByRole("option", { name: "Soma Prime" })).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(weapon).toHaveValue("Soma");
}

test("analyzer with a roll", async ({ page }) => {
  await open(page);
  await expect(page.getByText("9 weapons loaded")).toBeVisible();
  await pickSoma(page);
  await page.getByRole("button", { name: "Critical Damage", exact: true }).click();
  await page.getByRole("button", { name: "Multishot", exact: true }).click();
  await page.getByRole("button", { name: "Zoom", exact: true }).click();
  await page.getByRole("button", { name: "Zoom is positive; make it negative" }).click();
  await page.getByRole("textbox", { name: "Critical Damage value" }).fill("112");
  await expect(page.getByRole("region", { name: "Analysis" }).getByText("Safe negative")).toBeVisible();
  await axe(page);
  await expect(page).toHaveScreenshot("rivens-analyzer.png", { fullPage: true });
});

test("saved rolls compared", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Compare Soma · 2 Nov 2026" }).click();
  await page.getByRole("button", { name: "Compare Soma · 5 Nov 2026" }).click();
  await expect(page.getByRole("region", { name: "Comparison" })).toBeVisible();
  await axe(page);
  await expect(page.getByRole("region", { name: "Comparison" })).toHaveScreenshot("rivens-compare.png");
});

test("my rivens", async ({ page }) => {
  await open(page);
  await page.getByRole("tab", { name: "My rivens" }).click();
  await expect(page.getByRole("heading", { name: /^Soma/ })).toBeVisible();
  await expect(page.getByText(/Challenge: Kill X enemies with Headshots, while sliding/)).toBeVisible();
  await axe(page);
  await expect(page).toHaveScreenshot("rivens-owned.png");
});

test("sell as auction", async ({ page }) => {
  await open(page);
  await page.getByRole("tab", { name: "My rivens" }).click();
  await page.getByRole("button", { name: "Sell Soma riven" }).click();
  const dialog = page.getByRole("dialog", { name: "Post riven auction" });
  await dialog.getByRole("spinbutton", { name: "Buyout (platinum)" }).fill("50");
  await dialog.getByRole("button", { name: "Post auction" }).click();
  await expect(dialog.getByText("Buyout price must be at least the starting price.")).toBeVisible();
  await axe(page);
  await expect(dialog).toHaveScreenshot("rivens-sell.png");
  await dialog.getByRole("spinbutton", { name: "Buyout (platinum)" }).fill("");
  await dialog.getByRole("button", { name: "Post auction" }).click();
  await expect(page.getByText("Auction posted")).toBeVisible();
});

test("narrow window", async ({ page }) => {
  await open(page, "", { width: 640, height: 480 });
  await pickSoma(page);
  await axe(page);
  await expect(page).toHaveScreenshot("rivens-narrow.png");
});

test("scenario empty", async ({ page }) => {
  await open(page, "?scenario=empty");
  await page.getByRole("tab", { name: "My rivens" }).click();
  await expect(page.getByText("No rivens found.")).toBeVisible();
  await axe(page);
  await expect(page).toHaveScreenshot("rivens-empty.png");
});
