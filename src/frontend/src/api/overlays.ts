import { useQueries, useQuery, type QueryClient } from "@tanstack/react-query";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { availableMonitors, currentMonitor, getCurrentWindow, LogicalPosition, LogicalSize } from "@tauri-apps/api/window";
import { useMemo } from "react";
import { emitEvent } from "./events";
import { invoke } from "./invoke";
import { useSettings, type SettingsFile } from "./settings";
import { craftingCounts, overlayPriorityFrom, stripBounds, type OverlayPriority, type Stock } from "../domain/relicReward";
import type { CatalogItem } from "../domain/relics";
import { overlayKeyCode, overlayKeyFrom, type OverlayKey } from "../domain/overlayKey";
import { pickLinesFrom, pickPriorityFrom, type PickLines, type PickPriority } from "../domain/relicPick";
import { offsetsFrom, type OverlayOffsets } from "../domain/overlayOffsets";
import { worthAnalysing, type OcrRiven, type OverlayAnalysis } from "../domain/rivenOverlay";
import { useCrafting, useQuantities } from "./inventory";

/** Overlay switches and choices from the shared settings file. */
export type OverlayPrefs = {
  /** All overlays (default on). */
  overlaysEnabled: boolean;
  /** The relic reward overlay (default on). */
  rewardEnabled: boolean;
  rewardPriority: OverlayPriority;
  /** The relic pick overlay (default on). */
  relicPickEnabled: boolean;
  pickPriority: PickPriority;
  pickLines: PickLines;
  /** The key that shows or hides the overlays (default Home). */
  overlayKey: OverlayKey;
  /** The riven overlay (default on). */
  rivenEnabled: boolean;
  offsets: OverlayOffsets;
};

export function overlayPrefsFrom(s: SettingsFile | undefined): OverlayPrefs {
  return {
    overlaysEnabled: s?.overlaysEnabled !== false,
    rewardEnabled: s?.overlayEnabled !== false,
    rewardPriority: overlayPriorityFrom(s?.overlayPriority),
    relicPickEnabled: s?.relicPickEnabled !== false,
    pickPriority: pickPriorityFrom(s?.relicPickPriority),
    pickLines: pickLinesFrom(s?.relicPickLines),
    overlayKey: overlayKeyFrom(s?.overlayKey),
    rivenEnabled: s?.rivenEnabled !== false,
    offsets: offsetsFrom(s?.overlayOffsets),
  };
}

export function useOverlayPrefs(): OverlayPrefs {
  return overlayPrefsFrom(useSettings().data);
}

/** Tells the backend which overlay triggers may run (at start and on every change). */
export async function syncOverlaySwitches(prefs: OverlayPrefs): Promise<void> {
  await Promise.all([
    invoke("set_overlays_enabled", { enabled: prefs.overlaysEnabled }),
    invoke("set_relic_pick_enabled", { enabled: prefs.relicPickEnabled }),
    invoke("set_overlay_key", { vk: overlayKeyCode(prefs.overlayKey) }),
  ]);
  if (!prefs.overlaysEnabled) await emitEvent("overlays-disabled");
}

/** A line from an overlay window in the log (Settings → Console), for bug reports. */
export const logRelic = (msg: string) => invoke("log_relic_fe", { msg }).catch(() => null);

/** The game's client area, or the first screen when the game is not found (`log` hears which). */
export async function gameRect(log?: (msg: string) => void): Promise<[number, number, number, number]> {
  try {
    const rect = await invoke("get_warframe_window_rect");
    log?.(`wf(${String(rect[0])},${String(rect[1])} ${String(rect[2])}×${String(rect[3])})`);
    return rect;
  } catch (error) {
    // window.screen is in CSS px; the backend wants physical px.
    const ratio = window.devicePixelRatio || 1;
    log?.(`wf-rect failed (${String(error)}), using screen dims`);
    return [0, 0, Math.round(window.screen.width * ratio), Math.round(window.screen.height * ratio)];
  }
}

/** Places the reward strip over the game; `isCurrent` lets a newer action cancel this one. */
export async function showRewardStrip(
  strip: { top: number; height: number },
  scale: number,
  isCurrent: () => boolean,
  label = "preview",
): Promise<boolean> {
  const rect = await gameRect((msg) => void logRelic(`[APP] ${label}: ${msg}`));
  if (!isCurrent()) return false;
  await invoke("show_overlay_window", stripBounds(rect, strip, scale));
  if (isCurrent()) return true;
  await hideRewardStrip();
  return false;
}

export const hideRewardStrip = () => invoke("move_overlay_offscreen").catch(() => null);

/** Settings → Overlays → Show: place the strip and draw the example cards. */
export async function showRewardPreview(scale: number): Promise<void> {
  await showRewardStrip({ top: 0.6, height: 0.3 }, scale, () => true);
  await emitEvent("relic-reward-preview");
}

export async function hideRewardPreview(): Promise<void> {
  await emitEvent("relic-reward-preview-close");
}

// ── Backend status line (status-line) ─────────────────────────────────────────

const statusKey = ["overlay", "status"] as const;

/** Latest backend status line, or "" (shown as a header chip for a few seconds). */
export const useOverlayStatus = () => useQuery({ queryKey: statusKey, queryFn: () => "", staleTime: Infinity, gcTime: Infinity }).data ?? "";

export function setOverlayStatus(queryClient: QueryClient, text: string) {
  queryClient.setQueryData(statusKey, text);
}

// ── Reward overlay data ─────────────────────────────────────────────────────

const EMPTY_QTY: Readonly<Record<string, number>> = {};

/**
 * Quantities and Foundry jobs for the overlay window: the scanner's pushes
 * (TauriEventBridge) when they came, else what the backend has now.
 */
