import { FolderOpen } from "lucide-react";
import { useState } from "react";
import { exportDiagnostics, showDiagnosticsExport } from "../../api/debug";
import { Button } from "../../primitives/actions";

export type ExportResult = { tone: "success" | "danger"; text: string } | null;

/** The diagnostics export: where the last zip went, and whether one is being written. */
export function useDiagnosticsExport() {
  const [busy, setBusy] = useState(false);
  const [path, setPath] = useState<string | null>(null);
  const [result, setResult] = useState<ExportResult>(null);
  const run = () => {
    setBusy(true);
    setResult(null);
    exportDiagnostics()
      .then(
        (saved) => {
          setPath(saved);
          setResult({ tone: "success", text: `Saved to ${saved}` });
        },
        (error: unknown) => {
          setResult({ tone: "danger", text: `Export failed: ${String(error)}` });
        },
      )
      .finally(() => {
        setBusy(false);
      });
  };
  return { busy, path, result, run };
}

/** "Show in folder" (once a zip exists) and "Export". */
export function ExportDiagnosticsButtons({ state }: { state: ReturnType<typeof useDiagnosticsExport> }) {
  const { busy, path, run } = state;
  return (
    <>
      {path !== null && (
        <Button size="sm" leadingIcon={FolderOpen} onClick={() => void showDiagnosticsExport(path).catch(() => undefined)}>
          Show in folder
        </Button>
      )}
      <Button size="sm" loading={busy} onClick={run}>
        {busy ? "Exporting…" : "Export"}
      </Button>
    </>
  );
}
