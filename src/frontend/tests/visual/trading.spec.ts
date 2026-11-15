import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** Market → Trading in browser mode: login, listings, auctions, whispers via real (mocked) events — with axe. */

async function open(page: Page, query = "", viewport = { width: 1280, height: 900 }) {
  await page.setViewportSize(viewport);
  await page.clock.setFixedTime(new Date("2026-11-12T12:00:00Z"));
  await page.goto(`/mock.html${query}`);
  await page.getByRole("button", { name: "Market", exact: true }).click();
}

/** Emits a backend event through the mocked Tauri IPC, like the real backend would. */
async function emit(page: Page, event: string, payload: unknown) {
  await page.evaluate(
    async ([e, p]) => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args: unknown) => Promise<unknown> } })
        .__TAURI_INTERNALS__;
      await internals.invoke("plugin:event|emit", { event: e, payload: p });
    },
    [event, payload] as const,
  );
}

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations).toEqual([]);
}

test("listings and rivens", async ({ page }) => {
  await open(page);
  await expect(page.getByRole("table", { name: "Active listings" }).getByText("Nova Prime Set")).toBeVisible();
  await expect(page.getByRole("table", { name: "Riven listings" }).getByRole("row", { name: /Soma Prime/ })).toBeVisible();
  await axe(page);
  await expect(page).toHaveScreenshot("trading-listings.png");
});

test("delete asks first", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Delete Braton Prime Barrel" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete Braton Prime Barrel?" });
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
  await axe(page);
  await expect(dialog).toHaveScreenshot("trading-delete.png");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("table", { name: "Active listings" }).getByText("Braton Prime Barrel")).toBeVisible();
});

test("edit auction", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Edit Soma Prime Critaata" }).click();
  const dialog = page.getByRole("dialog", { name: /Soma Prime/ });
  await dialog.getByText("Direct sale", { exact: true }).click();
  await expect(dialog.getByText(/deletes and recreates the listing/)).toBeVisible();
  await axe(page);
  await expect(dialog).toHaveScreenshot("trading-auction.png");
});

test("whisper and finished sale arrive on another screen", async ({ page }) => {
  await open(page);
  await expect(page.getByRole("table", { name: "Active listings" })).toBeVisible();
  // The watcher lives in the app shell, so events count while Trading is closed.
  await page.getByRole("button", { name: "Timers", exact: true }).click();
  await emit(page, "wfm-whisper", { from: "Buyer1", message: "WTB Nova Prime Set for 180p", item: "Nova Prime Set", price: 180, timestamp: "12:00" });
  await emit(page, "wfm-whisper", { from: "Buyer2", message: "WTB Serration", item: "Serration", price: 14, timestamp: "12:01" });
  await page.getByRole("button", { name: "Market", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Trading (2 new)" })).toBeVisible();
  await page.getByText("Messages (2 new)").click();
  const buyer1 = page.getByRole("article").filter({ hasText: "Buyer1" });
  await expect(buyer1).toBeVisible();
  await emit(page, "trade-completed", { withPlayer: "Buyer1", tradeType: "sale", offeredItems: [{ name: "Nova Prime Blueprint", qty: 1 }] });
  await expect(buyer1.getByText("WFM quantity 2 → 1")).toBeVisible();
  await axe(page);
  await expect(page).toHaveScreenshot("trading-messages.png");
});

test("narrow window", async ({ page }) => {
  await open(page, "", { width: 640, height: 480 });
  await expect(page.getByRole("table", { name: "Active listings" })).toBeVisible();
  await axe(page);
  await expect(page).toHaveScreenshot("trading-narrow.png");
});

test("logged out", async ({ page }) => {
  await open(page, "?scenario=empty");
  await expect(page.getByRole("heading", { name: "Connect warframe.market" })).toBeVisible();
  await axe(page);
  await expect(page).toHaveScreenshot("trading-login.png");
});
