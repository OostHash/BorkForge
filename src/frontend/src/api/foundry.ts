import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { RecipeComponent } from "../domain/foundry";
import { invoke } from "./invoke";
import { relicKeys } from "./relics";

/** Under ["catalog"], so catalogue-updated (TauriEventBridge) refreshes all of it. */
export const foundryKeys = {
  craftable: ["catalog", "craftable"] as const,
  recipes: (ids: readonly string[]) => ["catalog", "recipes", ...ids] as const,
  relicDrops: ["catalog", "relic-drops"] as const,
};

export function useCraftableItems() {
  return useQuery({ queryKey: foundryKeys.craftable, queryFn: () => invoke("get_craftable_items"), staleTime: Infinity });
}

const EMPTY_RECIPES: ReadonlyMap<string, RecipeComponent[]> = new Map();

/**
 * Recipes for the given items in one bulk call (the current page, the open
 * modal, or the Ready-filter candidates). `null` while loading; ids are
 * sorted so the same set shares one cache entry.
 */
export function useRecipes(ids: readonly string[], enabled = true): ReadonlyMap<string, RecipeComponent[]> | null {
  const sorted = useMemo(() => [...ids].sort(), [ids]);
  const query = useQuery({
    queryKey: foundryKeys.recipes(sorted),
    queryFn: async () => {
      const result = await invoke("get_recipes_bulk", { uniqueNames: sorted });
      return new Map(sorted.map((id) => [id, result[id] ?? []]));
    },
    enabled: enabled && sorted.length > 0,
    staleTime: Infinity,
  });
  if (sorted.length === 0) return EMPTY_RECIPES;
  return query.data ?? null;
}

const EMPTY_DROPS: Readonly<Record<string, readonly string[]>> = {};

export function useRelicDrops() {
  return useQuery({ queryKey: foundryKeys.relicDrops, queryFn: () => invoke("get_relic_drops"), staleTime: Infinity }).data ?? EMPTY_DROPS;
}

/** Relic uniqueName to display name, from the full catalogue (shared cache with Relics). */
export function useRelicNames(): ReadonlyMap<string, string> {
  const { data } = useQuery({ queryKey: relicKeys.catalog, queryFn: () => invoke("get_all_items"), staleTime: Infinity });
  return useMemo(() => new Map((data ?? []).filter((i) => i.category === "Relics").map((i) => [i.unique_name, i.name])), [data]);
}
