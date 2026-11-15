import { RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { useSyndicateStores } from "../../api/catalog";
import { useCraftableItems } from "../../api/foundry";
import { useOwnership } from "../../api/inventory";
import { storeProgress, SYNDICATE_GROUPS, syndicateGroup, type SyndicateGroup } from "../../domain/completionist";
import {
  categoryProgress,
  DEFAULT_FOUNDRY_FILTERS,
  FOUNDRY_CATEGORIES,
  patchFilters,
  percent,
  type FoundryFilters,
  type Progress,
} from "../../domain/foundry";
import { Button } from "../../primitives/actions";
import { Alert } from "../../primitives/display";
import { SidebarItem } from "../../primitives/navigation";
import { RecipeHost } from "./RecipeModal";
import { EquipmentPanel } from "./EquipmentPanel";
import { SyndicatesPanel } from "./SyndicatesPanel";

type Nav = { kind: "equipment" } | { kind: "syndicates"; group: SyndicateGroup };

const progressLabel = (p: Progress | undefined) => (p ? `${p.done.toLocaleString("en-US")}/${p.total.toLocaleString("en-US")}` : "");

/**
 * Foundry: what you collected and how to build it. The navigator picks what you look at
 * (equipment by type, or syndicate offerings by source); every item opens
 * the same recipe modal.
 */
export function FoundryScreen() {
  const [nav, setNav] = useState<Nav>({ kind: "equipment" });
  const [filters, setFilters] = useState<FoundryFilters>(DEFAULT_FOUNDRY_FILTERS);
  const [openId, setOpenId] = useState<string | null>(null);
  const { ownership, isError, refetch } = useOwnership();
  const craftable = useCraftableItems();
  const stores = useSyndicateStores();

  const equipment = useMemo(() => categoryProgress(craftable.data ?? [], ownership), [craftable.data, ownership]);
  const groups = useMemo(() => {
    const out: Partial<Record<SyndicateGroup, Progress>> = {};
    for (const s of stores.data ?? []) {
      const g = syndicateGroup(s.name);
      const p = storeProgress(s, ownership);
      const acc = (out[g] ??= { done: 0, total: 0 });
      acc.done += p.complete;
      acc.total += p.total;
    }
    return out;
  }, [stores.data, ownership]);

  return (
    <div className="flex min-h-0 flex-1">
      <nav aria-label="Foundry" className="flex w-52 shrink-0 flex-col gap-3 overflow-y-auto border-e border-border p-2">
        <section aria-labelledby="nav-equipment" className="flex flex-col gap-0.5">
          <h2 id="nav-equipment" className="px-3 pt-1 pb-0.5 text-xs text-muted">
            Equipment
          </h2>
          <ul className="flex flex-col gap-0.5">
            {FOUNDRY_CATEGORIES.map((c) => (
              <li key={c}>
                <SidebarItem
                  active={nav.kind === "equipment" && filters.activeCat === c}
                  label={c}
                  badge={<span className="text-xs text-muted tabular-nums">{progressLabel(equipment[c])}</span>}
                  onClick={() => {
                    setNav({ kind: "equipment" });
                    if (filters.activeCat !== c) setFilters(patchFilters(filters, { activeCat: c }));
                  }}
                />
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="nav-syndicates" className="flex flex-col gap-0.5">
          <h2 id="nav-syndicates" className="px-3 pt-1 pb-0.5 text-xs text-muted">
            Syndicates
          </h2>
          <ul className="flex flex-col gap-0.5">
            {SYNDICATE_GROUPS.map((g) => {
              const p = groups[g.id];
              return (
                <li key={g.id}>
                  <SidebarItem
                    active={nav.kind === "syndicates" && nav.group === g.id}
                    label={g.label}
                    badge={p && p.total > 0 ? <span className="text-xs text-muted tabular-nums">{percent(p)}%</span> : undefined}
                    onClick={() => {
                      setNav({ kind: "syndicates", group: g.id });
                    }}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      </nav>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {isError && (
          <div className="shrink-0 px-4 pt-3">
            <Alert
              tone="warning"
              title="Could not load your inventory"
              action={
                <Button size="sm" leadingIcon={RefreshCw} onClick={refetch}>
                  Retry
                </Button>
              }
            >
              Progress is shown as if nothing is owned.
            </Alert>
          </div>
        )}
        {nav.kind === "equipment" ? (
          <EquipmentPanel
            filters={filters}
            onFiltersChange={setFilters}
            onOpen={(item) => {
              setOpenId(item.unique_name);
            }}
          />
        ) : (
          <SyndicatesPanel group={nav.group} ownership={ownership} onOpen={setOpenId} />
        )}
      </div>

      <RecipeHost
        openId={openId}
        onClose={() => {
          setOpenId(null);
        }}
      />
    </div>
  );
}
