import { ChevronRight, Lock } from "lucide-react";
import { useMemo, useState } from "react";
import { useDropData } from "../../api/relics";
import type { Ownership } from "../../domain/completionist";
import {
  DROP_RATES,
  ERAS,
  plannerRows,
  REFINEMENTS,
  REFINEMENT_LABEL,
  type CatalogIndex,
  type PlannerOptions,
  type PlannerRow,
  type Refinement,
} from "../../domain/relics";
import { Button } from "../../primitives/actions";
import { Table, type SortingState, type TableColumn } from "../../primitives/data";
import { Badge, Chip, EmptyState, Skeleton, domainTone } from "../../primitives/display";
import { RadioGroup } from "../../primitives/forms";
import { Modal } from "../../primitives/overlay";
import { RARITY_TONE } from "./RelicCard";

const PLANNER_ERAS = ERAS.filter((e) => e !== "Requiem");

const formatValue = (value: number, metric: PlannerOptions["metric"]) =>
  value < 0.05 ? "—" : `${value.toFixed(1)}${metric === "plat" ? "p" : " dc"}`;

function Details({ row, metric, onClose }: { row: PlannerRow | null; metric: PlannerOptions["metric"]; onClose: () => void }) {
  return (
    <Modal
      open={row !== null}
      onClose={onClose}
      title={row?.drop.fullName ?? ""}
      description={row ? `Values at ${REFINEMENT_LABEL[row.best]}, the best refinement.` : undefined}
    >
      {row && (
        <div className="flex flex-col gap-3">
          <p className="flex flex-wrap gap-x-4 text-xs text-muted">
            {REFINEMENTS.map((r) => (
              <span key={r}>
                {REFINEMENT_LABEL[r]}: {String(Math.round(DROP_RATES[r].Rare * 100))}% rare
              </span>
            ))}
          </p>
          <table className="w-full text-sm">
            <caption className="sr-only">Rewards of {row.drop.fullName}</caption>
            <thead>
              <tr className="text-xs text-muted">
                <th scope="col" className="py-1 text-start font-medium">
                  Reward
                </th>
                <th scope="col" className="py-1 text-start font-medium">
                  Rarity
                </th>
                <th scope="col" className="py-1 text-end font-medium">
                  Chance
                </th>
                <th scope="col" className="py-1 text-end font-medium">
                  Value
                </th>
              </tr>
            </thead>
            <tbody>
              {row.drop.rewards.map((reward, i) => (
                <tr key={reward.itemName} className="border-t border-border">
                  <td className="py-1">{reward.itemName}</td>
                  <td className="py-1">
                    <Badge tone="domain" style={domainTone(RARITY_TONE[reward.rarity])} variant="outline">
                      {reward.rarity}
                    </Badge>
                  </td>
                  <td className="py-1 text-end tabular-nums">{(DROP_RATES[row.best][reward.rarity] * 100).toFixed(2)}%</td>
                  <td className="py-1 text-end tabular-nums">{formatValue(row.values[i] ?? 0, metric)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

type Props = { index: CatalogIndex; own: Ownership; prices: ReadonlyMap<string, number> };

/** Expected value per refinement, for deciding what to refine and run. */
export function PlannerTab({ index, own, prices }: Props) {
  const drops = useDropData();
  const [options, setOptions] = useState<PlannerOptions>({ metric: "plat", squad: 1, eras: [], vault: "all", ownedOnly: true });
  const [sorting, setSorting] = useState<SortingState>([{ id: "radiant", desc: true }]);
  const [detail, setDetail] = useState<PlannerRow | null>(null);
  const set = (patch: Partial<PlannerOptions>) => {
    setOptions({ ...options, ...patch });
  };

  const rows = useMemo(() => plannerRows(drops.data ?? [], options, { index, own, prices }), [drops.data, options, index, own, prices]);

  const columns = useMemo<Array<TableColumn<PlannerRow>>>(
    () => [
      {
        id: "name",
        header: "Relic",
        sortValue: (r) => r.drop.fullName,
        cell: (r) => (
          <span className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              trailingIcon={ChevronRight}
              aria-haspopup="dialog"
              onClick={() => {
                setDetail(r);
              }}
            >
              {r.drop.fullName}
            </Button>
            {r.vaulted && (
              <Badge tone="danger" variant="outline" icon={Lock}>
                Vaulted
              </Badge>
            )}
          </span>
        ),
      },
      { id: "owned", header: "Owned", sortValue: (r) => r.owned, cell: (r) => r.owned, align: "end" },
      ...REFINEMENTS.map((ref: Refinement): TableColumn<PlannerRow> => ({
        id: ref,
        header: REFINEMENT_LABEL[ref],
        align: "end",
        sortValue: (r) => r.ev[ref],
        cell: (r) =>
          r.best === ref && r.ev[ref] >= 0.05 ? (
            <span className="font-semibold text-success">
              {formatValue(r.ev[ref], options.metric)}
              <span className="sr-only"> (best)</span>
            </span>
          ) : (
            <span className="text-muted">{formatValue(r.ev[ref], options.metric)}</span>
          ),
      })),
      {
        id: "gain",
        header: "Refine gain",
        align: "end",
        sortValue: (r) => r.gain,
        cell: (r) => {
          const unit = options.metric === "plat" ? "p" : " dc";
          if (Math.abs(r.gain) < 0.05) return <span className="text-muted">0.0{unit}</span>;
          return (
            <span className={r.gain > 0 ? "text-success" : "text-danger"}>
              {r.gain > 0 ? "+" : ""}
              {r.gain.toFixed(1)}
              {unit}
            </span>
          );
        },
      },
    ],
    [options.metric],
  );

  if (drops.isPending)
    return (
      <div className="p-4 lg:p-6">
        <Skeleton lines={8} />
      </div>
    );
  if (drops.isError)
    return (
      <div className="p-4 lg:p-6">
        <EmptyState title="Drop data is not available." description="Retry on the Relics tab." />
      </div>
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-bg px-4 py-3 lg:px-6">
        <RadioGroup
          legend="Metric"
          hideLegend
          appearance="segmented"
          value={options.metric}
          onValueChange={(metric) => {
            set({ metric });
          }}
          options={[
            { value: "plat", label: "Platinum" },
            { value: "ducat", label: "Ducats" },
          ]}
        />
        <RadioGroup
          legend="Squad"
          hideLegend
          appearance="segmented"
          value={String(options.squad) as "1" | "2" | "3" | "4"}
          onValueChange={(squad) => {
            set({ squad: Number(squad) as PlannerOptions["squad"] });
          }}
          options={[
            { value: "1", label: "Solo" },
            { value: "2", label: "2 players" },
            { value: "3", label: "3 players" },
            { value: "4", label: "4 players" },
          ]}
        />
        <RadioGroup
          legend="Vault"
          hideLegend
          appearance="segmented"
          value={options.vault}
          onValueChange={(vault) => {
            set({ vault });
          }}
          options={[
            { value: "all", label: "All" },
            { value: "unvaulted", label: "Unvaulted" },
            { value: "vaulted", label: "Vaulted" },
          ]}
        />
        <div role="group" aria-label="Era" className="flex items-center gap-1">
          <span aria-hidden="true" className="me-1 text-xs text-muted">
            Era
          </span>
          <div className="flex flex-wrap gap-1">
            {PLANNER_ERAS.map((era) => (
              <Chip
                key={era}
                active={options.eras.includes(era.toLowerCase())}
                onActiveChange={() => {
                  const e = era.toLowerCase();
                  set({ eras: options.eras.includes(e) ? options.eras.filter((x) => x !== e) : [...options.eras, e] });
                }}
              >
                {era}
              </Chip>
            ))}
          </div>
        </div>
        <Chip
          active={options.ownedOnly}
          onActiveChange={(ownedOnly) => {
            set({ ownedOnly });
          }}
        >
          Owned only
        </Chip>
        <p aria-live="polite" className="ms-auto text-xs text-muted tabular-nums">
          {rows.length} relics
        </p>
      </div>

      <Table
        label="Relic planner"
        columns={columns}
        data={rows}
        getRowId={(r) => r.drop.fullName}
        sorting={sorting}
        onSortingChange={setSorting}
        className="min-h-0 flex-1 rounded-none border-0"
        empty={<EmptyState title="No relics match." description="Try turning off Owned only." />}
      />
      <Details
        row={detail}
        metric={options.metric}
        onClose={() => {
          setDetail(null);
        }}
      />
    </div>
  );
}
