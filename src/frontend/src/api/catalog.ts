import { useQuery } from "@tanstack/react-query";
import { invoke } from "./invoke";

export const catalogKeys = {
  syndicates: ["catalog", "syndicates"] as const,
  weapons: ["catalog", "weapons"] as const,
};

/** Syndicate stores and dojo research labs in one list (backend order, labs last). */
export function useSyndicateStores() {
  return useQuery({
    queryKey: catalogKeys.syndicates,
    queryFn: async () => {
      const [syndicates, labs] = await Promise.all([invoke("get_syndicate_stores"), invoke("get_research_lab_stores")]);
      return [...syndicates, ...labs];
    },
    staleTime: Infinity,
  });
}

export function useWeaponCatalog() {
  return useQuery({
    queryKey: catalogKeys.weapons,
    queryFn: () => invoke("get_weapon_catalog"),
    staleTime: Infinity,
  });
}

/** Base URL of the local image cache server; images fall back to the CDN without it. */
export function useImageBaseUrl(): string | undefined {
  return useQuery({
    queryKey: ["image-base-url"] as const,
    queryFn: () => invoke("get_img_cache_dir"),
    staleTime: Infinity,
  }).data;
}

const IMAGE_CDN = "https://cdn.warframestat.us/img";

/** Where to load an item image from: the local cache server first, then the CDN. */
export function imageSources(imageName: string | undefined, baseUrl: string | undefined): string[] {
  if (!imageName) return [];
  if (imageName.startsWith("http") || imageName.startsWith("/")) return [imageName];
  return [...(baseUrl ? [`${baseUrl}/${imageName}`] : []), `${IMAGE_CDN}/${imageName}`];
}
