import { FlaskConical, Palette } from "lucide-react";
import { Button } from "../../primitives/actions";
import { ExportDiagnosticsButtons, useDiagnosticsExport } from "./ExportDiagnostics";
import { ResultText, SettingRow, SettingsGroup } from "./parts";

/** One zip for a bug report; the path stays visible so it can be shown in Explorer. */
function ExportRow() {
  const exporting = useDiagnosticsExport();
  return (
    <SettingRow
      label="Diagnostics export"
      description="One zip with logs, system facts and settings to attach to a bug report. Passwords, tokens, e-mail addresses and player names are removed. What HexDesk does is visible live in Settings → Console."
      result={exporting.result && <ResultText tone={exporting.result.tone}>{exporting.result.text}</ResultText>}
    >
      <ExportDiagnosticsButtons state={exporting} />
    </SettingRow>
  );
}

/** Settings → Debugging: what a bug report needs, plus the developer pages in development builds. */
export function DebuggingTab() {
  return (
    <>
      <SettingsGroup title="Bug reports">
        <ExportRow />
      </SettingsGroup>

      {import.meta.env.DEV && (
        <SettingsGroup title="Developer pages">
          <SettingRow label="Kitchen sink" description="Inspect the app's reusable interface components and interaction states.">
            <Button
              size="sm"
              leadingIcon={FlaskConical}
              onClick={() => {
                window.location.assign("?view=kitchen-sink");
              }}
            >
              Open
            </Button>
          </SettingRow>
          <SettingRow label="Tokens" description="Inspect the generated theme colours, spacing and density tokens.">
            <Button
              size="sm"
              leadingIcon={Palette}
              onClick={() => {
                window.location.assign("?view=tokens");
              }}
            >
              Open
            </Button>
          </SettingRow>
        </SettingsGroup>
      )}
    </>
  );
}
