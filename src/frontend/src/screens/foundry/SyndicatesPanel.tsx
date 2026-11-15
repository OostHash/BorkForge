import { CircleCheckBig, Database, RefreshCw } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useImageBaseUrl, useSyndicateStores } from "../../api/catalog";
import { useCraftableItems } from "../../api/foundry";
import {
  groupByTier,
  itemStatus,
  rankNumber,
  storeProgress,
  SYNDICATE_GROUPS,
  SYNDICATE_META,
  syndicateGroup,
  type Ownership,
  type SyndicateGroup,
  type SyndicateItem,
  type TierGroup,
} from "../../domain/completionist";
import { percent } from "../../domain/foundry";
import { CARD_GRID, cardGridStyle, useCardScale } from "../../patterns/CardScale";
import { Button } from "../../primitives/actions";
import { Alert, Chip, EmptyState, ProgressBar, Skeleton, domainTone } from "../../primitives/display";
import { SearchInput } from "../../primitives/forms";
import { Tab, TabList, TabPanel, Tabs } from "../../primitives/navigation";
import { SyndicateCard } from "./SyndicateCard";
import { useCraftInfo } from "./useCraftInfo";

type DomainColorName = Parameters<typeof domainTone>[0];
/** SYNDICATE_META.tone names are checked against theme/domain.ts by a test. */
const toneOf = (name: string) => domainTone((SYNDICATE_META[name]?.tone ?? "syndicate-conclave") as DomainColorName);

/** What the recipe modal opens for a store item: the crafted result of a blueprint, else the item. */
const recipeTarget = (item: SyndicateItem) => item.result_unique ?? item.unique_name;
const NO_OPEN = () => undefined;

type PillOption = { key: string; complete: number; total: number };

/** Sums tier progress per key (merchant or rank), keeping first-seen order. */
function sumBy(tiers: readonly TierGroup[], keyOf: (t: TierGroup) => string): PillOption[] {
  const out = new Map<string, PillOption>();
  for (const t of tiers) {
    const key = keyOf(t);
    const o = out.get(key) ?? { key, complete: 0, total: 0 };
    o.complete += t.complete;
    o.total += t.items.length;
    out.set(key, o);
  }
  return [...out.values()];
}

/** Single-choice filter pills: "All …" plus one pill per option with collected/total. */
function PillGroup(props: {
  label: string;
  allLabel: string;
  options: readonly PillOption[];
  value: string | null;
  onChange: (next: string | null) => void;
  /** Text before the name, e.g. the rank number. */
  prefix?: (key: string) => string | null;
}) {
  const { label, allLabel, options, value, onChange, prefix } = props;
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1">
      <Chip
        active={value === null}
        onActiveChange={() => {
          onChange(null);
        }}
      >
        {allLabel}
      </Chip>
      {options.map((o) => (
        <Chip
          key={o.key}
          active={value === o.key}
          onActiveChange={(on) => {
            onChange(on ? o.key : null);
          }}
        >
          {prefix?.(o.key) && <span className="font-semibold">{prefix(o.key)}</span>}
          {o.key || "General"}
          <span className="text-muted tabular-nums">
            {o.complete}/{o.total}
          </span>
        </Chip>
      ))}
    </div>
  );
}

type Props = {
  group: SyndicateGroup;
  ownership: Ownership;
  /** Opens the recipe of a craftable item by uniqueName. */
  onOpen: (uniqueName: string) => void;
};

