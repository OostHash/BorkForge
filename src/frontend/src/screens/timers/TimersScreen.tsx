import { ExternalLink, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useQuantities } from "../../api/inventory";
import { openExternal } from "../../api/links";
import { useWorldState } from "../../api/worldstate";
import { duviriCycle, formatDuration, untilExpiry } from "../../domain/time";
import { getTimerInfo, TIMER_LABELS, type TimerId } from "../../domain/timers";
import type { WorldState } from "../../domain/worldstate.types";
import { ScreenSection } from "../../patterns/ScreenSection";
import { TileGrid } from "../../patterns/TileGrid";
import { Button } from "../../primitives/actions";
import { Alert, Badge, Card, Skeleton, Spinner, domainTone } from "../../primitives/display";
import { ExpandableTile, TimerTile } from "./components/TimerTile";
import { FissuresSection } from "./components/FissuresSection";
import { Manifest } from "./components/Manifest";
import { stateTone } from "./stateTones";
import { useNow } from "../../state/useNow";
import { useTimerPreferences } from "./useTimerPreferences";

type Props = {
  /** False while the tab is hidden: countdowns pause. */
  active?: boolean;
};

const BOUNTIES = [
  ["cetus", "Cetus", "bounty-cetus"],
  ["vallis", "Orb Vallis", "bounty-vallis"],
  ["cambion", "Cambion Drift", "bounty-cambion"],
  ["zariman", "Zariman", "bounty-zariman"],
  ["hex", "Hex / Albrecht", "bounty-hex"],
] as const satisfies ReadonlyArray<readonly [string, string, TimerId]>;

function LoadingState() {
  return (
    <div aria-busy="true" className="flex flex-col gap-3 p-4">
      <Spinner label="Loading worldstate…" />
      <TileGrid>
        {Array.from({ length: 8 }, (_, i) => (
          <li key={i}>
            <Card padding="sm">
              <Skeleton lines={2} />
            </Card>
          </li>
        ))}
      </TileGrid>
    </div>
  );
}

