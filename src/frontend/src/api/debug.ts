import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { NO_SIZES, SIZED_FOLDERS, type DebugFolder, type DebugSizes, type SizedFolder } from "../domain/debug";
import { invoke } from "./invoke";

/** Debug and diagnostics (vault debugging.md). */

export const debugKeys = { sizes: ["debug", "sizes"] as const, running: ["debug", "running"] as const };

/** Every debug folder size; loaded when the Debugging tab opens. */
export function useDebugSizes(): DebugSizes {
  return (
    useQuery({
      queryKey: debugKeys.sizes,
      queryFn: async () => {
        const sized = await Promise.all(
          SIZED_FOLDERS.map(async (which) => [which, await invoke("get_debug_data_size", { which }).catch(() => 0)] as const),
        );
        const diag = await invoke("get_diag_folder_size").catch(() => 0);
        return { ...(Object.fromEntries(sized) as Record<SizedFolder, number>), diag };
      },
      staleTime: 0,
    }).data ?? NO_SIZES
  );
}

export const reloadSizes = (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: debugKeys.sizes });

export const openDebugFolder = (which: DebugFolder) => invoke("open_debug_folder", { which });

/** Writes the diagnostics zip and returns where it was saved. */
export const exportDiagnostics = () => invoke("export_diagnostics");

/** Opens Explorer with the exported zip selected. */
export const showDiagnosticsExport = (path: string) => invoke("show_diagnostics_export", { path });

export async function clearDebugFolder(queryClient: QueryClient, which: SizedFolder | "diag"): Promise<void> {
  if (which === "diag") await invoke("clear_diag_folder");
  else await invoke("clear_debug_data", { which });
  await reloadSizes(queryClient);
}

// ── Running recordings ──────────────────────────────────────────────────────

/**
 * What runs in the backend. It has no getters, so the app remembers what it
 * started for its lifetime (survives tab switches and closing Settings).
 */
export type Running = { rawScan: boolean; memRelic: boolean; categorization: boolean };
const NOT_RUNNING: Running = { rawScan: false, memRelic: false, categorization: false };

export function useRunning(): Running {
  return useQuery({ queryKey: debugKeys.running, queryFn: () => NOT_RUNNING, staleTime: Infinity, gcTime: Infinity }).data ?? NOT_RUNNING;
}

export function useSetRunning() {
  const queryClient = useQueryClient();
  return (patch: Partial<Running>) => {
    queryClient.setQueryData<Running>(debugKeys.running, (prev) => ({ ...NOT_RUNNING, ...prev, ...patch }));
  };
}

// ── Loggers ─────────────────────────────────────────────────────────────────

/** The backend forgets the logger switches on restart: the main window sends the saved ones. */
export async function syncLoggers(blobs: boolean, api: boolean): Promise<void> {
  await Promise.all([invoke("set_blob_log", { enabled: blobs }), invoke("set_api_log", { enabled: api })]);
}

// ── Console helpers ─────────────────────────────────────────────────────────

/** window.__wfmDump(path) and window.__wfmAttrs() for looking at warframe.market answers from the devtools. */
export function installWfmConsoleHelpers(target: Record<string, unknown> = window as unknown as Record<string, unknown>): void {
  target.__wfmDump = async (path: string) => {
    const result = await invoke("wfm_debug_dump", { path }).catch((error: unknown) => String(error));
    console.log(result);
    return result;
  };
  target.__wfmAttrs = async () => {
    const list = await invoke("wfm_get_riven_attributes").catch((error: unknown) => [String(error)]);
    console.log(list.join("\n"));
    return list;
  };
}