export function useOverlayStock(): Stock {
  const quantities = useQuantities().data ?? EMPTY_QTY;
  const live = useCrafting();
  const initial = useQuery({ queryKey: ["overlay", "crafting"] as const, queryFn: () => invoke("get_current_crafting"), staleTime: Infinity }).data;
  const crafting = useMemo(() => craftingCounts(live.length > 0 ? live : (initial ?? [])), [live, initial]);
  return useMemo(() => ({ quantities, crafting }), [quantities, crafting]);
}

const NO_ITEMS: readonly CatalogItem[] = [];

/** Catalogue entries for this session's rewards and their set siblings. */
export function useRewardCatalog(paths: readonly string[]): readonly CatalogItem[] {
  const real = paths.filter((p) => !p.startsWith("?:"));
  return (
    useQuery({
      queryKey: ["overlay", "items", real] as const,
      queryFn: () => invoke("get_items_by_paths", { paths: real }),
      enabled: real.length > 0,
      staleTime: Infinity,
    }).data ?? NO_ITEMS
  );
}

/** Cached warframe.market prices by item name; names without a price are left out. */
export function useItemPrices(names: readonly string[]): ReadonlyMap<string, number> {
  return useQueries({
    queries: names.map((itemName) => ({
      queryKey: ["overlay", "price", itemName] as const,
      queryFn: () => invoke("get_item_price", { itemName }),
      staleTime: 5 * 60_000,
    })),
    combine: (results) =>
      new Map(
        names.flatMap((name, i) => {
          const value = results[i]?.data;
          return typeof value === "number" ? [[name, value] as const] : [];
        }),
      ),
  });
}

export const takePendingRewards = () => invoke("get_pending_relic_rewards").catch(() => null);

// ── Relic pick window ───────────────────────────────────────────────────────

/** Settings → Overlays → Show: the example relics in the backend-placed window. */
export async function showPickPreview(): Promise<void> {
  await emitEvent("relic-pick-preview");
  await invoke("show_relic_pick_window");
}

export const hidePickPreview = () => emitEvent("relic-pick-preview-close");

export const hideCurrentWindow = () => getCurrentWindow().hide();

/** Width in CSS px; the window follows the content height. */
export const PICK_WIDTH = 340;

/**
 * Sizes the pick window to its content. With native zoom a CSS pixel is
 * `scale` logical pixels, so the window is the content size times the scale,
 * kept within the monitor.
 */
export async function fitPickWindow(contentHeight: number, scale: number): Promise<void> {
  if (contentHeight <= 0) return;
  const win = getCurrentWindow();
  let width = PICK_WIDTH * scale;
  let height = contentHeight * scale;
  const monitor = await currentMonitor().catch(() => null);
  if (monitor) {
    const f = monitor.scaleFactor || 1;
    width = Math.min(width, monitor.size.width / f);
    height = Math.min(height, monitor.size.height / f);
  }
  await win.setSize(new LogicalSize(Math.round(width), Math.round(height)));
}

// ── Riven overlay ───────────────────────────────────────────────────────────

export const RIVEN_LABEL = "riven-overlay";

/** Scale factor of the monitor holding a physical point (the first monitor otherwise). */
export async function monitorScaleAt(x: number, y: number): Promise<number> {
  const monitors = await availableMonitors().catch(() => []);
  const hit = monitors.find((m) => x >= m.position.x && x < m.position.x + m.size.width && y >= m.position.y && y < m.position.y + m.size.height);
  return hit?.scaleFactor ?? monitors[0]?.scaleFactor ?? 1;
}

/** Opens the riven window at a logical place, or moves the open one there. True when it was created now. */
export async function placeRivenWindow(place: { x: number; y: number; width: number; height: number }, visible: boolean): Promise<boolean> {
  const existing = await WebviewWindow.getByLabel(RIVEN_LABEL).catch(() => null);
  if (existing) {
    await existing.setPosition(new LogicalPosition(place.x, place.y)).catch(() => undefined);
    await existing.setSize(new LogicalSize(place.width, place.height)).catch(() => undefined);
    if (visible) await existing.show().catch(() => undefined);
    return false;
  }
  new WebviewWindow(RIVEN_LABEL, {
    url: "index.html#rivenoverlay",
    title: "HexDesk Riven",
    transparent: true,
    decorations: false,
    // Windows draws its own border around an undecorated window with a shadow.
    shadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focus: false,
    visible,
    ...place,
  });
  return true;
}

export async function closeRivenWindow(): Promise<void> {
  const win = await WebviewWindow.getByLabel(RIVEN_LABEL).catch(() => null);
  await win?.close().catch(() => undefined);
}

/** OCR on the riven card, then the analysis when there is something to analyse. */
export async function checkRivenOnScreen(): Promise<{ ocr: OcrRiven; analysis: OverlayAnalysis | null }> {
  const ocr = await invoke("ocr_riven_screen");
  // The backend also sends matched/missing positives, which OverlayAnalysis reads.
  const analysis: OverlayAnalysis | null = worthAnalysing(ocr)
    ? await invoke("analyze_riven", { weapon: ocr.weapon, positives: ocr.positives, negatives: ocr.negatives }).catch(() => null)
    : null;
  return { ocr, analysis };
}

export const logRivenError = (error: string) => invoke("ocr_riven_log_error", { error }).catch(() => null);

/** "Check Riven" in Rivens and "New roll" in the overlay: the main window runs the check. */
export const requestRivenCheck = () => emitEvent("riven-manual-check");
export const showRivenPreview = () => emitEvent("riven-preview");
export const hideRivenPreview = () => emitEvent("riven-preview-close");
