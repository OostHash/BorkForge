import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { clearMocks, mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { afterEach, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";
import { BatchPreviewDialog } from "./BatchPreviewDialog";

afterEach(async () => {
  await cleanup();
  clearMocks();
});

function mount(onClose = vi.fn()) {
  mockWindows("main");
  mockIPC(() => null);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <BatchPreviewDialog open onClose={onClose} />
    </QueryClientProvider>,
  );
}

const cards = () => page.getByRole("list", { name: "Preview cards" }).getByRole("article");

it("shows the inventory's cards for each kind of change", async () => {
  await mount();
  await expect.element(cards()).toHaveLength(4);
  await expect.element(page.getByText("+12 · now")).toBeVisible();
  await expect.element(cards().nth(2).getByText("Building", { exact: true })).toBeVisible();
  await expect.element(page.getByRole("definition").first()).toHaveTextContent("2");
  await page.getByText("Lost", { exact: true }).click();
  await expect.element(cards()).toHaveLength(1);
  await expect.element(page.getByText("−3 · now")).toBeVisible();
});

it("drops the change badges after five minutes, and closes", async () => {
  const onClose = vi.fn();
  await mount(onClose);
  await page.getByText("After 5 min", { exact: true }).click();
  await expect.element(cards()).toHaveLength(4);
  expect(page.getByText(/· now/).query()).toBeNull();
  await page.getByRole("button", { name: "Close" }).click();
  expect(onClose).toHaveBeenCalled();
});
