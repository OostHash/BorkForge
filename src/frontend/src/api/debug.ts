import { invoke } from "./invoke";

/** Diagnostics: the export (Settings → Debugging and Console) and devtools helpers. */

/** Writes the diagnostics zip and returns where it was saved. */
export const exportDiagnostics = () => invoke("export_diagnostics");

/** Opens Explorer with the exported zip selected. */
export const showDiagnosticsExport = (path: string) => invoke("show_diagnostics_export", { path });

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
