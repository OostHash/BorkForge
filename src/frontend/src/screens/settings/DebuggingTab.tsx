import { useQueryClient } from "@tanstack/react-query";
import { Copy, Eye, FlaskConical, FolderOpen, Palette } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import {
  clearDebugFolder,
  exportDiagnostics,
  openDebugFolder,
  reloadSizes,
  showDiagnosticsExport,
  useDebugSizes,
  useRunning,
  useSetRunning,
} from "../../api/debug";
import { invoke } from "../../api/invoke";
import { alreadyRunning, clearLabel, probeSummary, rawScanActive, TEST_ERAS, type DebugFolder, type SizedFolder } from "../../domain/debug";
import { Button } from "../../primitives/actions";
import { Select, Switch, Textarea } from "../../primitives/forms";
import { Modal } from "../../primitives/overlay";
import { setBatchPreviewOpen } from "../../state/batchPreview";
import { ResultText, SettingRow, SettingsGroup, useSettingsFile } from "./parts";

type Result = { tone: "success" | "danger"; text: string } | null;

/** One debug tool: name, what it does, its buttons, and the last result. */
function DebugRow({ title, description, result, children }: { title: string; description: ReactNode; result?: Result; children: ReactNode }) {
  return (
    <SettingRow label={title} description={description} result={result && <ResultText tone={result.tone}>{result.text}</ResultText>}>
      {children}
    </SettingRow>
  );
}

const failed = (prefix: string, error: unknown): Result => ({ tone: "danger", text: `${prefix}: ${String(error)}` });

/** Runs one backend action at a time and keeps its result line. */
function useAction() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const run = (work: () => Promise<Result>, errorPrefix = "Failed") => {
    setBusy(true);
    setResult(null);
    work()
      .then(setResult, (error: unknown) => {
        setResult(failed(errorPrefix, error));
      })
      .finally(() => {
        setBusy(false);
      });
  };
  return { busy, result, setResult, run };
}

function FolderButton({ which, disabled }: { which: DebugFolder; disabled?: boolean }) {
  return (
    <Button size="sm" leadingIcon={FolderOpen} disabled={disabled} onClick={() => void openDebugFolder(which).catch(() => undefined)}>
      Open folder
    </Button>
  );
}

function ClearButton({ which, bytes, disabled }: { which: SizedFolder | "diag"; bytes: number; disabled?: boolean }) {
  const queryClient = useQueryClient();
  return (
    <Button size="sm" disabled={disabled === true || bytes === 0} onClick={() => void clearDebugFolder(queryClient, which).catch(() => undefined)}>
      {clearLabel(bytes)}
    </Button>
  );
}

function OverlayLogRow() {
  const [log, setLog] = useState<string | null>(null);
  const action = useAction();
  const copy = async (text: string): Promise<Result> => {
    await navigator.clipboard.writeText(text);
    return { tone: "success", text: "Copied." };
  };
  return (
    <DebugRow title="Overlay log" description="Step-by-step log of the last relic overlay attempt." result={action.result}>
      <Button
        size="sm"
        leadingIcon={Eye}
        onClick={() => {
          action.run(async () => {
            setLog(await invoke("get_overlay_session_log"));
            return null;
          });
        }}
      >
        View
      </Button>
      <Button
        size="sm"
        leadingIcon={Copy}
        onClick={() => {
          action.run(async () => copy(await invoke("get_overlay_session_log")), "Could not copy");
        }}
      >
        Copy
      </Button>
      <Modal
        open={log !== null}
        onClose={() => {
          setLog(null);
        }}
        title="Overlay log"
        size="lg"
        footer={
          <Button
            leadingIcon={Copy}
            onClick={() => {
              if (log !== null) action.run(() => copy(log), "Could not copy");
            }}
          >
            Copy
          </Button>
        }
      >
        <pre className="max-h-[60vh] overflow-auto rounded-sm bg-surface p-2 font-mono text-xs whitespace-pre-wrap">{log}</pre>
      </Modal>
    </DebugRow>
  );
}

/** One zip for a bug report; the path stays visible so it can be shown in Explorer. */
function ExportRow() {
  const action = useAction();
  const [path, setPath] = useState<string | null>(null);
  return (
    <DebugRow
      title="Diagnostics export"
      description="One zip with logs, system facts and settings to attach to a bug report. Passwords, tokens, e-mail addresses and player names are removed."
      result={action.result}
    >
      {path !== null && (
        <Button size="sm" leadingIcon={FolderOpen} onClick={() => void showDiagnosticsExport(path).catch(() => undefined)}>
          Show in folder
        </Button>
      )}
      <Button
        size="sm"
        loading={action.busy}
        onClick={() => {
          action.run(async () => {
            const saved = await exportDiagnostics();
            setPath(saved);
            return { tone: "success", text: `Saved to ${saved}` };
          }, "Export failed");
        }}
      >
        {action.busy ? "Exporting…" : "Export"}
      </Button>
    </DebugRow>
  );
}

