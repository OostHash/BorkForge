import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { isTauri } from "../../api/env";
import { onEvent, type RelicRewards } from "../../api/events";
import { useRecipes } from "../../api/foundry";
import { hideRewardStrip, logRelic, takePendingRewards, useItemPrices, useOverlayPrefs, useOverlayStock, useRewardCatalog } from "../../api/overlays";
import {
  bestPick,
  cardWidth,
  cellLabel,
  columnCenters,
  PREVIEW_CARDS,
  priceNames,
  rewardCards,
  setEntryIds,
  type RewardCard,
} from "../../domain/relicReward";
import { cn } from "../../primitives/cn";
import { Badge, domainTone } from "../../primitives/display";

type Source = "idle" | "preview" | "live";
type Session = { source: Source; paths: string[] };
const IDLE: Session = { source: "idle", paths: [] };
const NO_RECIPES = new Map();
const NO_PRICES: ReadonlyMap<string, number> = new Map();

function subscribeResize(listener: () => void) {
  window.addEventListener("resize", listener);
  return () => {
    window.removeEventListener("resize", listener);
  };
}
const useWindowWidth = () => useSyncExternalStore(subscribeResize, () => window.innerWidth);

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

function Plat({ value }: { value: number | undefined }) {
  if (value === undefined) return <span className="text-muted">—</span>;
  return (
    <Badge tone="domain" style={domainTone("price-platinum")} title={`${fmt(value)} platinum`}>
      {fmt(value)}p
    </Badge>
  );
}

