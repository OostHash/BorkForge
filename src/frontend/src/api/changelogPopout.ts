import { availableMonitors, getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { invoke } from "./invoke";
import { useSaveSettings, useSettings, type SettingsFile } from "./settings";

/** Label and route of the changelog pop-out window (capabilities list the label). */
export const CHANGELOG_POPOUT_LABEL = "changelog-popout";
const POPOUT_URL = "index.html#changelog";
const SIZE = { width: 640, height: 520, minWidth: 360, minHeight: 240 } as const;

/** Whether the changelog lives in its own window (settings key changelogPopout). */
export function useChangelogPopout() {
  const { data, isSuccess } = useSettings();
  const { mutate } = useSaveSettings();
  return {
    popout: data?.changelogPopout === true,
    /** Saving before the file is read would clobber it. */
    loaded: isSuccess,
    setPopout: (changelogPopout: boolean) => {
      mutate({ changelogPopout });
    },
  };
}

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

async function onAMonitor(x: number, y: number): Promise<boolean> {
  const monitors = await availableMonitors().catch(() => []);
  return monitors.some((m) => x >= m.position.x && x < m.position.x + m.size.width && y >= m.position.y && y < m.position.y + m.size.height);
}

/** Opens the pop-out at its saved place (when on screen); onClosed runs when the user closes it. */
export async function openChangelogPopout(settings: SettingsFile | undefined, onClosed: () => void): Promise<void> {
  if (await WebviewWindow.getByLabel(CHANGELOG_POPOUT_LABEL)) return;
  const x = n(settings?.changelogWinX);
  const y = n(settings?.changelogWinY);
  const position = x !== undefined && y !== undefined && (await onAMonitor(x, y)) ? { x, y } : {};
  const win = new WebviewWindow(CHANGELOG_POPOUT_LABEL, {
    url: POPOUT_URL,
    title: "BorkForge — Changelog",
    width: n(settings?.changelogWinWidth) ?? SIZE.width,
    height: n(settings?.changelogWinHeight) ?? SIZE.height,
    ...position,
    minWidth: SIZE.minWidth,
    minHeight: SIZE.minHeight,
    resizable: true,
  });
  void win.once("tauri://destroyed", onClosed);
}

export async function closeChangelogPopout(): Promise<void> {
  const win = await WebviewWindow.getByLabel(CHANGELOG_POPOUT_LABEL);
  await win?.close();
}

/** Saves the pop-out's own position and size, in physical pixels (inside the pop-out). */
export async function saveChangelogGeometry(): Promise<void> {
  const win = getCurrentWindow();
  const [position, size] = await Promise.all([win.outerPosition(), win.outerSize()]);
  await invoke("save_settings", {
    json: JSON.stringify({ changelogWinX: position.x, changelogWinY: position.y, changelogWinWidth: size.width, changelogWinHeight: size.height }),
  });
}

/** Brings the main window forward (the pop-out opened Inventory there). */
export async function focusMainWindow(): Promise<void> {
  const win = getCurrentWindow();
  await win.unminimize().catch(() => undefined);
  await win.setFocus();
}