function DiagnosticsGroup() {
  const queryClient = useQueryClient();
  const { settings, set } = useSettingsFile();
  const sizes = useDebugSizes();
  const running = useRunning();
  const setRunning = useSetRunning();
  const capture = useAction();
  const probe = useAction();
  const raw = useAction();
  const memRelic = useAction();
  return (
    <SettingsGroup title="Diagnostics">
      <ExportRow />
      <OverlayLogRow />
      <DebugRow
        title="Relic captures"
        description="Save screenshots and the OCR log for every relic reward screen, one folder per screen. Screenshots are large: switch off when you are done."
      >
        <FolderButton which="diag" />
        <Switch
          checked={settings.autoDiagEnabled === true}
          onCheckedChange={(on) => {
            // The backend reads it from the settings file at each reward screen.
            set({ autoDiagEnabled: on });
          }}
        >
          Save captures
        </Switch>
        <ClearButton which="diag" bytes={sizes.diag} />
      </DebugRow>
      <DebugRow title="Manual capture" description="Take a diagnostic screenshot and scan log now." result={capture.result}>
        <FolderButton which="manual_capture" />
        <Button
          size="sm"
          loading={capture.busy}
          onClick={() => {
            capture.run(async () => {
              const path = await invoke("capture_diagnostics");
              void reloadSizes(queryClient);
              return { tone: "success", text: `Saved to ${path}` };
            }, "Capture failed");
          }}
        >
          {capture.busy ? "Working…" : "Capture"}
        </Button>
      </DebugRow>
      <DebugRow title="Memory probe" description="Dump inventory strings from Warframe's memory." result={probe.result}>
        <FolderButton which="probe" />
        <Button
          size="sm"
          loading={probe.busy}
          onClick={() => {
            probe.run(async () => {
              const lines = await invoke("dump_memory_probe");
              void reloadSizes(queryClient);
              return { tone: "success", text: probeSummary(lines) };
            }, "Probe failed");
          }}
        >
          {probe.busy ? "Running…" : "Run"}
        </Button>
        <ClearButton which="probe" bytes={sizes.probe} />
      </DebugRow>
      <DebugRow
        title="Raw memory record"
        description={
          running.rawScan ? "Recording: navigate in the game, then stop." : "Record every readable memory string while you navigate in the game."
        }
        result={raw.result}
      >
        <FolderButton which="raw_scan" />
        <Button
          size="sm"
          variant={running.rawScan ? "danger" : "secondary"}
          aria-pressed={running.rawScan}
          disabled={raw.busy}
          onClick={() => {
            raw.run(async () => {
              const active = rawScanActive(await invoke("toggle_raw_scan"));
              setRunning({ rawScan: active });
              if (!active) void reloadSizes(queryClient);
              return null;
            });
          }}
        >
          {running.rawScan ? "Stop" : "Record"}
        </Button>
        <ClearButton which="raw_scan" bytes={sizes.raw_scan} disabled={running.rawScan} />
      </DebugRow>
      <DebugRow
        title="Memory relic debug"
        description={
          running.memRelic
            ? "Running: following EE.log and scanning Warframe's memory."
            : "Follow EE.log and scan Warframe's memory for relic reward patterns; everything goes to a log file."
        }
        result={memRelic.result}
      >
        <Button
          size="sm"
          variant={running.memRelic ? "danger" : "secondary"}
          aria-pressed={running.memRelic}
          disabled={memRelic.busy}
          onClick={() => {
            memRelic.run(async () => {
              if (running.memRelic) {
                await invoke("stop_memory_relic_debug");
                setRunning({ memRelic: false });
                return null;
              }
              try {
                const path = await invoke("start_memory_relic_debug");
                setRunning({ memRelic: true });
                return { tone: "success", text: `Log: ${path}` };
              } catch (error) {
                if (!alreadyRunning(error)) throw error;
                setRunning({ memRelic: true });
                return { tone: "success", text: "It was running already." };
              }
            });
          }}
        >
          {running.memRelic ? "End" : "Start"}
        </Button>
      </DebugRow>
    </SettingsGroup>
  );
}

