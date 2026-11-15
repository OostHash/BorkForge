import { useQuery } from "@tanstack/react-query";
import { invoke } from "./invoke";

export const worldstateKeys = { all: ["worldstate"] as const };

/** The backend caches worldstate; polling once a minute matches the current app. */
export const WORLDSTATE_POLL_MS = 60_000;

/**
 * Worldstate for every consumer in this window (Timers, modular window,
 * fissure alerts). One query key means one poll and one shared snapshot,
 * replacing the hand-written subscriber set in the current app.
 */
export function useWorldState() {
  return useQuery({
    queryKey: worldstateKeys.all,
    queryFn: () => invoke("fetch_worldstate"),
    refetchInterval: WORLDSTATE_POLL_MS,
    refetchIntervalInBackground: true,
  });
}
