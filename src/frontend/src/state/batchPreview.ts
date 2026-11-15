import { useSyncExternalStore } from "react";

/**
 * Whether the inventory batch preview is open. Settings → Debugging opens
 * it; the app shell shows the Inventory screen's dialog (vault debugging.md).
 */
let open = false;
const listeners = new Set<() => void>();

export function setBatchPreviewOpen(next: boolean) {
  open = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const useBatchPreviewOpen = () => useSyncExternalStore(subscribe, () => open);
