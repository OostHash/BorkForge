/** Overlay key rules. Pure functions. */

/**
 * Keys that can show and hide the overlays, with their Windows virtual-key
 * codes. Keys only, no combinations: the game receives the key as well, so a
 * key without a game action is the best choice.
 */
export const OVERLAY_KEYS = [
  { id: "off", label: "None", vk: 0 },
  { id: "Home", label: "Home", vk: 0x24 },
  { id: "End", label: "End", vk: 0x23 },
  { id: "Insert", label: "Insert", vk: 0x2d },
  { id: "Delete", label: "Delete", vk: 0x2e },
  { id: "PageUp", label: "Page Up", vk: 0x21 },
  { id: "PageDown", label: "Page Down", vk: 0x22 },
  { id: "Pause", label: "Pause", vk: 0x13 },
  { id: "ScrollLock", label: "Scroll Lock", vk: 0x91 },
  ...Array.from({ length: 12 }, (_, i) => ({ id: `F${String(i + 1)}`, label: `F${String(i + 1)}`, vk: 0x70 + i })),
] as const satisfies ReadonlyArray<{ id: string; label: string; vk: number }>;
export type OverlayKey = string;

export const DEFAULT_OVERLAY_KEY: OverlayKey = "Home";
export const overlayKeyFrom = (v: unknown): OverlayKey => (OVERLAY_KEYS.some((k) => k.id === v) ? (v as OverlayKey) : DEFAULT_OVERLAY_KEY);
/** The virtual-key code the backend listens for; 0 for none. */
export const overlayKeyCode = (key: OverlayKey): number => OVERLAY_KEYS.find((k) => k.id === key)?.vk ?? 0;
