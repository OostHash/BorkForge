import { invoke } from "./invoke";

/** Diagnostics: the export (Settings → Debugging and Console). */

/** Writes the diagnostics zip and returns where it was saved. */
export const exportDiagnostics = () => invoke("export_diagnostics");

/** Opens Explorer with the exported zip selected. */
export const showDiagnosticsExport = (path: string) => invoke("show_diagnostics_export", { path });
