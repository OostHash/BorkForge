import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { ScreenBoundary } from "./ScreenBoundary";

afterEach(async () => {
  await cleanup();
  vi.restoreAllMocks();
});

let shouldThrow = true;
function Flaky() {
  const [ok] = useState(() => !shouldThrow);
  if (!ok) throw new Error("boom");
  return <p>Screen content</p>;
}

it("shows the error instead of the screen, and Try again mounts it anew", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  shouldThrow = true;
  await render(
    <ScreenBoundary label="Inventory">
      <Flaky />
    </ScreenBoundary>,
  );
  await expect.element(page.getByText("Inventory ran into a problem")).toBeVisible();
  await expect.element(page.getByText("boom")).toBeVisible();

  shouldThrow = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect.element(page.getByText("Screen content")).toBeVisible();
  expect(page.getByText("Inventory ran into a problem").query()).toBeNull();
});
