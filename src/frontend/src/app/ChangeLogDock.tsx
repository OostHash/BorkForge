import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { useEffect, useId, useMemo, useState, useSyncExternalStore } from "react";
import { useGameState } from "../api/app";
import { closeChangelogPopout, focusMainWindow, openChangelogPopout, useChangelogPopout } from "../api/changelogPopout";
import { isTauri } from "../api/env";
import { onEvent } from "../api/events";
import { useSettings } from "../api/settings";
import { imageSources, useImageBaseUrl } from "../api/catalog";
import { useChangeLog } from "../api/inventory";
import { openExternal } from "../api/links";
import { useCatalogByUniqueName } from "../api/relics";
import { useClock } from "../api/statistics";
import {
  batchCounts,
  changeKey,
  describeChange,
  FEED_STEP_MS,
  filterChanges,
  formatClockTime,
  latestBatch,
  LOG_HEIGHT,
  maxLogHeight,
  startsBatch,
  type LogItem,
} from "../domain/changelog";
import type { ChangeEntry } from "../domain/inventory";
import type { ClockFormat } from "../domain/statistics";
import { wikiUrl } from "../domain/wiki";
import { ItemImage } from "../patterns/ItemImage";
import { WikiMenu } from "../patterns/WikiMenu";
import { Button, IconButton } from "../primitives/actions";
import { ResizeHandle } from "../primitives/behavior/ResizeHandle";
import { cn } from "../primitives/cn";
import { Badge } from "../primitives/display";
import { SearchInput } from "../primitives/forms";
import { toast } from "../primitives/overlay";
import { showItem, showRecent } from "../state/inventoryFilters";

const EMPTY: readonly ChangeEntry[] = [];

function subscribeResize(listener: () => void) {
  window.addEventListener("resize", listener);
  return () => {
    window.removeEventListener("resize", listener);
  };
}
const useWindowHeight = () => useSyncExternalStore(subscribeResize, () => window.innerHeight);

export type RowContext = {
  lookup: (uniqueName: string) => LogItem | undefined;
  baseUrl: string | undefined;
  clock: ClockFormat;
  locale: string;
  onItem: (name: string) => void;
  onCategory: (category: string) => void;
};

const amount = (delta: number) => `${delta > 0 ? "+" : "−"}${Math.abs(delta).toLocaleString()}`;

export function ChangeRow({ change, ctx, compact = false }: { change: ChangeEntry; ctx: RowContext; compact?: boolean }) {
  const item = ctx.lookup(change.unique_name);
  const { name, category } = describeChange(change, item);
  const up = change.delta > 0;
  return (
    <div className="flex min-w-0 items-center gap-2 text-sm">
      {!compact && <span className="w-12 shrink-0 text-xs text-muted tabular-nums">{formatClockTime(change.timestamp, ctx.clock, ctx.locale)}</span>}
      <ItemImage size="sm" sources={imageSources(item?.image_name ?? undefined, ctx.baseUrl)} name={name} />
      <button
        type="button"
        title={`Show ${name} in Inventory`}
        className="min-w-0 truncate text-start font-medium hover:text-accent hover:underline"
        onClick={() => {
          ctx.onItem(name);
        }}
      >
        {name}
      </button>
      {change.rank != null && <Badge tone="accent">R{change.rank}</Badge>}
      {!compact && (
        <button
          type="button"
          title={`Show recent ${category} changes in Inventory`}
          className="max-w-32 shrink-0 truncate text-xs text-muted uppercase hover:text-accent hover:underline"
          onClick={() => {
            ctx.onCategory(category);
          }}
        >
          {category}
        </button>
      )}
      <span className="ms-auto flex shrink-0 items-center gap-2 tabular-nums">
        {!compact && change.old_qty !== undefined && change.new_qty !== undefined && (
          <span className="text-xs text-muted">
            {change.old_qty.toLocaleString()} → {change.new_qty.toLocaleString()}
          </span>
        )}
        <span className={cn("min-w-12 text-end font-semibold", up ? "text-success" : "text-danger")}>
          <span className="sr-only">{up ? "Increased by " : "Decreased by "}</span>
          <span aria-hidden="true">{amount(change.delta)}</span>
        </span>
      </span>
      {!compact && <WikiMenu name={name} url={wikiUrl(name)} onOpen={(url) => void openExternal(url).catch(() => undefined)} />}
    </div>
  );
}