/** Timers screen: world cycles, resets, events, news, alerts, invasions and void fissures. */
export function TimersScreen({ active = true }: Props) {
  const now = useNow(active);
  const worldstate = useWorldState();
  const { data: quantities = {} } = useQuantities();
  const prefs = useTimerPreferences();
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  if (worldstate.isPending) return <LoadingState />;
  const ws: WorldState | undefined = worldstate.data;

  const countdown = (expiry: string) => formatDuration(untilExpiry(expiry, now));
  const pin = (id: TimerId) => ({
    pinned: prefs.favorites.includes(id),
    onTogglePin: () => {
      prefs.toggleFavorite(id);
    },
    name: TIMER_LABELS[id],
  });
  const timer = (id: TimerId, detail?: string, kind?: Parameters<typeof stateTone>[1]) => {
    const info = ws ? getTimerInfo(id, ws, now) : null;
    if (!info) return null;
    return (
      <TimerTile
        key={id}
        name={TIMER_LABELS[id]}
        state={info.state}
        tone={stateTone(info.state, kind)}
        countdown={countdown(info.expiry)}
        {...(detail ? { detail } : {})}
        pin={pin(id)}
      />
    );
  };
  const expandProps = (key: string) => ({
    expanded: expanded.has(key),
    onExpandedChange: (open: boolean) => {
      const next = new Set(expanded);
      if (open) next.add(key);
      else next.delete(key);
      setExpanded(next);
    },
  });
  const duviri = duviriCycle(now);
  const trader = ws?.voidTrader;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {worldstate.isError && (
        <div className="p-3">
          <Alert
            tone="danger"
            title="Could not load the worldstate"
            action={
              <Button size="sm" leadingIcon={RefreshCw} onClick={() => void worldstate.refetch()}>
                Retry
              </Button>
            }
          >
            {ws ? "Showing the last known data." : String(worldstate.error)}
          </Alert>
        </div>
      )}

      <ScreenSection title="World Cycles">
        <TileGrid>
          {ws?.cetus && timer("cetus-cycle", `until ${ws.cetus.isDay ? "Night" : "Day"}`)}
          {ws?.vallis && timer("vallis-cycle", `until ${ws.vallis.isWarm ? "Cold" : "Warm"}`)}
          {ws?.cambion && timer("cambion-cycle", "next cycle", "cambion")}
          {ws?.zariman && timer("zariman-cycle", "until reset")}
          {timer("duviri-spiral", `until ${duviri.next}`)}
        </TileGrid>
      </ScreenSection>

      {ws?.bounties && Object.keys(ws.bounties).length > 0 && (
        <ScreenSection title="Bounties">
          <TileGrid>{BOUNTIES.map(([key, , id]) => (ws.bounties?.[key] ? timer(id, "until reset") : null))}</TileGrid>
        </ScreenSection>
      )}

      <ScreenSection title="Daily & Weekly">
        <TileGrid>
          {timer("daily-reset")}
          {timer("weekly-reset")}
          {timer("kahl")}
          {timer("deep-archimedea")}
          {ws?.sortie && (
            <ExpandableTile
              name="Sortie"
              state={ws.sortie.faction}
              tone={stateTone(ws.sortie.faction)}
              countdown={countdown(ws.sortie.expiry)}
              pin={pin("sortie")}
              collapsedDetail={ws.sortie.boss}
              {...expandProps("sortie")}
            >
              <ul aria-label="Sortie missions" className="flex flex-col">
                {ws.sortie.variants.map((v) => (
                  <li key={v.node} className="flex items-center gap-2 border-b border-border/60 py-1 text-sm last:border-b-0">
                    <span>{v.missionType}</span>
                    {v.modifier && (
                      <Badge tone="domain" style={domainTone("ducat")}>
                        {v.modifier}
                      </Badge>
                    )}
                    <span className="ms-auto truncate text-muted">{v.node}</span>
                  </li>
                ))}
              </ul>
            </ExpandableTile>
          )}
          {ws?.archonHunt && (
            <ExpandableTile
              name="Archon Hunt"
              state={ws.archonHunt.boss}
              tone={stateTone(ws.archonHunt.boss)}
              countdown={countdown(ws.archonHunt.expiry)}
              pin={pin("archon-hunt")}
              {...expandProps("archon")}
            >
              <ul aria-label="Archon Hunt missions" className="flex flex-col">
                {ws.archonHunt.missions.map((m) => (
                  <li key={m.node} className="flex items-center gap-2 border-b border-border/60 py-1 text-sm last:border-b-0">
                    <span>{m.type}</span>
                    <span className="ms-auto truncate text-muted">{m.node}</span>
                  </li>
                ))}
              </ul>
            </ExpandableTile>
          )}
          {ws?.circuit && (
            <ExpandableTile
              name="The Circuit"
              state="Duviri"
              tone={stateTone("Duviri", "circuit")}
              countdown={countdown(ws.circuit.expiry)}
              pin={pin("circuit")}
              {...expandProps("circuit")}
            >
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-muted">Normal</dt>
                <dd>{ws.circuit.normalFrames.join(" · ")}</dd>
                <dt className="text-muted">Steel Path</dt>
                <dd>{ws.circuit.hardWeapons.join(" · ")}</dd>
              </dl>
            </ExpandableTile>
          )}
        </TileGrid>
      </ScreenSection>

      <ScreenSection title="Events">
        <TileGrid>
          {trader && (
            <ExpandableTile
              name={trader.character}
              state={trader.active ? "Here" : "Away"}
              tone={stateTone(trader.active ? "Here" : "Away")}
              countdown={countdown(trader.active ? trader.expiry : trader.activation)}
              pin={pin("void-trader")}
              expandable={trader.active}
              collapsedDetail={trader.active ? trader.location : "arrives in"}
              {...expandProps("baro")}
            >
              <Manifest label={`${trader.character} inventory`} items={trader.manifest} quantities={quantities} currency="baro" />
            </ExpandableTile>
          )}
          {ws?.primeResurgence?.active && (
            <ExpandableTile
              name="Prime Resurgence"
              state="Active"
              tone={stateTone("Active")}
              countdown={countdown(ws.primeResurgence.expiry)}
              pin={pin("prime-resurgence")}
              {...expandProps("resurgence")}
            >
              <Manifest label="Prime Resurgence offers" items={ws.primeResurgence.manifest} quantities={quantities} currency="aya" />
            </ExpandableTile>
          )}
          {timer("nightwave")}
          {ws?.events?.map((event) => (
            <TimerTile key={event.label} name={event.label} state="Event" tone={stateTone("Event")} countdown={countdown(event.expiry)} />
          ))}
          {ws?.darvo && (
            <TimerTile
              name={`Darvo: ${ws.darvo.item}`}
              state={`-${String(ws.darvo.discount)}%`}
              tone={{ tone: "accent" }}
              countdown={countdown(ws.darvo.expiry)}
              detail={`${String(ws.darvo.salePrice)} platinum`}
            />
          )}
        </TileGrid>
      </ScreenSection>

      {ws?.news && ws.news.length > 0 && (
        <ScreenSection title="News & Promotions">
          <TileGrid>
            {ws.news.map((item) => (
              <li key={`${item.link}-${String(item.date)}`}>
                <Card padding="sm" className="h-full">
                  <p className="line-clamp-2 text-sm font-semibold">{item.message}</p>
                  <div className="mt-auto flex items-center gap-2">
                    <time dateTime={new Date(item.date).toISOString()} className="text-xs text-muted">
                      {new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </time>
                    {item.primeAccess && (
                      <Badge tone="domain" style={domainTone("news-prime")}>
                        Prime
                      </Badge>
                    )}
                    {item.stream && (
                      <Badge tone="domain" style={domainTone("news-stream")}>
                        Stream
                      </Badge>
                    )}
                    {item.update && (
                      <Badge tone="domain" style={domainTone("news-update")}>
                        Update
                      </Badge>
                    )}
                    <Button size="sm" variant="ghost" trailingIcon={ExternalLink} className="ms-auto" onClick={() => void openExternal(item.link)}>
                      Open
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </TileGrid>
        </ScreenSection>
      )}

      {ws?.alerts && ws.alerts.length > 0 && (
        <ScreenSection title={`Alerts (${String(ws.alerts.length)})`}>
          <TileGrid>
            {ws.alerts.map((alert) => (
              <li key={alert.id}>
                <Card padding="sm" className="h-full">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{alert.missionType}</span>
                    <span className="shrink-0 text-sm font-semibold whitespace-nowrap tabular-nums">{countdown(alert.expiry)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge>{alert.faction}</Badge>
                    {alert.rewardItem && <span className="min-w-0 truncate text-xs">{alert.rewardItem}</span>}
                  </div>
                </Card>
              </li>
            ))}
          </TileGrid>
        </ScreenSection>
      )}

      {ws?.invasions && ws.invasions.length > 0 && (
        <ScreenSection title={`Invasions (${String(ws.invasions.length)})`}>
          <TileGrid>
            {ws.invasions.map((inv) => (
              <li key={inv.id}>
                <Card padding="sm" className="h-full">
                  <span className="truncate text-sm font-semibold">{inv.node}</span>
                  <progress
                    value={Math.min(100, Math.max(0, inv.pct))}
                    max={100}
                    aria-label={`${inv.attacker} progress`}
                    className="h-1 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-hover [&::-webkit-progress-value]:bg-accent"
                  />
                  <dl className="grid grid-cols-[auto_1fr] gap-x-2 text-xs">
                    <dt>{inv.attacker}</dt>
                    <dd className="truncate text-end text-muted">{inv.attReward || "—"}</dd>
                    <dt>{inv.defender}</dt>
                    <dd className="truncate text-end text-muted">{inv.defReward || "—"}</dd>
                  </dl>
                </Card>
              </li>
            ))}
          </TileGrid>
        </ScreenSection>
      )}

      <FissuresSection
        ws={ws}
        now={now}
        watches={prefs.watches}
        notificationsEnabled={prefs.notificationsEnabled}
        onAddWatch={prefs.addWatch}
        onRemoveWatch={prefs.removeWatch}
        onNotificationsChange={prefs.setNotificationsEnabled}
      />
    </div>
  );
}
