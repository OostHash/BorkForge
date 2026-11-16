import { CheckCheck, Lock, RefreshCw, SearchX } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useImageBaseUrl } from "../../api/catalog";
import { useFilterPresets } from "../../api/presets";
import { useDropData } from "../../api/relics";
import type { Ownership } from "../../domain/completionist";
import {
  DEFAULT_RELIC_FILTERS,
  ERAS,
  filterRelics,
  highlightTerms,
  intactRelic,
  matchesTerms,
  REFINEMENTS,
  REFINEMENT_LABEL,
  refinementCounts,
  relicComplete,
  relicPresetCodec,
  splitSearchTerms,
  type CatalogIndex,
  type RelicDrop,
  type RelicFilters,
} from "../../domain/relics";
import { PresetBar } from "../../patterns/PresetBar";
import { TileGrid } from "../../patterns/TileGrid";
import { Button } from "../../primitives/actions";
import { Table, type TableColumn } from "../../primitives/data";
import { Alert, Badge, Card, Chip, EmptyState, Skeleton, domainTone } from "../../primitives/display";
import { toast } from "../../primitives/overlay";
import { SearchInput, Select } from "../../primitives/forms";
import { Pagination } from "../../primitives/navigation";
import { cn } from "../../primitives/cn";
import { CARD_GRID, cardGridStyle, useCardScale } from "../../patterns/CardScale";
import { ItemImagesContext } from "../../patterns/ItemImage";
import { useShowImages, ViewControls, type View } from "../../patterns/ViewControls";
import { pageAfterResize, usePageSize, useScrollTopOn } from "../../patterns/PageSize";
import { RelicCard, type RelicCardShared } from "./RelicCard";

const VIEW_KEY = "ff-view-relic";

const readView = (): View => (localStorage.getItem(VIEW_KEY) === "list" ? "list" : "cards");

const SORTS: ReadonlyArray<{ value: RelicFilters["sort"]; label: string }> = [
  { value: "count", label: "Most owned" },
  { value: "plat", label: "Avg platinum" },
  { value: "ducats", label: "Avg ducats" },
  { value: "az", label: "A–Z" },
  { value: "za", label: "Z–A" },
];

function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1">
      <span aria-hidden="true" className="me-1 text-xs text-muted">
        {label}
      </span>
      {children}
    </div>
  );
}

type Props = { index: CatalogIndex; own: Ownership; prices: ReadonlyMap<string, number> };

