import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { clearMocks, mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";
import { setBatchPreviewOpen, useBatchPreviewOpen } from "../../state/batchPreview";
import { SettingsDialog, type SettingsTab } from "./SettingsDialog";

type Call = { cmd: string; args: unknown };

beforeEach(() => {
  localStorage.clear();
  setBatchPreviewOpen(false);
});

afterEach(async () => {
  await cleanup();
  clearMocks();
});

const SIZES: Record<string, number> = { blobs: 2048, api_logs: 0, probe: 1536, raw_scan: 4096, unmatched_paths: 0 };

/** A backend with some debug data; `overrides` answer single commands. */
function setup(settings: Record<string, unknown> = {}, overrides: Record<string, (args: unknown) => unknown> = {}) {
  const calls: Call[] = [];
  let file: Record<string, unknown> = { ...settings };
  let rawScan = false;
  mockWindows("main");
  mockIPC((cmd, args) => {
    calls.push({ cmd, args });
    const override = overrides[cmd];
    if (override) return override(args);
    switch (cmd) {
      case "load_settings":
        return JSON.stringify(file);
      case "save_settings":
        file = { ...file, ...(JSON.parse((args as { json: string }).json) as Record<string, unknown>) };
        return null;
      case "get_debug_data_size":
        return SIZES[(args as { which: string }).which] ?? 0;
      case "get_diag_folder_size":
        return 10 * 1024 * 1024;
      case "toggle_raw_scan":
        rawScan = !rawScan;
        return rawScan ? "started" : "stopped";
      case "toggle_debug_categorization":
        return true;
      case "dump_memory_probe":
        return "a\nb\nc\n";
      case "capture_diagnostics":
        return "C:/Debug/Manual-Capture/x";
      case "export_diagnostics":
        return "C:/Users/Tenno/Downloads/hexdesk-diagnostics-2026-11-18-150312.zip";
      case "debug_ee_log_tail":
        return "12.3 Sys [Info]: ProjectionRewardChoice";
      case "test_relic_pick_overlay":
        return `Emitted relic-pick-open: era=${(args as { era: string }).era}, 3 relics in inventory`;
      case "get_overlay_session_log":
        return "[12:00] relic-trigger seen";
      default:
        return null;
    }
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const find = (cmd: string) => calls.filter((c) => c.cmd === cmd);
  return { client, find, saved: () => file };
}

function Harness() {
  const [tab, setTab] = useState<SettingsTab>("debugging");
  const preview = useBatchPreviewOpen();
  return (
    <>
      <SettingsDialog open tab={tab} onTabChange={setTab} onClose={() => undefined} />
      <output aria-label="Batch preview">{preview ? "open" : "closed"}</output>
    </>
  );
}

const mount = (client: QueryClient) =>
  render(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>,
  );

const row = (name: string) => page.getByRole("group", { name, exact: true });

it("shows folder sizes on Clear and clears a folder", async () => {
  const { client, find } = setup({ memoryScannerEnabled: true });
  await mount(client);
  await expect.element(row("Relic captures").getByRole("button", { name: "Clear (10.0 MB)" })).toBeEnabled();
  await expect.element(row("Unmatched paths").getByRole("button", { name: "Clear", exact: true })).toBeDisabled();
  await row("Memory probe").getByRole("button", { name: "Clear (1.5 KB)" }).click();
  await vi.waitFor(() => {
    expect(find("clear_debug_data")[0]?.args).toEqual({ which: "probe" });
    expect(find("get_debug_data_size").length).toBeGreaterThan(5);
  });
  await row("Relic captures").getByRole("button", { name: "Open folder" }).click();
  expect(find("open_debug_folder")[0]?.args).toEqual({ which: "diag" });
});

it("saves the snapshot switch, which needs the memory scanner", async () => {
  const { client, saved } = setup();
  await mount(client);
  const snapshots = row("Inventory snapshots").getByRole("switch", { name: "Record snapshots" });
  await expect.element(snapshots).toBeDisabled();
  await expect.element(row("Inventory snapshots").getByRole("button", { name: "Open folder" })).toBeDisabled();
  await expect.element(row("Inventory snapshots").getByRole("button", { name: "Clear (2.0 KB)" })).toBeDisabled();
  await cleanup();

  const on = setup({ memoryScannerEnabled: true });
  await mount(on.client);
  await row("Inventory snapshots").getByRole("switch", { name: "Record snapshots" }).click();
  await vi.waitFor(() => {
    expect(on.saved().blobLogEnabled).toBe(true);
  });
  expect(saved().blobLogEnabled).toBeUndefined();
});

it("records raw memory until stopped, and keeps that over a tab switch", async () => {
  const { client, find } = setup();
  await mount(client);
  const raw = row("Raw memory record");
  await raw.getByRole("button", { name: "Record" }).click();
  await expect.element(raw.getByRole("button", { name: "Stop" })).toHaveAttribute("aria-pressed", "true");
  await expect.element(raw.getByRole("button", { name: "Clear (4.0 KB)" })).toBeDisabled();
  await page.getByRole("tab", { name: "General" }).click();
  await page.getByRole("tab", { name: "Debugging" }).click();
  await row("Raw memory record").getByRole("button", { name: "Stop" }).click();
  await expect.element(row("Raw memory record").getByRole("button", { name: "Record" })).toBeVisible();
  expect(find("toggle_raw_scan")).toHaveLength(2);
});

it("starts memory relic debug, also when it ran already, and ends it", async () => {
  const { client, find } = setup({}, { start_memory_relic_debug: () => Promise.reject(new Error("Memory relic debug already running")) });
  await mount(client);
  const mem = row("Memory relic debug");
  await mem.getByRole("button", { name: "Start" }).click();
  await expect.element(mem.getByRole("status")).toHaveTextContent("It was running already.");
  await mem.getByRole("button", { name: "End" }).click();
  await expect.element(mem.getByRole("button", { name: "Start" })).toBeVisible();
  expect(find("stop_memory_relic_debug")).toHaveLength(1);
});

it("shows results under the row instead of alerts", async () => {
  const { client } = setup({}, { debug_detect_fissure_era: () => Promise.reject(new Error("no game window")) });
  await mount(client);
  await row("Memory probe").getByRole("button", { name: "Run" }).click();
  await expect.element(row("Memory probe").getByRole("status")).toHaveTextContent("Probe done: 3 entries written.");
  await row("Manual capture").getByRole("button", { name: "Capture" }).click();
  await expect.element(row("Manual capture").getByRole("status")).toHaveTextContent("Saved to C:/Debug/Manual-Capture/x");
  await row("OCR era detect").getByRole("button", { name: "Test OCR" }).click();
  await expect.element(row("OCR era detect").getByRole("status")).toHaveTextContent("Failed: no game window");
  await row("Test overlay").getByRole("combobox", { name: "Era" }).selectOptions("NEO");
  await row("Test overlay").getByRole("button", { name: "Launch" }).click();
  await expect.element(row("Test overlay").getByText("Emitted relic-pick-open: era=NEO, 3 relics in inventory")).toBeVisible();
  await row("EE.log tail").getByRole("button", { name: "Read log" }).click();
  await expect.element(page.getByRole("textbox", { name: "EE.log tail" })).toHaveValue("12.3 Sys [Info]: ProjectionRewardChoice");
});

it("exports diagnostics and then offers to show the zip in its folder", async () => {
  const { client, find } = setup();
  await mount(client);
  const exportRow = row("Diagnostics export");
  await expect.element(exportRow.getByRole("button", { name: "Show in folder" })).not.toBeInTheDocument();
  await exportRow.getByRole("button", { name: "Export" }).click();
  const saved = "C:/Users/Tenno/Downloads/hexdesk-diagnostics-2026-11-18-150312.zip";
  await expect.element(exportRow.getByRole("status")).toHaveTextContent(`Saved to ${saved}`);
  await exportRow.getByRole("button", { name: "Show in folder" }).click();
  await vi.waitFor(() => {
    expect(find("show_diagnostics_export").map((c) => c.args)).toEqual([{ path: saved }]);
  });
});

it("shows why an export failed", async () => {
  const { client } = setup({}, { export_diagnostics: () => Promise.reject(new Error("the zip file could not be created")) });
  await mount(client);
  await row("Diagnostics export").getByRole("button", { name: "Export" }).click();
  await expect.element(row("Diagnostics export").getByRole("status")).toHaveTextContent("Export failed: the zip file could not be created");
});

it("saves the relic capture switch, off by default", async () => {
  const { client, saved } = setup();
  await mount(client);
  const toggle = row("Relic captures").getByRole("switch", { name: "Save captures" });
  await expect.element(toggle).not.toBeChecked();
  await toggle.click();
  await vi.waitFor(() => {
    expect(saved().autoDiagEnabled).toBe(true);
  });
});

it("switches unmatched paths to what the backend answers", async () => {
  const { client, find } = setup();
  await mount(client);
  const toggle = row("Unmatched paths").getByRole("switch", { name: "Record unmatched paths" });
  await toggle.click();
  await expect.element(toggle).toBeChecked();
  expect(find("toggle_debug_categorization")).toHaveLength(1);
});

it("shows the overlay log in a dialog and opens the batch preview", async () => {
  const { client } = setup();
  await mount(client);
  await row("Overlay log").getByRole("button", { name: "View" }).click();
  const dialog = page.getByRole("dialog", { name: "Overlay log" });
  await expect.element(dialog.getByText("[12:00] relic-trigger seen")).toBeVisible();
  await dialog.getByRole("button", { name: "Close" }).click();
  await row("Incoming batch").getByRole("button", { name: "Preview" }).click();
  await expect.element(page.getByRole("status", { name: "Batch preview" })).toHaveTextContent("open");
});

it("keeps the developer pages under Debugging", async () => {
  const { client } = setup();
  await mount(client);
  await expect.element(row("Kitchen sink").getByRole("button", { name: "Open" })).toBeVisible();
  await expect.element(row("Tokens").getByRole("button", { name: "Open" })).toBeVisible();
});
