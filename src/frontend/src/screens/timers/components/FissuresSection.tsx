import { BellRing, Eye, ListFilter, Sparkles } from "lucide-react";
import { useId, useState } from "react";
import { ensureNotificationPermission } from "../../../api/notifications";
import { matchesWatch, sortByTier, tierTone, type FissureWatch } from "../../../domain/fissures";
import { formatDuration, untilExpiry } from "../../../domain/time";
import type { FissureVariant, WorldState, WsFissure, WsStorm } from "../../../domain/worldstate.types";
import { ScreenSection } from "../../../patterns/ScreenSection";
import { TileGrid } from "../../../patterns/TileGrid";
import { Button } from "../../../primitives/actions";
import { cn } from "../../../primitives/cn";
import { Badge, Card, EmptyState, domainTone } from "../../../primitives/display";
import { Tab, TabList, TabPanel, Tabs } from "../../../primitives/navigation";
import { WatchPanel } from "./WatchPanel";

type Props = {
  ws: WorldState | undefined;
  now: number;
  watches: readonly FissureWatch[];
  notificationsEnabled: boolean;
  onAddWatch: (watch: Omit<FissureWatch, "id">) => void;
  onRemoveWatch: (id: string) => void;
  onNotificationsChange: (enabled: boolean) => void;
};

const TAB_LABEL: Record<FissureVariant, string> = { normal: "Normal", hard: "Steel Path", storm: "Storms" };

function FissureTile({ fissure, variant, watched, now }: { fissure: WsFissure | WsStorm; variant: FissureVariant; watched: boolean; now: number }) {
  const tone = tierTone(fissure.tier);
  return (
    <li>
      <Card padding="sm" className={cn("h-full", watched && "border-s-2 border-accent bg-accent-soft")}>
        <div className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap gap-1">
            <Badge tone={tone ? "domain" : "neutral"} style={tone ? domainTone(tone) : undefined} variant="outline">
              {fissure.tier}
            </Badge>
            {watched && (
              <Badge tone="accent" icon={Eye}>
                Watched
              </Badge>
            )}
          </div>
          <span className="shrink-0 text-sm font-semibold whitespace-nowrap tabular-nums">{formatDuration(untilExpiry(fissure.expiry, now))}</span>
        </div>
        <span className="truncate text-sm font-semibold">{fissure.missionType}</span>
        <div className="flex items-center gap-2 text-xs text-muted">
          {fissure.enemy && <Badge>{fissure.enemy}</Badge>}
          <span className="min-w-0 truncate">{fissure.node}</span>
          {variant === "hard" && <span className="sr-only">Steel Path</span>}
        </div>
      </Card>
    </li>
  );
}

/** Void fissures per mode, watched fissures marked, and the watch editor. */
export function FissuresSection({ ws, now, watches, notificationsEnabled, onAddWatch, onRemoveWatch, onNotificationsChange }: Props) {
  const [tab, setTab] = useState<FissureVariant>("normal");
  const [panelOpen, setPanelOpen] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const panelId = useId();

  const lists: Record<FissureVariant, ReadonlyArray<WsFissure | WsStorm>> = {
    normal: sortByTier(ws?.fissures ?? []),
    hard: sortByTier(ws?.spFissures ?? []),
    storm: sortByTier(ws?.voidStorms ?? []),
  };

  const askPermission = async () => {
    const granted = await ensureNotificationPermission();
    setPermissionDenied(!granted);
    return granted;
  };

  return (
    <Tabs selectedKey={tab} onSelectionChange={setTab} className="gap-0">
      <ScreenSection
        title="Void Fissures"
        actions={
          <>
            <TabList label="Fissure mode" appearance="pills">
              {(Object.keys(TAB_LABEL) as FissureVariant[]).map((variant) => (
                <Tab key={variant} id={variant}>
                  {TAB_LABEL[variant]}
                  <span className="text-muted tabular-nums">{lists[variant].length}</span>
                </Tab>
              ))}
            </TabList>
            <Button
              size="sm"
              variant={panelOpen ? "secondary" : "ghost"}
              leadingIcon={ListFilter}
              aria-expanded={panelOpen}
              aria-controls={panelId}
              onClick={() => {
                setPanelOpen(!panelOpen);
              }}
            >
              Watches
              {watches.length > 0 && <Badge tone="accent">{watches.length}</Badge>}
            </Button>
          </>
        }
      >
        {panelOpen && (
          <div id={panelId} className="mb-3">
            <WatchPanel
              watches={watches}
              notificationsEnabled={notificationsEnabled}
              permissionDenied={permissionDenied}
              onRemove={onRemoveWatch}
              onAdd={async (watch) => {
                onAddWatch(watch);
                // Ask now, while the user is thinking about alerts, not from the poll loop.
                if (notificationsEnabled) await askPermission();
              }}
              onNotificationsChange={async (enabled) => {
                if (!enabled) {
                  onNotificationsChange(false);
                  return;
                }
                // Turn the switch back off when the OS refuses, instead of promising alerts that cannot arrive.
                onNotificationsChange(await askPermission());
              }}
            />
          </div>
        )}
        {(Object.keys(TAB_LABEL) as FissureVariant[]).map((variant) => (
          <TabPanel key={variant} id={variant}>
            {lists[variant].length === 0 ? (
              <EmptyState icon={variant === "storm" ? Sparkles : BellRing} title={`No active ${TAB_LABEL[variant].toLowerCase()} fissures.`} />
            ) : (
              <TileGrid min="sm">
                {lists[variant].map((fissure) => (
                  <FissureTile
                    key={fissure.id}
                    fissure={fissure}
                    variant={variant}
                    now={now}
                    watched={watches.some((watch) => matchesWatch(watch, fissure, variant))}
                  />
                ))}
              </TileGrid>
            )}
          </TabPanel>
        ))}
      </ScreenSection>
    </Tabs>
  );
}
