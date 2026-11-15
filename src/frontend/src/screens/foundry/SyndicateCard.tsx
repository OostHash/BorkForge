import { Store } from "lucide-react";
import { imageSources } from "../../api/catalog";
import type { ItemStatus, SyndicateItem } from "../../domain/completionist";
import type { FoundryItem } from "../../domain/foundry";
import { ItemImage } from "../../patterns/ItemImage";
import { cn } from "../../primitives/cn";
import { Badge, Card } from "../../primitives/display";
import { FoundryWikiMenu, RecipeButton, TrackButton } from "./CraftCard";
import { StatusBadge } from "./StatusBadge";

/** Standing rank needed to buy, like the changelog's rank badge (R3). */
export function RankBadge({ rankNo, rank }: { rankNo: number; rank: string }) {
  return (
    <Badge tone="accent" title={`Requires rank ${String(rankNo)}: ${rank}`}>
      R{rankNo}
      <span className="sr-only"> ({rank})</span>
    </Badge>
  );
}

type Props = {
  item: SyndicateItem;
  status: ItemStatus;
  merchant: string | null;
  rank: string;
  rankNo: number | null;
  /** The craftable result (or the item itself); undefined for mods, sigils and the like. */
  craft: FoundryItem | undefined;
  tracked: boolean;
  baseUrl: string | undefined;
  onOpen: (item: FoundryItem) => void;
  onToggleTrack: (item: FoundryItem) => void;
};

/** A syndicate or lab offering, laid out like the equipment CraftCard. */
export function SyndicateCard({ item, status, merchant, rank, rankNo, craft, tracked, baseUrl, onOpen, onToggleTrack }: Props) {
  return (
    <li>
      <Card as="article" padding="md" interactive className={cn("flex h-full flex-col gap-2", status === "complete" && "border-success/60")}>
        <header className="flex items-start gap-2">
          <ItemImage sources={imageSources(item.image_name, baseUrl)} name={item.name} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h3 className="flex min-w-0 text-sm">
              {craft ? (
                <RecipeButton
                  item={{ ...craft, name: item.name }}
                  onOpen={() => {
                    onOpen(craft);
                  }}
                />
              ) : (
                <span className="truncate font-semibold" title={item.name}>
                  {item.name}
                </span>
              )}
            </h3>
            <p className="text-xs text-muted">{item.category}</p>
          </div>
          {craft && (
            <TrackButton
              name={craft.name}
              tracked={tracked}
              onToggle={() => {
                onToggleTrack(craft);
              }}
            />
          )}
          <FoundryWikiMenu name={item.name} />
        </header>
        <div className="flex flex-wrap gap-1">
          <StatusBadge status={status} />
          {rankNo !== null && <RankBadge rankNo={rankNo} rank={rank} />}
          {merchant && (
            <Badge variant="outline" icon={Store}>
              {merchant}
            </Badge>
          )}
        </div>
      </Card>
    </li>
  );
}
