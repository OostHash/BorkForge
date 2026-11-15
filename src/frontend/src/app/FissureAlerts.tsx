import { useEffect, useRef } from "react";
import { notify } from "../api/notifications";
import { useWorldState } from "../api/worldstate";
import { collectNewMatches, type SeenFissures } from "../domain/fissures";
import { formatDuration, untilExpiry } from "../domain/time";
import { useTimerPreferences } from "../screens/timers/useTimerPreferences";

const variantSuffix = (variant: string, separator: string) =>
  variant === "hard" ? `${separator}Steel Path` : variant === "storm" ? `${separator}Void Storm` : "";

/**
 * Background OS notifications for watched fissures (main window only).
 * Watches present at startup are seeded silently; see collectNewMatches.
 */
export function FissureAlerts() {
  const { watches, notificationsEnabled } = useTimerPreferences();
  const { data: ws } = useWorldState();
  const seen = useRef<SeenFissures>(new Map());
  const known = useRef<Set<string> | null>(null);
  const restored = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (known.current === null) {
      // First render with settings: everything already saved counts as restored.
      known.current = new Set(watches.map((w) => w.id));
      restored.current = new Set(known.current);
    }
    if (!notificationsEnabled) {
      for (const w of watches) restored.current.add(w.id);
      seen.current = new Map();
      return;
    }
    if (!ws) return;
    const { fresh, live } = collectNewMatches(ws, watches, seen.current, restored.current);
    seen.current = live;
    const first = fresh[0];
    if (!first) return;
    if (fresh.length === 1) {
      const remaining = untilExpiry(first.fissure.expiry, Date.now());
      void notify(
        `${first.fissure.tier} ${first.fissure.missionType}${variantSuffix(first.variant, " · ")}`,
        remaining > 0 ? `${first.fissure.node} — ${formatDuration(remaining)} left` : first.fissure.node,
      );
      return;
    }
    const shown = fresh.slice(0, 5).map(({ fissure, variant }) => `${fissure.tier} ${fissure.missionType}${variantSuffix(variant, " ")}`);
    const more = fresh.length > 5 ? ` and ${String(fresh.length - 5)} more` : "";
    void notify(`${String(fresh.length)} watched fissures`, shown.join(", ") + more);
  }, [ws, watches, notificationsEnabled]);

  return null;
}
