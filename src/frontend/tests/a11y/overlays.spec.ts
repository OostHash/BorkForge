import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** Opens each overlay on the kitchen sink and checks it with axe and a screenshot. */

const KITCHEN_SINK = "/mock.html?view=kitchen-sink";

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await page.goto(KITCHEN_SINK);
  await expect(page.getByRole("heading", { name: "Overlays" })).toBeVisible();
});

test("modal", async ({ page }) => {
  await page.getByRole("button", { name: "Open modal" }).click();
  const dialog = page.getByRole("dialog", { name: "Recipe: Excalibur Prime" });
  await expect(dialog).toBeVisible();
  await axe(page);
  await expect(page).toHaveScreenshot("overlay-modal.png");
});

test("confirm dialog", async ({ page }) => {
  await page.getByRole("button", { name: "Delete watch" }).click();
  await expect(page.getByRole("button", { name: "Cancel" })).toBeFocused();
  await axe(page);
  await expect(page).toHaveScreenshot("overlay-confirm.png");
});

test("popover", async ({ page }) => {
  await page.getByRole("button", { name: "Filters" }).click();
  await expect(page.getByRole("dialog", { name: "Filters" })).toBeVisible();
  await axe(page);
  await expect(page.getByRole("dialog", { name: "Filters" })).toHaveScreenshot("overlay-popover.png");
});

test("menu", async ({ page }) => {
  await page.getByRole("button", { name: "More actions" }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menu")).toBeVisible();
  await axe(page);
  await expect(page.getByRole("menu")).toHaveScreenshot("overlay-menu.png");
});

test("tooltip", async ({ page }) => {
  await page.getByRole("button", { name: "Hover or focus me" }).focus();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await axe(page);
});

test("toast", async ({ page }) => {
  await page.getByRole("button", { name: "Error" }).click();
  const region = page.getByRole("region", { name: "Notifications" });
  await expect(region).toContainText("Loading failed");
  await axe(page);
  await expect(region).toHaveScreenshot("overlay-toast.png");
});
