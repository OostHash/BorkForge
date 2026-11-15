import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";

/**
 * OS notifications (not in-app toasts). Ask for permission only from a user
 * gesture: a prompt raised by a background poll arrives with nothing on screen
 * to explain it. Concurrent callers share one prompt; the answer is not cached
 * because the user can change it in Windows settings at any time.
 */
let pending: Promise<boolean> | null = null;

export function ensureNotificationPermission(): Promise<boolean> {
  pending ??= (async () => {
    try {
      return (await isPermissionGranted()) || (await requestPermission()) === "granted";
    } catch {
      return false;
    } finally {
      pending = null;
    }
  })();
  return pending;
}

/** Never prompts and never throws, so a poll loop cannot break on it. */
export async function notify(title: string, body: string): Promise<void> {
  try {
    if (await isPermissionGranted()) sendNotification({ title, body });
  } catch {
    // No notification daemon or permission: silently skip.
  }
}
