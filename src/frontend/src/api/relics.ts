import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { buildCatalogIndex, buildPriceIndex, parseDropData, type CatalogIndex, type CatalogItem, type RelicDrop } from "../domain/relics";
import { invoke } from "./invoke";

export const relicKeys = {
  drops: ["relics", "drops"] as const,
  catalog: ["catalog", "items"] as const,
  prices: ["prices", "wfm"] as const,
};

/** Relic drop tables (Intact). `refresh()` forces the backend to re-download them. */
export function useDropData() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: relicKeys.drops,
    queryFn: async (): Promise<RelicDrop[]> => parseDropData(await invoke("get_drop_data", { force: false })),
    staleTime: Infinity,
  });
  return {
    ...query,
    refresh: async () => {
      queryClient.setQueryData(relicKeys.drops, parseDropData(await invoke("get_drop_data", { force: true })));
    },
  };
}

/** The full item catalogue, indexed by name and relic refinement. */
export function useCatalogIndex(): { index: CatalogIndex; isPending: boolean } {
  const query = useQuery({
    queryKey: relicKeys.catalog,
    queryFn: () => invoke("get_all_items"),
    staleTime: Infinity,
  });
  const index = useMemo(() => buildCatalogIndex(query.data ?? []), [query.data]);
  return { index, isPending: query.isPending };
}

/** The catalogue by uniqueName (changelog rows). */
export function useCatalogByUniqueName(): ReadonlyMap<string, CatalogItem> {
  const { data } = useQuery({ queryKey: relicKeys.catalog, queryFn: () => invoke("get_all_items"), staleTime: Infinity });
  return useMemo(() => new Map((data ?? []).map((item) => [item.unique_name, item])), [data]);
}

/**
 * Platinum prices by item name (warframe.market cache). Missing prices count
 * as 0; the screen keeps working without them.
 */
export function usePlatPrices(): ReadonlyMap<string, number> {
  const query = useQuery({
    queryKey: relicKeys.prices,
    queryFn: async () => {
      const items = await invoke("fetch_wfm_items");
      const prices = await invoke("wfm_get_cached_prices");
      return buildPriceIndex(items, prices);
    },
    staleTime: 5 * 60_000,
  });
  return query.data ?? EMPTY_PRICES;
}

const EMPTY_PRICES: ReadonlyMap<string, number> = new Map();
