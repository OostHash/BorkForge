import { Plus } from "lucide-react";
import { useState } from "react";
import { MISSION_TYPES_BY_VARIANT, WATCH_TIERS, WATCH_VARIANTS, type FissureWatch } from "../../../domain/fissures";
import { Button } from "../../../primitives/actions";
import { Alert, Card, Chip } from "../../../primitives/display";
import { RadioGroup, Switch } from "../../../primitives/forms";

type Props = {
  watches: readonly FissureWatch[];
  notificationsEnabled: boolean;
  permissionDenied: boolean;
  onAdd: (watch: Omit<FissureWatch, "id">) => Promise<void>;
  onRemove: (id: string) => void;
  onNotificationsChange: (enabled: boolean) => Promise<void>;
};

const variantLabel = (variant: FissureWatch["variant"]) => WATCH_VARIANTS.find((v) => v.value === variant)?.label ?? variant;

export function describeWatch(watch: FissureWatch): string {
  return [watch.tier, watch.missionType === "Any" ? null : watch.missionType, watch.variant === "any" ? null : variantLabel(watch.variant)]
    .filter(Boolean)
    .join(" · ");
}

/** Saved watches as removable chips, a form to add one, and the OS notification switch. */
export function WatchPanel({ watches, notificationsEnabled, permissionDenied, onAdd, onRemove, onNotificationsChange }: Props) {
  const [variant, setVariant] = useState<FissureWatch["variant"]>("any");
  const [tier, setTier] = useState<string>("Any");
  const [missionType, setMissionType] = useState("Any");
  const missionTypes = MISSION_TYPES_BY_VARIANT[variant];

  return (
    <Card padding="md" className="bg-surface-sunken">
      {watches.length > 0 && (
        <ul aria-label="Saved watches" className="flex flex-wrap gap-1.5">
          {watches.map((watch) => (
            <li key={watch.id}>
              <Chip
                removeLabel={`Remove watch ${describeWatch(watch)}`}
                onRemove={() => {
                  onRemove(watch.id);
                }}
              >
                {describeWatch(watch)}
              </Chip>
            </li>
          ))}
        </ul>
      )}

      <RadioGroup
        legend="Mode"
        appearance="segmented"
        value={variant}
        onValueChange={(next) => {
          setVariant(next);
          // Keep the mission type only if the new mode offers it.
          if (!MISSION_TYPES_BY_VARIANT[next].includes(missionType)) setMissionType("Any");
        }}
        options={WATCH_VARIANTS}
      />
      <RadioGroup
        legend="Tier"
        appearance="segmented"
        value={tier}
        onValueChange={setTier}
        options={WATCH_TIERS.map((t) => ({ value: t, label: t }))}
      />
      <RadioGroup
        legend="Mission type"
        appearance="segmented"
        value={missionType}
        onValueChange={setMissionType}
        options={missionTypes.map((m) => ({ value: m, label: m }))}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <Switch
          checked={notificationsEnabled}
          onCheckedChange={(enabled) => {
            void onNotificationsChange(enabled);
          }}
        >
          Notify me when a watched fissure appears
        </Switch>
        <Button
          variant="primary"
          size="sm"
          leadingIcon={Plus}
          onClick={() => {
            void onAdd({ tier, missionType, variant }).then(() => {
              setTier("Any");
              setMissionType("Any");
              setVariant("any");
            });
          }}
        >
          Add watch
        </Button>
      </div>
      {permissionDenied && (
        <Alert tone="warning" title="Notifications are blocked">
          Allow notifications for FrameForge in Windows settings to get fissure alerts.
        </Alert>
      )}
    </Card>
  );
}
