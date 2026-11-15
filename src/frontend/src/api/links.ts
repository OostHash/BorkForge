import { openUrl } from "@tauri-apps/plugin-opener";

/** Opens a link in the user's browser (never inside the app window). */
export function openExternal(url: string): Promise<void> {
  return openUrl(url);
}
