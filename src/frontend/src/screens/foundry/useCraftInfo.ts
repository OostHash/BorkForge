import { useMemo } from "react";
import { useImageBaseUrl } from "../../api/catalog";
import { useRelicDrops, useRelicNames } from "../../api/foundry";
import { useCrafting, useFormaCounts, useOwnership, useShards } from "../../api/inventory";
import { useSaveSettings, useSettings } from "../../api/settings";
import { isBuilding, isMastered, isReady, ownedQty, parseShard, type FoundryItem, type RecipeComponent } from "../../domain/foundry";
import type { CraftContext, CraftInfo } from "./CraftCard";

const EMPTY_TRACKED: string[] = [];

/** Inventory state and tracking that every Foundry card, row and the recipe modal need. */
export function useCraftInfo(onOpen: (item: FoundryItem) => void) {
  const { ownership: own } = useOwnership();
  const crafting = useCrafting();
  const rawShards = useShards();
  const forma = useFormaCounts();
  const relicDrops = useRelicDrops();
  const relicNames = useRelicNames();
  const baseUrl = useImageBaseUrl();
  const { data: settings } = useSettings();
  const saveSettings = useSaveSettings();

  const trackedList = Array.isArray(settings?.tracked) ? (settings.tracked as string[]) : EMPTY_TRACKED;
  const tracked = useMemo(() => new Set(trackedList), [trackedList]);

  const infoFor = (item: FoundryItem, recipe: RecipeComponent[] | null): CraftInfo => {
    const id = item.unique_name;
    return {
      item,
      recipe,
      owned: ownedQty(own, id) > 0,
      ready: isReady(item, recipe ?? undefined, own),
      mastered: isMastered(item, own),
      rank: own.mastery[id] ?? null,
      building: isBuilding(item, recipe ?? undefined, crafting),
      subsumed: item.category === "Warframes" && own.subsumed.has(id),
      forma: forma[id] ?? 0,
      shards: item.category === "Warframes" ? (rawShards[id] ?? []).map(parseShard) : [],
      tracked: tracked.has(id),
    };
  };

  const toggleTrack = (item: FoundryItem) => {
    const id = item.unique_name;
    saveSettings.mutate({ tracked: tracked.has(id) ? trackedList.filter((t) => t !== id) : [...trackedList, id] });
  };

  const ctx: CraftContext = { own, relicDrops, relicNames, baseUrl, onOpen, onToggleTrack: toggleTrack };
  return { own, crafting, baseUrl, tracked, infoFor, toggleTrack, ctx };
}
