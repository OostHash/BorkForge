import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** Prime Sets and Mods & Arcanes (Inventory tabs) in browser mode: cards, item window and order form — with axe. */

async function open(page: Page, query = "", viewport = { width: 1280, height: 900 }) {
  await page.setViewportSize(viewport);
  await page.clock.setFixedTime(new Date("2026-11-12T12:00:00Z"));
  await page.goto(`/mock.html${query}`);
  await page.getByRole("button", { name: "Inventory", exact: true }).click();
  await page.getByRole("tab", { name: "Prime Sets" }).click();
}

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations).toEqual([]);
}

test("prime sets", async ({ page }) => {
  await open(page);
  await expect(page.getByRole("list", { name: "Parts of Nova Prime" })).toBeVisible();
  await expect(page.getByText("10 sets")).toBeVisible();
  await axe(page);
  await expect(page).toHaveScreenshot("market-sets.png");
});

test("prime sets with dupes", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Dupes", exact: true }).click();
  await expect(page.getByText("1 set", { exact: true })).toBeVisible();
  await axe(page);
  await expect(page).toHaveScreenshot("market-sets-dupes.png");
});

test("mods and arcanes", async ({ page }) => {
  await open(page);
  await page.getByRole("tab", { name: "Mods & Arcanes" }).click();
  await expect(page.getByRole("list", { name: "Serration by rank" })).toBeVisible();
  await axe(page);
  await expect(page).toHaveScreenshot("market-mods.png");
});

test("item window with orders", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: /^Nova Prime — show set orders/ }).click();
  const dialog = page.getByRole("dialog", { name: /Nova Prime Set/ });
  await expect(dialog.getByRole("table", { name: "Sellers of Nova Prime Set" }).getByRole("row")).toHaveCount(6);
  await expect(dialog.getByRole("img", { name: /Price over the last three weeks/ })).toBeVisible();
  await axe(page);
  await expect(dialog).toHaveScreenshot("market-item.png");
});

test("mod window at a rank, order form by keyboard", async ({ page }) => {
  await open(page);
  await page.getByRole("tab", { name: "Mods & Arcanes" }).click();
  await page.getByRole("button", { name: "Serration, R10 ×1 owned — show orders" }).click();
  const dialog = page.getByRole("dialog", { name: /Serration/ });
  await expect(dialog.getByRole("spinbutton", { name: "Showing rank" })).toHaveValue("10");
  await dialog.getByRole("button", { name: /^Sell at/ }).focus();
  await page.keyboard.press("Enter");
  const form = dialog.getByRole("form", { name: "New order" });
  await expect(form.getByRole("spinbutton", { name: "Rank (0–10)" })).toHaveValue("10");
  await axe(page);
  await expect(dialog).toHaveScreenshot("market-order-form.png");
  await form.getByRole("button", { name: "Post order" }).click();
  await expect(page.getByText("Order posted")).toBeVisible();
});

test("narrow window", async ({ page }) => {
  await open(page, "", { width: 640, height: 480 });
  await expect(page.getByRole("list", { name: "Parts of Nova Prime" })).toBeVisible();
  await axe(page);
  await expect(page).toHaveScreenshot("market-narrow.png");
});

test("scenario empty", async ({ page }) => {
  await open(page, "?scenario=empty");
  await expect(page.getByText("No sets match.")).toBeVisible();
  await axe(page);
  await expect(page).toHaveScreenshot("market-empty.png");
});