export function RelicsTab({ index, own, prices }: Props) {
  const drops = useDropData();
  const baseUrl = useImageBaseUrl();
  const [filters, setFilters] = useState<RelicFilters>(DEFAULT_RELIC_FILTERS);
  const [page, setPage] = useState(0);
  const [view, setView] = useState<View>(readView);
  const [pageSize, setPageSize] = usePageSize("relics");
  const [cardScale, setCardScale] = useCardScale("relics");
  const [showImages, setShowImages] = useShowImages("relics");

  const applyFilters = (next: RelicFilters) => {
    setFilters(next);
    setPage(0);
  };
  const presets = useFilterPresets(relicPresetCodec, filters, applyFilters, DEFAULT_RELIC_FILTERS);
  const update = (patch: Partial<RelicFilters>) => {
    setFilters({ ...filters, ...patch });
    setPage(0);
  };

  const ctx = useMemo(() => ({ index, own, prices }), [index, own, prices]);
  const visible = useMemo(() => filterRelics(drops.data ?? [], filters, ctx), [drops.data, filters, ctx]);
  const ownedCount = useMemo(() => (drops.data ?? []).filter((d) => refinementCounts(d, index, own).total > 0).length, [drops.data, index, own]);
  const highlight = highlightTerms(splitSearchTerms(filters.search));
  const rewardMatches = highlight.length > 0 && visible.some((d) => d.rewards.some((r) => matchesTerms(highlight, r.itemName)));
  const pageCount = Math.ceil(visible.length / pageSize);
  const current = Math.min(page, Math.max(0, pageCount - 1));
  const scroller = useScrollTopOn(current);
  const paged = visible.slice(current * pageSize, (current + 1) * pageSize);
  const shared: RelicCardShared = { index, own, baseUrl, ignoreFormaKuva: filters.ignoreFormaKuva, highlight };

  const columns = useMemo<Array<TableColumn<RelicDrop>>>(
    () => [
      {
        id: "name",
        header: "Relic",
        cell: (d) => (
          <span className="flex items-center gap-2">
            {d.fullName}
            {intactRelic(d, index)?.vaulted === true && (
              <Badge tone="danger" variant="outline" icon={Lock}>
                Vaulted
              </Badge>
            )}
          </span>
        ),
      },
      { id: "owned", header: "Owned", cell: (d) => refinementCounts(d, index, own).total, align: "end" },
      {
        id: "refinements",
        header: "Refinements",
        cell: (d) => {
          const c = refinementCounts(d, index, own);
          return REFINEMENTS.filter((r) => c[r] > 0)
            .map((r) => `${String(c[r])} ${REFINEMENT_LABEL[r]}`)
            .join(", ");
        },
      },
      {
        id: "status",
        header: "Status",
        cell: (d) =>
          relicComplete(d, index, own, filters.ignoreFormaKuva) ? (
            <Badge tone="domain" style={domainTone("ducat")} icon={CheckCheck}>
              All obtained
            </Badge>
          ) : null,
      },
    ],
    [index, own, filters.ignoreFormaKuva],
  );

  if (drops.isPending) {
    return (
      <div aria-busy="true" className="flex flex-col gap-3">
        <p className="text-sm text-muted">Fetching drop data…</p>
        <TileGrid>
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i}>
              <Card padding="sm">
                <Skeleton lines={4} />
              </Card>
            </li>
          ))}
        </TileGrid>
      </div>
    );
  }

  if (drops.isError) {
    return (
      <div className="p-4 lg:p-6">
        <Alert
          tone="danger"
          title="Could not load relic drop data"
          action={
            <Button
              size="sm"
              leadingIcon={RefreshCw}
              onClick={() => {
                drops.refresh().catch(() => toast({ title: "Still could not load drop data", tone: "danger" }));
              }}
            >
              Retry
            </Button>
          }
        >
          {String(drops.error)}
        </Alert>
      </div>
    );
  }

  // List view: the table fills the area below the toolbar and scrolls itself (sticky header).
  const tableMode = view === "list" && visible.length > 0;
  return (
    <ItemImagesContext value={showImages}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 flex-col gap-2 border-b border-border bg-bg px-4 py-3 lg:px-6">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <SearchInput
              label="Search relics and rewards"
              placeholder="Relic or item names (comma-separated)…"
              value={filters.search}
              onValueChange={(search) => {
                update({ search });
              }}
              size="sm"
              className="w-72"
            />
            <FilterGroup label="Era">
              {ERAS.map((era) => (
                <Chip
                  key={era}
                  active={filters.eras.includes(era.toLowerCase())}
                  onActiveChange={() => {
                    update({ eras: toggle(filters.eras, era.toLowerCase()) });
                  }}
                >
                  {era}
                </Chip>
              ))}
            </FilterGroup>
            <FilterGroup label="Show">
              <Chip
                active={filters.ownership.includes("owned")}
                onActiveChange={() => {
                  update({ ownership: toggle(filters.ownership, "owned") });
                }}
              >
                Owned
              </Chip>
              <Chip
                active={filters.ownership.includes("notowned")}
                onActiveChange={() => {
                  update({ ownership: toggle(filters.ownership, "notowned") });
                }}
              >
                Not owned
              </Chip>
              <Chip
                active={filters.vault.includes("vaulted")}
                onActiveChange={() => {
                  update({ vault: toggle(filters.vault, "vaulted") });
                }}
              >
                Vaulted
              </Chip>
              <Chip
                active={filters.vault.includes("unvaulted")}
                onActiveChange={() => {
                  update({ vault: toggle(filters.vault, "unvaulted") });
                }}
              >
                Unvaulted
              </Chip>
              <Chip
                active={filters.completion.includes("complete")}
                onActiveChange={() => {
                  update({ completion: toggle(filters.completion, "complete") });
                }}
              >
                Completed
              </Chip>
              <Chip
                active={filters.completion.includes("incomplete")}
                onActiveChange={() => {
                  update({ completion: toggle(filters.completion, "incomplete") });
                }}
              >
                Uncompleted
              </Chip>
              <Chip
                active={filters.ignoreFormaKuva}
                onActiveChange={(ignoreFormaKuva) => {
                  update({ ignoreFormaKuva });
                }}
              >
                Ignore Forma/Kuva
              </Chip>
            </FilterGroup>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <PresetBar model={presets} label="Relics" />
            <label className="flex items-center gap-2 text-xs text-muted">
              Sort
              <Select
                size="sm"
                value={filters.sort}
                onChange={(event) => {
                  update({ sort: event.target.value as RelicFilters["sort"] });
                }}
                className="w-40"
              >
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </label>
            <ViewControls
              screen="relics"
              view={view}
              onViewChange={(next) => {
                setView(next);
                localStorage.setItem(VIEW_KEY, next);
              }}
              scale={cardScale}
              onScaleChange={setCardScale}
              pageSize={pageSize}
              onPageSizeChange={(next) => {
                setPage(pageAfterResize(current, pageSize, next));
                setPageSize(next);
              }}
              images={showImages}
              onImagesChange={setShowImages}
            />
          </div>
          <Pagination
            page={current}
            pageCount={pageCount}
            onPageChange={setPage}
            summary={`${String(visible.length)} relics · ${String(ownedCount)} owned`}
            compact
          />
        </div>

        <div
          ref={scroller}
          role="region"
          aria-label="Relic collection"
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- the card collection is independently scrollable
          tabIndex={0}
          className={cn(
            "flex min-h-0 flex-1 flex-col outline-none focus-visible:outline-2 focus-visible:outline-focus",
            tableMode ? "" : "gap-3 overflow-y-auto p-4 lg:p-6",
          )}
        >
          {rewardMatches && (
            <p className={cn("text-sm text-muted", tableMode && "px-4 pt-3 pb-2")}>Rewards matching your search are marked “Match”.</p>
          )}

          {visible.length === 0 ? (
            <EmptyState icon={SearchX} title="No relics match." />
          ) : view === "cards" ? (
            <ul className={CARD_GRID} style={cardGridStyle(22, cardScale)}>
              {paged.map((drop) => (
                <RelicCard key={drop.fullName} drop={drop} shared={shared} />
              ))}
            </ul>
          ) : (
            <Table
              label="Relics"
              className="flex-1 rounded-none border-0"
              scrollTopKey={current}
              columns={columns}
              data={paged}
              getRowId={(d) => d.fullName}
            />
          )}
        </div>
      </div>
    </ItemImagesContext>
  );
}
