import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { clearMocks, mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";
import { SettingsScreen, type SettingsTab } from "./SettingsScreen";

type Call = { cmd: string; args: unknown };

const SAVED = "C:/Users/Tenno/Downloads/hexdesk-diagnostics-2026-11-18-150312.zip";

beforeEach(() => {
  localStorage.clear();
});

afterEach(async () => {
  await cleanup();
  clearMocks();
});

/** A backend that exports to SAVED; `overrides` answer single commands. */
function setup(overrides: Record<string, (args: unknown) => unknown> = {}) {
  const calls: Call[] = [];
  mockWindows("main");
  mockIPC((cmd, args) => {
    calls.push({ cmd, args });
    const override = overrides[cmd];
    if (override) return override(args);
    if (cmd === "load_settings") return "{}";
    if (cmd === "export_diagnostics") return SAVED;
    return null;
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const find = (cmd: string) => calls.filter((c) => c.cmd === cmd);
  return { client, find };
}

function Harness() {
  const [tab, setTab] = useState<SettingsTab>("debugging");
  return <SettingsScreen tab={tab} onTabChange={setTab} />;
}

const mount = (client: QueryClient) =>
  render(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>,
  );

const row = (name: string) => page.getByRole("group", { name, exact: true });

it("exports diagnostics and then offers to show the zip in its folder", async () => {
  const { client, find } = setup();
  await mount(client);
  const exportRow = row("Diagnostics export");
  await expect.element(exportRow.getByRole("button", { name: "Show in folder" })).not.toBeInTheDocument();
  await exportRow.getByRole("button", { name: "Export" }).click();
  await expect.element(exportRow.getByRole("status")).toHaveTextContent(`Saved to ${SAVED}`);
  await exportRow.getByRole("button", { name: "Show in folder" }).click();
  await vi.waitFor(() => {
    expect(find("show_diagnostics_export").map((c) => c.args)).toEqual([{ path: SAVED }]);
  });
});

it("shows why an export failed", async () => {
  const { client } = setup({ export_diagnostics: () => Promise.reject(new Error("the zip file could not be created")) });
  await mount(client);
  await row("Diagnostics export").getByRole("button", { name: "Export" }).click();
  await expect.element(row("Diagnostics export").getByRole("status")).toHaveTextContent("Export failed: the zip file could not be created");
});

it("has none of the old FrameForge debug tools", async () => {
  const { client } = setup();
  await mount(client);
  await expect.element(row("Diagnostics export")).toBeVisible();
  for (const old of [
    "Overlay log",
    "Relic captures",
    "Inventory snapshots",
    "Memory probe",
    "Raw memory record",
    "Unmatched paths",
    "Incoming batch",
  ]) {
    await expect.element(row(old)).not.toBeInTheDocument();
  }
});

it("keeps the developer pages under Debugging", async () => {
  const { client } = setup();
  await mount(client);
  await expect.element(row("Kitchen sink").getByRole("button", { name: "Open" })).toBeVisible();
  await expect.element(row("Tokens").getByRole("button", { name: "Open" })).toBeVisible();
});
