import { useEffect, useRef, useState } from "react";
import { cn } from "../primitives/cn";
import { Select } from "../primitives/forms";

/**
 * Items per page, chosen per screen in its toolbar and remembered in
 * localStorage (like the Cards/List view). The steps follow the size of a
 * screen's cards and what a page costs: big cards with recipes or rewards get
 * small pages, small cards bigger ones, and screens that queue a
 * warframe.market price per item on the page stay modest.
 */
export const PAGE_SIZES = {
  /** Small item cards (11rem); nothing is fetched per page. */
  inventory: { options: [60, 120, 240], fallback: 120 },
  /** Large cards with a recipe each; recipes are fetched per page. */
  foundry: { options: [30, 60, 100], fallback: 30 },
  /** Wide cards with every reward listed. */
  relics: { options: [15, 30, 60], fallback: 30 },
  /** Small cards; a price is queued for every mod on the page. */
  mods: { options: [30, 60, 120], fallback: 60 },
  /** Wide cards with every part and its price. */
  sets: { options: [24, 48, 96], fallback: 48 },
} as const satisfies Record<string, { options: readonly number[]; fallback: number }>;

export type PageSizeScreen = keyof typeof PAGE_SIZES;

const storageKey = (screen: PageSizeScreen) => `ff-page-size-${screen}`;
const allowed = (screen: PageSizeScreen, v: unknown): v is number => (PAGE_SIZES[screen].options as readonly unknown[]).includes(v);

const readStored = (screen: PageSizeScreen): number | null => {
  try {
    const v = Number(localStorage.getItem(storageKey(screen)));
    return allowed(screen, v) ? v : null;
  } catch {
    return null;
  }
};

/**
 * The remembered page size of a screen. `legacy` is a value from before the
 * toolbar choice existed (the Foundry setting); it counts until the user picks one.
 */
export function usePageSize(screen: PageSizeScreen, legacy?: unknown) {
  const [stored, setStored] = useState(() => readStored(screen));
  const size = stored ?? (allowed(screen, legacy) ? legacy : PAGE_SIZES[screen].fallback);
  const setSize = (next: number) => {
    if (!allowed(screen, next)) return;
    setStored(next);
    try {
      localStorage.setItem(storageKey(screen), String(next));
    } catch {
      // Storage full or blocked: the choice still holds for this session.
    }
  };
  return [size, setSize] as const;
}

/** The page that keeps the first item you were looking at in view after a resize. */
export const pageAfterResize = (page: number, from: number, to: number) => Math.floor((page * from) / to);

/**
 * Current page of a list that goes back to page 1 when `resetKey` changes
 * (new filters), not when the data underneath updates.
 */
export function usePage(total: number, pageSize: number, resetKey: unknown) {
  const [page, setPage] = useState(0);
  const [key, setKey] = useState(resetKey);
  if (key !== resetKey) {
    setKey(resetKey);
    setPage(0);
  }
  const pageCount = Math.ceil(total / pageSize);
  const current = Math.min(page, Math.max(0, pageCount - 1));
  return { page: current, pageCount, setPage, start: current * pageSize, end: (current + 1) * pageSize };
}

/**
 * Ref for a screen's scroll container that jumps back to the top when `page`
 * changes: the pager sits in the sticky toolbar, so a new page starts at its first item.
 */
export function useScrollTopOn(page: number) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: 0 });
  }, [page]);
  return ref;
}

type Props = {
  screen: PageSizeScreen;
  value: number;
  onChange: (size: number) => void;
  className?: string;
};

/** "Per page" select for a screen's toolbar, styled like the Sort select next to it. */
export function PageSizeSelect({ screen, value, onChange, className }: Props) {
  return (
    <label className={cn("flex items-center gap-2 text-xs text-muted", className)}>
      Per page
      <Select
        size="sm"
        value={value}
        onChange={(e) => {
          onChange(Number(e.target.value));
        }}
        className="w-20"
      >
        {PAGE_SIZES[screen].options.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </Select>
    </label>
  );
}
