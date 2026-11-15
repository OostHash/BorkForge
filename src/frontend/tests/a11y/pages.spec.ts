import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { PAGES } from "../support/pages";

for (const page of PAGES) {
  test(`${page.name} has no axe violations`, async ({ page: browserPage }) => {
    await browserPage.goto(page.path);
    await expect(browserPage.locator("main")).toBeVisible();
    let axe = new AxeBuilder({ page: browserPage }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]);
    if (page.transparent) axe = axe.disableRules(["color-contrast"]);
    const results = await axe.analyze();
    expect(results.violations).toEqual([]);
  });
}