function Card({ card, left, width, best }: { card: RewardCard; left: number; width: number; best: boolean }) {
  const hasSet = card.components !== undefined && card.setName !== undefined;
  const ownedFull = (card.completeSets ?? 0) >= 1;
  return (
    <article
      aria-label={best ? `${card.name}, best pick` : card.name}
      className={cn(
        "absolute top-7 flex flex-col gap-1 rounded-lg border bg-surface/95 p-2 text-xs text-text shadow-2",
        card.unknown ? "border-warning/60" : best ? "border-accent" : "border-border",
      )}
      style={{ left, width }}
    >
      <h2 className="line-clamp-2 text-sm leading-tight font-semibold">
        {card.unknown ? "? " : ""}
        {card.name}
      </h2>
      <div className="flex flex-wrap items-center justify-between gap-1">
        <Plat value={card.plat} />
        {card.vaulted && <Badge variant="outline">Vaulted</Badge>}
        {card.ducats !== undefined && card.ducats > 0 ? (
          <Badge tone="domain" style={domainTone("ducat")}>
            {fmt(card.ducats)} ducats
          </Badge>
        ) : (
          <span className="text-muted">—</span>
        )}
      </div>
      {hasSet && (
        <>
          <Badge tone={ownedFull ? "success" : "neutral"} variant="outline" className="justify-center">
            {ownedFull ? "Full item owned" : "Full item not owned"}
          </Badge>
          <div className="flex items-center justify-between gap-1">
            <span className="text-muted">Set</span>
            <Plat value={(card.totalPlat ?? 0) > 0 ? card.totalPlat : undefined} />
          </div>
          <ul aria-label={`${card.setName ?? ""} parts`} className="grid grid-cols-2 gap-1">
            {(card.components ?? []).slice(0, 4).map((c) => {
              const have = c.owned >= c.needed;
              return (
                <li
                  key={c.unique_name}
                  className={cn(
                    "flex items-center justify-between gap-1 rounded-sm border px-1 py-0.5",
                    have ? "border-success/40 text-text" : "border-border text-muted",
                  )}
                >
                  <span className="truncate">{cellLabel(c.name, card.setName ?? "")}</span>
                  <span className="tabular-nums">
                    <span className="sr-only">{have ? "owned " : "missing, owned "}</span>
                    {c.owned}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {card.category && <p className="text-muted uppercase">{card.category}</p>}
    </article>
  );
}

/** Why a read is not shown: the same list again, or fewer items than shown; null when it is shown. */
export function skipReason(prev: Session, rewards: RelicRewards): string | null {
  if (prev.source !== "live") return null;
  if (prev.paths.join(",") === rewards.items.join(",")) return "duplicate";
  if (prev.paths.length > 0 && rewards.items.length <= prev.paths.length)
    return `count guard (${String(rewards.items.length)}<=${String(prev.paths.length)})`;
  return null;
}

/** Live rewards replace a preview; a duplicate or shorter read keeps what is shown. */
export function nextSession(prev: Session, rewards: RelicRewards): Session {
  return skipReason(prev, rewards) === null ? { source: "live", paths: rewards.items } : prev;
}

/**
 * The relic reward overlay window (relic-overlay, ?overlay): a card per reward
 * slot with prices and set progress, and an arrow over the best pick
 * (vault overlay-relic-reward.md). Transparent around the cards.
 */
export function RelicRewardOverlay() {
  const [session, setSession] = useState<Session>(IDLE);
  // What is shown now, for the session log (read outside the state updater).
  const shown = useRef(session);
  useEffect(() => {
    shown.current = session;
  }, [session]);
  const prefs = useOverlayPrefs();
  const stock = useOverlayStock();
  const width = useWindowWidth();

  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    const unlisteners: Array<() => void> = [];
    const keep = (p: Promise<() => void>) => {
      void p.then((fn) => {
        if (disposed) fn();
        else unlisteners.push(fn);
      });
    };
    const apply = (rewards: RelicRewards | null) => {
      if (!rewards || rewards.items.length === 0) {
        setSession(IDLE);
        void hideRewardStrip();
        return;
      }
      void logRelic(`[OV] rewards (${String(rewards.items.length)} items)`);
      const skip = skipReason(shown.current, rewards);
      if (skip) void logRelic(`[OV] rewards: ${skip}, skipping`);
      setSession((prev) => nextSession(prev, rewards));
    };
    keep(
      onEvent("relic-trigger", () => {
        setSession({ source: "live", paths: [] });
      }),
    );
    keep(onEvent("relic-rewards", apply));
    keep(
      onEvent("relic-reward-preview", () => {
        setSession((prev) => (prev.source === "live" ? prev : { source: "preview", paths: [] }));
      }),
    );
    keep(
      onEvent("relic-reward-preview-close", () => {
        setSession((prev) => (prev.source === "live" ? prev : IDLE));
        void hideRewardStrip();
      }),
    );
    keep(
      onEvent("overlays-disabled", () => {
        setSession(IDLE);
        void hideRewardStrip();
      }),
    );
    // Rewards that arrived before this window listened.
    void takePendingRewards().then((pending) => {
      if (!disposed && pending && pending.items.length > 0) apply(pending);
    });
    return () => {
      disposed = true;
      for (const fn of unlisteners) fn();
    };
  }, []);

  const catalog = useRewardCatalog(session.paths);
  const entryIds = useMemo(() => setEntryIds(session.paths, catalog), [session.paths, catalog]);
  const recipes = useRecipes(entryIds) ?? NO_RECIPES;
  const names = useMemo(
    () => priceNames(rewardCards(session.paths, { catalog, stock, recipes, prices: NO_PRICES })),
    [session.paths, catalog, stock, recipes],
  );
  const prices = useItemPrices(names);
  const live = useMemo(() => rewardCards(session.paths, { catalog, stock, recipes, prices }), [session.paths, catalog, stock, recipes, prices]);

  const cards = session.source === "preview" ? PREVIEW_CARDS : session.source === "live" ? live : [];
  if (cards.length === 0) return null;
  const best = bestPick(cards, prefs.rewardPriority);
  const centers = columnCenters(width, cards.length);
  const cw = cardWidth(width);
  return (
    <main aria-label="Relic rewards" className="relative h-full w-full">
      <h1 className="sr-only">Relic rewards</h1>
      {best >= 0 && (
        <svg
          aria-hidden="true"
          className="absolute top-0 size-6 text-accent"
          style={{ left: Math.round((centers[best] ?? width / 2) - 12) }}
          viewBox="0 0 24 20"
        >
          <polygon points="12,1 23,19 1,19" fill="currentColor" />
        </svg>
      )}
      {cards.map((card, i) => (
        <Card key={card.key} card={card} best={i === best} width={cw} left={Math.round((centers[i] ?? width / 2) - cw / 2)} />
      ))}
    </main>
  );
}