export function SyndicatesPanel({ group, ownership, onOpen }: Props) {
  const stores = useSyndicateStores();
  const craftable = useCraftableItems();
  const baseUrl = useImageBaseUrl();
  const { tracked, toggleTrack } = useCraftInfo(NO_OPEN);
  const [cardScale] = useCardScale("foundry");
  const [selected, setSelected] = useState<string | null>(null);
  const [merchant, setMerchant] = useState<string | null>(null);
  const [rank, setRank] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [missingOnly, setMissingOnly] = useState(false);

  // Switching group in the navigator starts on its first syndicate.
  const [seenGroup, setSeenGroup] = useState(group);
  if (seenGroup !== group) {
    setSeenGroup(group);
    setSelected(null);
    setMerchant(null);
    setRank(null);
    setSearch("");
  }

  const craftById = useMemo(() => new Map((craftable.data ?? []).map((i) => [i.unique_name, i])), [craftable.data]);
  const inGroup = useMemo(() => (stores.data ?? []).filter((s) => syndicateGroup(s.name) === group), [stores.data, group]);
  const active = inGroup.find((s) => s.name === selected) ?? inGroup[0];
  const allTiers = useMemo(() => (active ? groupByTier(active, ownership, { search: "", missingOnly: false }) : []), [active, ownership]);
  const tiers = useMemo(
    () =>
      active
        ? groupByTier(active, ownership, { search, missingOnly }).filter(
            (t) => (merchant === null || t.merchant === merchant) && (rank === null || t.rank === rank),
          )
        : [],
    [active, ownership, search, missingOnly, merchant, rank],
  );
  // One grid, no headings: lowest rank first, then merchant (store order), then name.
  const entries = useMemo(() => {
    const order = active ? (SYNDICATE_META[active.name]?.tierOrder ?? []) : [];
    const rankIndex = (r: string) => (order.includes(r) ? order.indexOf(r) : order.length);
    return tiers
      .map((tier, t) => ({ tier, t }))
      .sort((a, b) => rankIndex(a.tier.rank) - rankIndex(b.tier.rank) || a.t - b.t)
      .flatMap(({ tier }) => tier.items.map((item) => ({ item, tier })));
  }, [tiers, active]);
  // Pills: merchants (open-world stores only) and ranks, each with collected/total; ranks follow the picked merchant.
  const merchants = useMemo(
    () =>
      sumBy(
        allTiers.filter((t) => t.merchant !== null),
        (t) => t.merchant ?? "",
      ),
    [allTiers],
  );
  const ranks = useMemo(
    () =>
      sumBy(
        allTiers.filter((t) => merchant === null || t.merchant === merchant),
        (t) => t.rank,
      ),
    [allTiers, merchant],
  );
  const groupLabel = SYNDICATE_GROUPS.find((g) => g.id === group)?.label ?? group;

  const padded = (node: ReactNode) => <div className="p-4 lg:p-6">{node}</div>;

  if (stores.isPending) return padded(<Skeleton lines={6} />);
  if (stores.isError) {
    return padded(
      <Alert
        tone="danger"
        title="Could not load syndicate data"
        action={
          <Button size="sm" leadingIcon={RefreshCw} onClick={() => void stores.refetch()}>
            Retry
          </Button>
        }
      >
        {String(stores.error)}
      </Alert>,
    );
  }
  if (inGroup.length === 0) {
    return padded(
      stores.data.length === 0 ? (
        <EmptyState icon={Database} title="No data yet" description="Refresh the item database from Settings." />
      ) : (
        <EmptyState
          icon={Database}
          title={`Nothing in ${groupLabel} yet`}
          description="Other groups have data. Refresh the item database from Settings to load all syndicates."
        />
      ),
    );
  }
  if (!active) return null;

  const filtered = search !== "" || missingOnly || merchant !== null || rank !== null;
  const progress = storeProgress(active, ownership);
  const pct = percent({ done: progress.complete, total: progress.total });

  return (
    <Tabs
      selectedKey={active.name}
      onSelectionChange={(name) => {
        setSelected(name);
        setMerchant(null);
        setRank(null);
        setSearch("");
      }}
      className="min-h-0 flex-1 gap-0"
    >
      <div className="shrink-0 border-b border-border bg-bg px-4 pt-2">
        <TabList label="Syndicate" className="flex-wrap border-b-0">
          {inGroup.map((store) => {
            const p = storeProgress(store, ownership);
            return (
              <Tab key={store.name} id={store.name}>
                <span aria-hidden="true" className="size-2 rounded-full bg-tone" style={toneOf(store.name)} />
                {SYNDICATE_META[store.name]?.short ?? store.name}
                <span className="text-xs text-muted tabular-nums">{percent({ done: p.complete, total: p.total })}%</span>
              </Tab>
            );
          })}
        </TabList>
      </div>
      {inGroup.map((store) => (
        <TabPanel key={store.name} id={store.name} className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 flex-col gap-2 border-b border-border bg-bg px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <SearchInput
                label={`Search ${store.name}`}
                placeholder="Search items…"
                value={search}
                onValueChange={setSearch}
                size="sm"
                className="w-72"
              />
              <div role="group" aria-label="Filters" className="flex flex-wrap gap-1">
                <Chip active={missingOnly} onActiveChange={setMissingOnly}>
                  Missing only
                </Chip>
              </div>
              {merchants.length > 1 && (
                <PillGroup
                  label="Merchant"
                  allLabel="All merchants"
                  options={merchants}
                  value={merchant}
                  onChange={(next) => {
                    setMerchant(next);
                    setRank(null);
                  }}
                />
              )}
              {ranks.length > 1 && (
                <PillGroup
                  label={group === "lab" ? "Category" : "Rank"}
                  allLabel={group === "lab" ? "All categories" : "All ranks"}
                  options={ranks}
                  value={rank}
                  onChange={setRank}
                  prefix={(key) => {
                    const n = rankNumber(store.name, key);
                    return n === null ? null : `R${String(n)}`;
                  }}
                />
              )}
              {filtered && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSearch("");
                    setMissingOnly(false);
                    setMerchant(null);
                    setRank(null);
                  }}
                >
                  Show all
                </Button>
              )}
            </div>
            <ProgressBar
              name={`${store.name} progress`}
              value={progress.complete}
              max={progress.total}
              label={`${store.name} · ${String(progress.complete)} / ${String(progress.total)} collected · ${String(pct)}%`}
              tone="domain"
              style={toneOf(store.name)}
            />
          </div>
          <div
            role="region"
            aria-label={`${store.name} items`}
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrollable region is operable (axe scrollable-region-focusable)
            tabIndex={0}
            className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4"
          >
            {entries.length === 0 ? (
              <EmptyState
                icon={CircleCheckBig}
                title={
                  missingOnly ? "Nothing missing — all items complete!" : search ? "No items match your search." : "No items for this syndicate."
                }
              />
            ) : (
              <ul className={CARD_GRID} style={cardGridStyle(16, cardScale)}>
                {entries.map(({ item, tier }) => {
                  const craft = craftById.get(recipeTarget(item));
                  return (
                    <SyndicateCard
                      key={item.unique_name}
                      item={item}
                      status={itemStatus(item, ownership)}
                      merchant={tier.merchant}
                      rank={tier.rank}
                      rankNo={rankNumber(store.name, tier.rank)}
                      craft={craft}
                      tracked={craft ? tracked.has(craft.unique_name) : false}
                      baseUrl={baseUrl}
                      onOpen={(c) => {
                        onOpen(c.unique_name);
                      }}
                      onToggleTrack={toggleTrack}
                    />
                  );
                })}
              </ul>
            )}
          </div>
        </TabPanel>
      ))}
    </Tabs>
  );
}