function RelicPickGroup() {
  const ocr = useAction();
  const test = useAction();
  const tail = useAction();
  const [era, setEra] = useState<string>("ALL");
  const [log, setLog] = useState<string | null>(null);
  const eraId = useId();
  const info = (text: string): Result => ({ tone: "success", text });
  return (
    <SettingsGroup title="Relic pick overlay">
      <DebugRow
        title="OCR era detect"
        description="Read the top-left quarter of the Warframe window and report which fissure era OCR finds."
        result={ocr.result}
      >
        <Button
          size="sm"
          loading={ocr.busy}
          onClick={() => {
            ocr.run(async () => info(await invoke("debug_detect_fissure_era")));
          }}
        >
          {ocr.busy ? "Running…" : "Test OCR"}
        </Button>
      </DebugRow>
      <DebugRow title="Test overlay" description="Open the relic pick overlay for an era, with your relics." result={test.result}>
        <label htmlFor={eraId} className="sr-only">
          Era
        </label>
        <Select
          id={eraId}
          size="sm"
          value={era}
          onChange={(event) => {
            setEra(event.target.value);
          }}
        >
          {TEST_ERAS.map((e) => (
            <option key={e} value={e}>
              {e === "ALL" ? "All eras" : e.charAt(0) + e.slice(1).toLowerCase()}
            </option>
          ))}
        </Select>
        <Button
          size="sm"
          onClick={() => {
            test.run(async () => info(await invoke("test_relic_pick_overlay", { era })));
          }}
        >
          Launch
        </Button>
      </DebugRow>
      <DebugRow
        title="EE.log tail"
        description="Open the relic screen in the game, then read what EE.log wrote last. Paste it in a bug report to find the right trigger line."
        result={tail.result}
      >
        <Button
          size="sm"
          onClick={() => {
            tail.run(async () => {
              setLog(await invoke("debug_ee_log_tail"));
              return null;
            });
          }}
        >
          Read log
        </Button>
      </DebugRow>
      {log !== null && <Textarea aria-label="EE.log tail" readOnly rows={10} value={log} className="font-mono text-xs" />}
    </SettingsGroup>
  );
}

/** Settings → Debugging: tools for bug reports and support (vault debugging.md). */
export function DebuggingTab() {
  const { settings, set } = useSettingsFile();
  const sizes = useDebugSizes();
  const running = useRunning();
  const setRunning = useSetRunning();
  const scanner = settings.memoryScannerEnabled === true;
  return (
    <>
      <SettingsGroup title="Loggers">
        <DebugRow
          title="Inventory snapshots"
          description={
            scanner ? "Save a JSON snapshot on every memory scan." : "Save a JSON snapshot on every memory scan. Needs the memory scanner (General)."
          }
        >
          <FolderButton which="blobs" disabled={!scanner} />
          <Switch
            checked={settings.blobLogEnabled === true}
            disabled={!scanner}
            onCheckedChange={(on) => {
              // AppLifecycle tells the backend.
              set({ blobLogEnabled: on });
            }}
          >
            Record snapshots
          </Switch>
          <ClearButton which="blobs" bytes={sizes.blobs} disabled={!scanner} />
        </DebugRow>
      </SettingsGroup>

      <SettingsGroup title="Inventory preview">
        <DebugRow title="Incoming batch" description="Preview gained, lost, building and rank changes without touching your inventory.">
          <Button
            size="sm"
            onClick={() => {
              setBatchPreviewOpen(true);
            }}
          >
            Preview
          </Button>
        </DebugRow>
      </SettingsGroup>

      <DiagnosticsGroup />
      <RelicPickGroup />

      <SettingsGroup title="Categorization">
        <DebugRow title="Unmatched paths" description="Write a JSON file per scan with every inventory path that has no WFCD match or fell to Misc.">
          <FolderButton which="unmatched_paths" />
          <Switch
            checked={running.categorization}
            onCheckedChange={() => {
              invoke("toggle_debug_categorization").then(
                (on) => {
                  setRunning({ categorization: on });
                },
                (error: unknown) => {
                  console.error("debug: categorization toggle failed", error);
                },
              );
            }}
          >
            Record unmatched paths
          </Switch>
          <ClearButton which="unmatched_paths" bytes={sizes.unmatched_paths} />
        </DebugRow>
      </SettingsGroup>

      {import.meta.env.DEV && (
        <SettingsGroup title="Developer pages">
          <DebugRow title="Kitchen sink" description="Inspect the app's reusable interface components and interaction states.">
            <Button
              size="sm"
              leadingIcon={FlaskConical}
              onClick={() => {
                window.location.assign("?view=kitchen-sink");
              }}
            >
              Open
            </Button>
          </DebugRow>
          <DebugRow title="Tokens" description="Inspect the generated theme colours, spacing and density tokens.">
            <Button
              size="sm"
              leadingIcon={Palette}
              onClick={() => {
                window.location.assign("?view=tokens");
              }}
            >
              Open
            </Button>
          </DebugRow>
        </SettingsGroup>
      )}
    </>
  );
}
