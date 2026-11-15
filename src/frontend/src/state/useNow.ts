import { useSyncExternalStore } from "react";

/**
 * A shared clock for a window: one timer however many components listen,
 * and it only runs while at least one active component listens. `align`
 * ticks on the boundary (a minute clock flips at :00, not 60 s after mount).
 */
function createClock(intervalMs: number, align: boolean) {
  let snapshot = Date.now();
  const listeners = new Set<() => void>();
  let timer: number | undefined;
  const tick = () => {
    snapshot = Date.now();
    for (const notify of listeners) notify();
  };
  const start = () => {
    if (!align) {
      timer = window.setInterval(tick, intervalMs);
      return;
    }
    const schedule = () => {
      timer = window.setTimeout(
        () => {
          tick();
          schedule();
        },
        intervalMs - (Date.now() % intervalMs),
      );
    };
    schedule();
  };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    if (listeners.size === 1) {
      snapshot = Date.now();
      start();
    }
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        window.clearInterval(timer);
        window.clearTimeout(timer);
      }
    };
  };
  return { subscribe, getSnapshot: () => snapshot };
}

const seconds = createClock(1000, false);
const minutes = createClock(60_000, true);
const idle = () => () => undefined;

/** Current time, updated every second while `active` (countdowns pause in hidden tabs). */
export function useNow(active = true): number {
  return useSyncExternalStore(active ? seconds.subscribe : idle, seconds.getSnapshot);
}

/**
 * Current time, updated once a minute on the minute. For "3m ago"-style
 * labels on large lists, where a per-second render would redraw everything
 * every second (Inventory with 1000 cards).
 */
export function useMinuteNow(active = true): number {
  return useSyncExternalStore(active ? minutes.subscribe : idle, minutes.getSnapshot);
}