/** Row context: catalogue lookup, images, clock, and what a click on a name or category does. */
export function useRowContext(onItem: (name: string) => void, onCategory: (category: string) => void): RowContext {
  const catalog = useCatalogByUniqueName();
  const baseUrl = useImageBaseUrl();
  const { clock, locale } = useClock();
  return { lookup: (uniqueName) => catalog.get(uniqueName), baseUrl, clock, locale, onItem, onCategory };
}

/** Search plus every change, newest batch first; the dock and the pop-out both show it. */
export function ChangeLogList({
  changes,
  ctx,
  id,
  className,
}: {
  changes: readonly ChangeEntry[];
  ctx: RowContext;
  id?: string;
  className?: string;
}) {
  const [search, setSearch] = useState("");
  const visible = filterChanges(changes, ctx.lookup, search);
  return (
    <div id={id} className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div className="border-b border-border px-3 py-1.5">
        <SearchInput size="sm" label="Search changes" placeholder="Search changes…" value={search} onValueChange={setSearch} />
      </div>
      {visible.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted">{search ? "No matching changes." : "No changes recorded yet."}</p>
      ) : (
        <ul aria-label="Changes" className="min-h-0 flex-1 overflow-y-auto">
          {visible.map((change, index) => (
            <li
              key={`${changeKey(change)}:${String(index)}`}
              className={cn("border-b border-border/40 px-3 py-1", startsBatch(visible, index) && "border-t-2 border-t-border")}
            >
              <ChangeRow change={change} ctx={ctx} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type Props = {
  /** Switches the shell to Inventory; the dock sets its filters first. */
  onOpenInventory: () => void;
};

/**
 * The changelog along the bottom of the main window (vault changelog.md):
 * collapsed it shows the newest batch as a feed, open it lists every change
 * with search, and each name or category opens Inventory on it.
 */
export function ChangeLogDock({ onOpenInventory }: Props) {
  const changeQuery = useChangeLog();
  const changes = changeQuery.data ?? EMPTY;
  const { popout, loaded, setPopout } = useChangelogPopout();
  const { data: settings } = useSettings();
  const { scannedAt } = useGameState();
  const windowHeight = useWindowHeight();
  const listId = useId();

  const [expanded, setExpanded] = useState(false);
  const [height, setHeight] = useState<number>(LOG_HEIGHT.initial);

  const batch = useMemo(() => latestBatch(changes), [changes]);
  const batchKey = batch.map(changeKey).join("|");
  const counts = batchCounts(batch);

  // The batch present when the log first loads is history, not an arrival.
  const [baseline, setBaseline] = useState<string | null>(null);
  if (changeQuery.isSuccess && baseline === null) setBaseline(batchKey);
  const arrived = baseline !== null && batchKey !== "" && batchKey !== baseline;

  // A new batch runs as a feed while collapsed: one change per step.
  const [feed, setFeed] = useState<{ key: string; index: number } | null>(null);
  const [fedKey, setFedKey] = useState<string | null>(null);
  if (arrived && fedKey !== batchKey) {
    setFedKey(batchKey);
    setFeed(expanded ? null : { key: batchKey, index: 0 });
  }
  useEffect(() => {
    if (!feed || expanded) return;
    const id = window.setTimeout(() => {
      setFeed((f) => (f && f.index + 1 < batch.length ? { ...f, index: f.index + 1 } : null));
    }, FEED_STEP_MS);
    return () => {
      window.clearTimeout(id);
    };
  }, [feed, expanded, batch.length]);
  const feedChange = !expanded && feed?.key === batchKey ? batch[feed.index] : undefined;

  const ctx = useRowContext(
    (name) => {
      showItem(name);
      onOpenInventory();
    },
    (category) => {
      showRecent(category);
      onOpenInventory();
    },
  );
  const { clock, locale } = ctx;

  // In its own window (changelogPopout): this dock opens and closes it, like the modular window.
  useEffect(() => {
    if (!loaded || !isTauri()) return;
    if (!popout) {
      void closeChangelogPopout().catch(() => undefined);
      return;
    }
    openChangelogPopout(settings, () => {
      // The user closed the window: dock the changelog again.
      setPopout(false);
    }).catch((error: unknown) => {
      setPopout(false);
      toast({ title: "Could not open the changelog window", description: String(error), tone: "danger" });
    });
    // Only the switch opens or closes the window; settings are read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popout, loaded]);

  // Names and categories clicked in the pop-out open Inventory here.
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;
    let disposed = false;
    void onEvent("changelog-open-inventory", ({ item, category }) => {
      if (item !== undefined) showItem(item);
      else showRecent(category);
      onOpenInventory();
      void focusMainWindow().catch(() => undefined);
    }).then((fn) => {
      if (disposed) fn();
      else unlisten = fn;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [onOpenInventory]);

  if (popout) return null;

  const maxHeight = maxLogHeight(windowHeight);
  const shownHeight = Math.min(height, maxHeight);

  return (
    <section
      aria-label="Changelog"
      className="relative flex shrink-0 flex-col border-t border-border bg-surface"
      style={expanded ? { height: shownHeight } : undefined}
    >
      {expanded && (
        <ResizeHandle
          label="Changelog height"
          axis="y"
          direction={-1}
          value={shownHeight}
          min={LOG_HEIGHT.min}
          max={maxHeight}
          onValueChange={setHeight}
          className="absolute inset-x-0 top-0 z-(--ff-z-sticky) h-1.5"
        />
      )}
      <div className="flex min-h-control-md items-center gap-3 border-b border-border px-3">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={listId}
          className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold tracking-wide text-muted uppercase hover:text-text"
          onClick={() => {
            setExpanded((v) => !v);
            setFeed(null);
          }}
        >
          {expanded ? <ChevronDown aria-hidden="true" className="size-4" /> : <ChevronUp aria-hidden="true" className="size-4" />}
          Changelog
        </button>
        <span role="status" className="flex shrink-0 items-center gap-1.5 text-xs font-semibold">
          {arrived && counts.up > 0 && (
            <span className="text-success">
              +{counts.up}
              <span className="sr-only"> increased</span>
            </span>
          )}
          {arrived && counts.down > 0 && (
            <span className="text-danger">
              −{counts.down}
              <span className="sr-only"> decreased</span>
            </span>
          )}
        </span>
        <span className="shrink-0 text-xs text-muted">last scan {scannedAt === null ? "not yet" : formatClockTime(scannedAt, clock, locale)}</span>
        <div className="min-w-0 flex-1">{feedChange && <ChangeRow key={changeKey(feedChange)} change={feedChange} ctx={ctx} compact />}</div>
        <Button
          size="sm"
          variant="ghost"
          className="shrink-0"
          onClick={() => {
            showRecent();
            onOpenInventory();
          }}
        >
          Show in Inventory
        </Button>
        <IconButton
          size="sm"
          icon={ExternalLink}
          label="Open in its own window"
          onClick={() => {
            if (isTauri()) setPopout(true);
            else toast({ title: "Only in the desktop app", description: "The changelog opens in its own window in the desktop app.", tone: "info" });
          }}
        />
      </div>
      {expanded && <ChangeLogList changes={changes} ctx={ctx} id={listId} />}
    </section>
  );
}
