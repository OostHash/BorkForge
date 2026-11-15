import { Check, CheckCheck, Lock, Search } from "lucide-react";
import { imageSources } from "../../api/catalog";
import type { Ownership } from "../../domain/completionist";
import {
  findRewardItem,
  intactRelic,
  matchesTerms,
  primeParent,
  REFINEMENTS,
  REFINEMENT_LABEL,
  refinementCounts,
  relicComplete,
  rewardState,
  type CatalogIndex,
  type DropReward,
  type Rarity,
  type RelicDrop,
} from "../../domain/relics";
import { ItemImage } from "../../patterns/ItemImage";
import { cn } from "../../primitives/cn";
import { Badge, Card, domainTone } from "../../primitives/display";

export const RARITY_TONE: Readonly<Record<Rarity, Parameters<typeof domainTone>[0]>> = {
  Common: "rarity-bronze",
  Uncommon: "rarity-silver",
  Rare: "rarity-gold",
};

type Shared = {
  index: CatalogIndex;
  own: Ownership;
  baseUrl: string | undefined;
  ignoreFormaKuva: boolean;
  /** Search terms long enough to highlight rewards. */
  highlight: readonly string[];
};

function rewardImage(reward: DropReward, { index, baseUrl }: Shared): string[] {
  const item = findRewardItem(reward.itemName, index);
  const parent = primeParent(reward.itemName);
  const parentItem = parent ? index.byName.get(parent.toLowerCase()) : undefined;
  return [...new Set([...imageSources(item?.image_name ?? undefined, baseUrl), ...imageSources(parentItem?.image_name ?? undefined, baseUrl)])];
}

function RewardTile({ reward, shared }: { reward: DropReward; shared: Shared }) {
  const state = rewardState(reward, shared.index, shared.own, shared.ignoreFormaKuva);
  const highlighted = shared.highlight.length > 0 && matchesTerms(shared.highlight, reward.itemName);
  const label = reward.itemName.replace(" Blueprint", " BP");
  return (
    <li
      className={cn(
        "flex min-w-0 flex-col items-center gap-1 rounded-md border-t-2 border-t-tone bg-surface-sunken p-1.5 text-center",
        highlighted && "outline-2 outline-accent",
      )}
      style={domainTone(RARITY_TONE[reward.rarity])}
    >
      <ItemImage sources={rewardImage(reward, shared)} name={reward.itemName} size="md" />
      <span className="line-clamp-2 text-xs" title={`${reward.itemName} — ${reward.rarity} (${reward.chance.toFixed(1)}%)`}>
        {label}
      </span>
      <span className="flex flex-wrap justify-center gap-1">
        <Badge tone="domain" style={domainTone(RARITY_TONE[reward.rarity])} variant="outline">
          {reward.rarity}
        </Badge>
        {state.complete ? (
          <Badge tone="domain" style={domainTone("ducat")} icon={CheckCheck}>
            Complete
          </Badge>
        ) : state.owned ? (
          <Badge tone="success" icon={Check}>
            Owned
          </Badge>
        ) : null}
        {highlighted && (
          <Badge tone="accent" icon={Search}>
            Match
          </Badge>
        )}
      </span>
    </li>
  );
}

/** Relic with owned counts per refinement and its six rewards. */
export function RelicCard({ drop, shared }: { drop: RelicDrop; shared: Shared }) {
  const counts = refinementCounts(drop, shared.index, shared.own);
  const vaulted = intactRelic(drop, shared.index)?.vaulted === true;
  const complete = relicComplete(drop, shared.index, shared.own, shared.ignoreFormaKuva);
  const icon = intactRelic(drop, shared.index)?.image_name ?? undefined;
  return (
    <li>
      <Card as="article" padding="sm" className={cn("h-full", counts.total === 0 && "border-dashed")}>
        <header className="flex items-center gap-2">
          <ItemImage sources={imageSources(icon, shared.baseUrl)} name={drop.fullName} />
          <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">{drop.fullName}</h3>
          {vaulted && (
            <Badge tone="danger" variant="outline" icon={Lock}>
              Vaulted
            </Badge>
          )}
          {complete && (
            <Badge tone="domain" style={domainTone("ducat")} icon={CheckCheck}>
              All obtained
            </Badge>
          )}
          <span className="text-base font-semibold tabular-nums" aria-label={`${String(counts.total)} owned`}>
            ×{counts.total}
          </span>
        </header>
        <p className="flex flex-wrap gap-x-3 text-xs text-muted">
          {counts.total === 0
            ? "Not owned"
            : REFINEMENTS.filter((r) => counts[r] > 0).map((r) => (
                <span key={r}>
                  {counts[r]} {REFINEMENT_LABEL[r]}
                </span>
              ))}
        </p>
        <ul aria-label={`${drop.fullName} rewards`} className="grid grid-cols-3 gap-1.5">
          {drop.rewards.map((reward) => (
            <RewardTile key={reward.itemName} reward={reward} shared={shared} />
          ))}
        </ul>
      </Card>
    </li>
  );
}

export type { Shared as RelicCardShared };
