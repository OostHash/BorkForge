import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { clearMocks } from "@tauri-apps/api/mocks";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../../theme/index.css";
import { resetMockSettings } from "../../dev/fixtures/settings";
import { installMocks } from "../../dev/installMocks";
import { TimersScreen } from "./TimersScreen";

async function renderScreen(search = "") {
  installMocks(search);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TimersScreen />
    </QueryClientProvider>,
  );
}

const savedSettings = () => JSON.parse(sessionStorage.getItem("ff-mock-settings") ?? "{}") as Record<string, unknown>;

describe("TimersScreen", () => {
  beforeEach(() => {
    resetMockSettings();
  });
  afterEach(() => {
    clearMocks();
  });

  it("shows every section from the worldstate", async () => {
    const screen = await renderScreen();
    for (const title of [
      "World Cycles",
      "Bounties",
      "Daily & Weekly",
      "Events",
      "News & Promotions",
      "Alerts (1)",
      "Invasions (2)",
      "Void Fissures",
    ]) {
      await expect.element(screen.getByRole("heading", { name: title, exact: true })).toBeVisible();
    }
    await expect.element(screen.getByText("Cetus", { exact: true })).toBeVisible();
  });

  it("shows the saved duviri-cycle favourite as pinned (old id migrated)", async () => {
    const screen = await renderScreen();
    await expect.element(screen.getByRole("button", { name: "Unpin Duviri Spiral" })).toHaveAttribute("aria-pressed", "true");
  });

  it("pins a timer and saves it to settings", async () => {
    const screen = await renderScreen();
    await userEvent.click(screen.getByRole("button", { name: "Pin Orb Vallis to the modular window" }));
    await expect.element(screen.getByRole("button", { name: "Unpin Orb Vallis" })).toHaveAttribute("aria-pressed", "true");
    expect(savedSettings().timerFavorites).toEqual(["cetus-cycle", "duviri-spiral", "vallis-cycle"]);
  });

  it("expands the sortie with a real disclosure button", async () => {
    const screen = await renderScreen();
    const toggle = screen.getByRole("button", { name: "Sortie", exact: true });
    await expect.element(toggle).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(toggle);
    await expect.element(toggle).toHaveAttribute("aria-expanded", "true");
    await expect.element(screen.getByRole("list", { name: "Sortie missions" })).toBeVisible();
  });

  it("marks owned items in Baro's inventory", async () => {
    const screen = await renderScreen();
    await userEvent.click(screen.getByRole("button", { name: "Baro Ki'Teer", exact: true }));
    const list = screen.getByRole("list", { name: "Baro Ki'Teer inventory" });
    await expect.element(list.getByRole("listitem").filter({ hasText: "Primed Continuity" }).getByText("Owned")).toBeVisible();
  });

  it("switches fissure modes with tabs and marks watched fissures", async () => {
    const screen = await renderScreen();
    const fissures = screen.getByRole("region", { name: "Void Fissures" });
    await expect.element(fissures.getByText("Watched")).toBeVisible();
    await userEvent.click(fissures.getByRole("tab", { name: /Steel Path/ }));
    await expect.element(fissures.getByText("Gabii (Ceres)")).toBeVisible();
  });

  it("adds and removes a fissure watch", async () => {
    const screen = await renderScreen();
    await userEvent.click(screen.getByRole("button", { name: /Watches/ }));
    await userEvent.click(screen.getByRole("group", { name: "Tier" }).getByText("Axi", { exact: true }));
    await userEvent.click(screen.getByRole("button", { name: "Add watch" }));
    await expect.element(screen.getByRole("button", { name: "Remove watch Axi" })).toBeVisible();
    expect((savedSettings().fissureWatches as unknown[]).length).toBe(2);
    await userEvent.click(screen.getByRole("button", { name: "Remove watch Lith · Capture" }));
    await expect.element(screen.getByRole("button", { name: "Remove watch Lith · Capture" })).not.toBeInTheDocument();
  });

  it("shows an empty fissure state", async () => {
    const screen = await renderScreen("?scenario=empty");
    await expect.element(screen.getByText("No active normal fissures.")).toBeVisible();
  });

  it("shows an error with a retry action", async () => {
    const screen = await renderScreen("?scenario=error");
    await expect.element(page.getByRole("alert").getByText("Could not load the worldstate")).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Retry" })).toBeVisible();
  });
});
