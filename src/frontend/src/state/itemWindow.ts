import { useSyncExternalStore } from "react";
import type { MarketTarget } from "../domain/market";

/**
 * The market item window (orders, prices, new order) for the whole window.
 * Inventory (Prime Sets, Mods & Arcanes) and Market (Trading) open it; the
 * app shell shows it once, so it looks and works the same from everywhere.
 */
let current: MarketTarget | null = null;
const listeners = new Set<() => void>();

export function openItemWindow(target: MarketTarget | null) {
  current = target;
  for (const listener of listeners) listener();
}

export const closeItemWindow = () => {
  openItemWindow(null);
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useItemWindowTarget(): MarketTarget | null {
  return useSyncExternalStore(subscribe, () => current);
}
