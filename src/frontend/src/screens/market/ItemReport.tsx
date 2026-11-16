import { ArrowDown, ArrowUp, ChartLine, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useCatalogList } from "../../api/market";
import { useCardOrder, useSnapshots, useTrackActions, useTrackedItems } from "../../api/statistics";
import {
  moveTracked,
  orderTracked,
  snapshotsIn,
  snapshotStats,
  trackCandidates,
  type SnapshotPoint,
  type Timeframe,
  type TrackedItem,
} from "../../domain/statistics";
import { LineChart } from "../../patterns/LineChart";
import { IconButton } from "../../primitives/actions";
import { cn } from "../../primitives/cn";
import { Card, EmptyState, Skeleton } from "../../primitives/display";
import { ComboBox, RadioGroup } from "../../primitives/forms";
import { ConfirmDialog, toast } from "../../primitives/overlay";

const TIMEFRAMES: ReadonlyArray<{ value: string; label: string }> = [
  { value: "7", label: "7d" },
  { value: "30", label: "30d" },
  { value: "90", label: "90d" },
  { value: "all", label: "All" },
];
const fmtChange = (n: number) => `${n > 0 ? "+" : ""}${n.toLocaleString("en-US")}`;
const tone = (n: number) => (n > 0 ? "text-success" : n < 0 ? "text-danger" : "");
const dayLabel = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

function ItemCard({
  item,
  points,
  index,
  count,
  onMove,
  onDelete,
}: {
  item: TrackedItem;
  points: readonly SnapshotPoint[];
  index: number;
  count: number;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
}) {
  const [tf, setTf] = useState<Timeframe>(30);
  const shown = useMemo(() => snapshotsIn(points, tf, new Date()), [points, tf]);
  const stats = snapshotStats(shown);
  const name = item.display_name;

  return (
    <li>
      <Card as="article" padding="md" className="flex h-full flex-col gap-2">
        <header className="flex flex-wrap items-center gap-1">
          <h4 className="min-w-0 flex-1 truncate text-sm font-semibold">{name}</h4>
          <IconButton
            icon={ArrowUp}
            size="sm"
            label={`Move ${name} up`}
            disabled={index === 0}
            onClick={() => {
              onMove(-1);
            }}
          />
          <IconButton
            icon={ArrowDown}
            size="sm"
            label={`Move ${name} down`}
            disabled={index === count - 1}
            onClick={() => {
              onMove(1);
            }}
          />
          <IconButton icon={Trash2} size="sm" variant="danger" label={`Stop tracking ${name}`} onClick={onDelete} />
        </header>
        <RadioGroup
          legend={`Period for ${name}`}
          hideLegend
          appearance="segmented"
          value={String(tf)}
          onValueChange={(v) => {
            setTf(v === "all" ? "all" : (Number(v) as Timeframe));
          }}
          options={TIMEFRAMES}
        />
        <LineChart
          label={`${name} quantity, ${tf === "all" ? "all time" : `last ${String(tf)} days`}`}
          points={shown.map((p) => ({ x: p.date, y: p.quantity }))}
          describe={(p) => ({ title: dayLabel(p.x), value: p.y.toLocaleString("en-US") })}
          empty="Waiting for the first daily snapshot…"
        />
        <dl className="flex gap-4">
          <div className="flex flex-col">
            <dt className="text-xs text-muted uppercase">Current</dt>
            <dd className="text-2xl font-semibold tabular-nums">{stats.current === null ? "—" : stats.current.toLocaleString("en-US")}</dd>
          </div>
          {stats.avgPerDay !== null && (
            <div className="flex flex-col">
              <dt className="text-xs text-muted uppercase">Average per day</dt>
              <dd className={cn("text-2xl font-semibold tabular-nums", tone(stats.avgPerDay))}>{fmtChange(stats.avgPerDay)}</dd>
            </div>
          )}
          {stats.total !== null && (
            <div className="flex flex-col">
              <dt className="text-xs text-muted uppercase">{tf === "all" ? "Total" : `${String(tf)}-day total`}</dt>
              <dd className={cn("text-2xl font-semibold tabular-nums", tone(stats.total))}>{fmtChange(stats.total)}</dd>
            </div>
          )}
        </dl>
      </Card>
    </li>
  );
}

/** Daily quantities of items you choose to follow. */
export function ItemReport() {
  const tracked = useTrackedItems();
  const catalog = useCatalogList();
  const actions = useTrackActions();
  const [order, setOrder] = useCardOrder();
  const [query, setQuery] = useState("");
  const [confirm, setConfirm] = useState<TrackedItem | null>(null);
  const items = useMemo(() => tracked.data ?? [], [tracked.data]);
  const ordered = useMemo(() => orderTracked(items, order), [items, order]);
  const snapshots = useSnapshots(items);
  const ids = useMemo(() => new Set(items.map((i) => i.unique_name)), [items]);
  const candidates = useMemo(() => trackCandidates(catalog.data ?? [], ids, query), [catalog.data, ids, query]);

  return (
    <div className="flex flex-col gap-6">
      <ComboBox
        label="Track an item"
        placeholder="Search items to track…"
        inputValue={query}
        onInputChange={setQuery}
        options={candidates.map((c) => ({ id: c.unique_name, label: `${c.name} · ${c.category}` }))}
        onSelect={(id) => {
          const item = candidates.find((c) => c.unique_name === id);
          if (!item) return;
          setQuery("");
          actions.add.mutate(
            { uniqueName: item.unique_name, displayName: item.name },
            { onError: (e) => toast({ title: `Could not track ${item.name}`, description: e.message, tone: "danger" }) },
          );
        }}
        className="max-w-md"
      />
      {tracked.isPending ? (
        <Skeleton lines={4} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={ChartLine}
          title="No items tracked yet."
          description="Search for an item above to follow its daily quantity. A snapshot is saved once a day while BorkForge runs."
        />
      ) : (
        <ul aria-label="Tracked items" className="grid grid-cols-[repeat(auto-fill,minmax(min(18rem,100%),1fr))] gap-3">
          {ordered.map((item, i) => (
            <ItemCard
              key={item.unique_name}
              item={item}
              points={snapshots.get(item.unique_name) ?? []}
              index={i}
              count={ordered.length}
              onMove={(d) => {
                setOrder(moveTracked(items, order, item.unique_name, d));
              }}
              onDelete={() => {
                setConfirm(item);
              }}
            />
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={confirm !== null}
        onClose={() => {
          setConfirm(null);
        }}
        destructive
        title={confirm ? `Stop tracking ${confirm.display_name}?` : ""}
        description="All saved history of this item is deleted. This cannot be undone."
        confirmLabel="Delete history"
        onConfirm={() => {
          const target = confirm;
          if (!target) return;
          actions.remove.mutate(target.unique_name, {
            onSettled: () => {
              setConfirm(null);
            },
          });
        }}
      />
    </div>
  );
}
