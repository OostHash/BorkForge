import { QueryClient } from "@tanstack/react-query";

/**
 * One QueryClient per window. Tauri data is local IPC, not the network, so
 * retries are short and window focus does not refetch; screens set their own
 * refetchInterval where data changes over time (e.g. worldstate).
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: false,
        staleTime: 30_000,
      },
    },
  });
}
