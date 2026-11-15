import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { clearMocks } from "@tauri-apps/api/mocks";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../../theme/index.css";
import { RELIC_MASTERY } from "../../dev/fixtures/relics";
import { installMocks } from "../../dev/installMocks";
import { RelicsScreen } from "./RelicsScreen";

async function renderScreen(search = "") {
  installMocks(search);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["mastery"], RELIC_MASTERY);
  return render(
    <QueryClientProvider client={client}>
      <RelicsScreen />
    </QueryClientProvider>,
  );
}

describe("RelicsScreen — relics", () => {
  beforeEach(() => {
    localStorage.removeItem("ff-view-relic");
  });
  afterEach(() => {
    clearMocks();
  });

  it("lists relics, most owned first, with counts and pagination", async () => {
    const screen = await renderScreen();
    // Total and owned sit in the pager, after the page.
    await expect.element(screen.getByText("Page 1 of 2 · 40 relics · 5 owned")).toBeVisible();
    const first = screen.getByRole("article").first();
    await expect.element(first.getByRole("heading")).toHaveTextContent("Neo H5");
  });

  it("filters by era and ownership", async () => {
    const screen = await renderScreen();
    await userEvent.click(screen.getByRole("button", { name: "Lith", pressed: false }));
    await userEvent.click(screen.getByRole("button", { name: "Owned", exact: true }));
    await expect.element(screen.getByText("2 relics · 5 owned")).toBeVisible();
  });

  it("searches rewards and marks matching rewards", async () => {
    const screen = await renderScreen();
    await userEvent.fill(screen.getByRole("searchbox", { name: "Search relics and rewards" }), "galatine prime stock");
    await expect.element(screen.getByText("Rewards matching your search are marked “Match”.")).toBeVisible();
    await expect.element(screen.getByText("Match", { exact: true }).first()).toBeVisible();
  });

  it("shows owned and complete rewards as text", async () => {
    const screen = await renderScreen();
    await userEvent.fill(screen.getByRole("searchbox", { name: "Search relics and rewards" }), "lith b1");
    const card = screen.getByRole("article");
    await expect.element(card.getByText("4 Intact")).toBeVisible();
    // The Braton Prime Blueprint itself is in the inventory.
    await expect.element(card.getByRole("listitem").filter({ hasText: "Braton Prime BP" }).getByText("Owned")).toBeVisible();

    // Ash Prime is mastered (rank 30): its parts count as complete.
    await userEvent.fill(screen.getByRole("searchbox", { name: "Search relics and rewards" }), "lith k10");
    await expect.element(screen.getByRole("article").getByRole("listitem").filter({ hasText: "Ash Prime BP" }).getByText("Complete")).toBeVisible();
  });

  it("switches to the list view and remembers it", async () => {
    const screen = await renderScreen();
    await userEvent.click(screen.getByTitle("List", { exact: true }));
    await expect.element(screen.getByRole("table", { name: "Relics" })).toBeVisible();
    expect(localStorage.getItem("ff-view-relic")).toBe("list");
  });

  it("shows an error with retry", async () => {
    const screen = await renderScreen("?scenario=error");
    await expect.element(page.getByRole("alert").getByText("Could not load relic drop data")).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Retry" })).toBeVisible();
  });
});

describe("RelicsScreen — planner", () => {
  afterEach(() => {
    clearMocks();
  });

  it("ranks owned relics by Radiant value and opens details", async () => {
    const screen = await renderScreen();
    await userEvent.click(screen.getByRole("tab", { name: "Planner" }));
    await expect.element(screen.getByText("5 relics")).toBeVisible();
    await expect.element(screen.getByRole("columnheader", { name: "Radiant" })).toHaveAttribute("aria-sort", "descending");
    await userEvent.click(screen.getByRole("button", { name: "Owned only" }));
    await expect.element(screen.getByText("40 relics")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Owned only" }));
    await userEvent.click(screen.getByRole("button", { name: "Lith B1" }));
    await expect.element(page.getByRole("dialog", { name: "Lith B1" })).toBeVisible();
    await expect.element(page.getByRole("dialog").getByRole("table")).toBeVisible();
  });
});
