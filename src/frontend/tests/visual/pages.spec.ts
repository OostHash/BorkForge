import { expect, test } from "@playwright/test";
import { PAGES } from "../support/pages";

for (const page of PAGES) {
  test(`${page.name} looks unchanged`, async ({ page: browserPage }) => {
    // Frozen clock: the main window shows live countdowns.
    await browserPage.clock.setFixedTime(new Date("2026-11-12T12:00:00Z"));
    await browserPage.goto(page.path);
    await expect(browserPage.locator("main")).toBeVisible();
    await expect(browserPage).toHaveScreenshot(`${page.name}.png`, { fullPage: true });
  });
}

test("window label from ?window= reaches the router", async ({ page }) => {
  await page.goto("/mock.html?window=riven-overlay");
  await expect(page.getByRole("main", { name: "Riven check" })).toBeVisible();
});

test("pre-paint sets theme attributes before the app mounts", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("ff-density", "compact");
  });
  // Block the app bundle: only the inline pre-paint script can set attributes.
  await page.route("**/src/**", (route) => route.abort());
  await page.goto("/mock.html");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-resolved-theme", "dark");
  await expect(html).toHaveAttribute("data-density", "compact");
});

test("overlay windows keep a transparent background", async ({ page }) => {
  await page.goto("/mock.html?window=riven-overlay");
  await expect(page.getByRole("main", { name: "Riven check" })).toBeVisible();
  const bg = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
  expect(bg).toBe("rgba(0, 0, 0, 0)");
});
