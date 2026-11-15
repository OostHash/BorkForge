import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { clearMocks } from "@tauri-apps/api/mocks";
import { afterEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../../theme/index.css";
import { MASTERY } from "../../dev/fixtures/completionist";
import { installMocks } from "../../dev/installMocks";
import { FoundryScreen } from "./FoundryScreen";

/** Renders the screen and opens a syndicate group in the navigator (equipment is the default view). */
async function renderScreen(search = "", mastery: Record<string, number> = MASTERY, group = "Main Syndicates") {
  installMocks(search);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // Mastery arrives by event in the app; tests seed it directly.
  client.setQueryData(["mastery"], mastery);
  const screen = await render(
    <QueryClientProvider client={client}>
      <FoundryScreen />
    </QueryClientProvider>,
  );
  await userEvent.click(screen.getByRole("navigation", { name: "Foundry" }).getByRole("button", { name: new RegExp(`^${group}`) }));
  return screen;
}

describe("FoundryScreen — syndicates", () => {
  afterEach(() => {
    clearMocks();
  });

  const card = (name: string) => page.getByRole("article").filter({ hasText: name });

  it("shows cards with status, rank badge and collected percentage, without headings", async () => {
    const screen = await renderScreen();
    await expect.element(card("Vaykor Hek Blueprint").getByText("Blueprint", { exact: true })).toBeVisible();
    await expect.element(card("Vaykor Hek Blueprint").getByText(/^R5/)).toBeVisible();
    await expect.element(card("Vaykor Marelok").getByText("Complete")).toBeVisible();
    await expect.element(card("Scattered Justice").getByText(/^R1/)).toBeVisible();
    await expect.element(screen.getByRole("heading", { name: /Brave/ })).not.toBeInTheDocument();
    await expect.element(screen.getByText("Steel Meridian · 3 / 6 collected · 50%")).toBeVisible();
    await expect.element(screen.getByRole("tab", { name: /Meridian 50%/ })).toBeVisible();
  });

  it("filters to one rank with the rank pills", async () => {
    const screen = await renderScreen();
    await userEvent.click(screen.getByRole("group", { name: "Rank" }).getByRole("button", { name: /^R1 ?Brave/ }));
    await expect.element(card("Scattered Justice")).toBeVisible();
    await expect.element(card("Justice Blades")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "All ranks" }));
    await expect.element(card("Justice Blades")).toBeVisible();
  });

  it("filters to missing items and resets with Show all", async () => {
    const screen = await renderScreen();
    await userEvent.click(screen.getByRole("button", { name: "Missing only", pressed: false }));
    await expect.element(card("Scattered Justice")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Show all" }));
    await expect.element(card("Scattered Justice")).toBeVisible();
  });

  it("searches name and category", async () => {
    const screen = await renderScreen();
    await userEvent.fill(screen.getByRole("searchbox", { name: "Search Steel Meridian" }), "sigil");
    await expect.element(screen.getByText("Steel Meridian Sigil")).toBeVisible();
    await expect.element(screen.getByText("Justice Blades")).not.toBeInTheDocument();
  });

  it("shows Helminth in the labs and opens the recipe of the crafted result", async () => {
    const screen = await renderScreen("", MASTERY, "Research Labs");
    const rhino = card("Rhino Blueprint");
    await expect.element(rhino.getByText("Helminth")).toBeVisible();
    await expect.element(rhino.getByText(/^R\d/)).not.toBeInTheDocument();
    await expect.element(screen.getByRole("group", { name: "Category" })).toBeVisible();
    await userEvent.click(rhino.getByRole("button", { name: "Rhino Blueprint — show recipe" }));
    await expect.element(page.getByRole("dialog", { name: /Rhino/ })).toBeVisible();
  });

  it("explains when only this group has no data", async () => {
    const screen = await renderScreen("", MASTERY, "Other");
    await expect.element(screen.getByText("Nothing in Other yet")).toBeVisible();
  });

  it("shows a no-data state without stores", async () => {
    const screen = await renderScreen("?scenario=empty");
    await expect.element(screen.getByText("No data yet")).toBeVisible();
  });

  it("shows an error with retry instead of an empty list", async () => {
    const screen = await renderScreen("?scenario=error");
    await expect.element(screen.getByText("Could not load syndicate data")).toBeVisible();
  });
});
