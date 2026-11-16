import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { refreshBulkPrices } from "../../api/inventory";
import { useSession } from "../../api/trading";
import { AUTO_INVISIBLE_RANGE, autoInvisibleMinutes, clampMinutes } from "../../domain/settings";
import { Button } from "../../primitives/actions";
import { Alert } from "../../primitives/display";
import { FormField, Input } from "../../primitives/forms";
import { SettingRow, SettingsGroup, SwitchRow, useSettingsFile } from "./parts";

type RefreshState = "idle" | "loading" | "ok" | "error";
const REFRESH_LABEL: Record<RefreshState, string> = { idle: "Refresh now", loading: "Fetching…", ok: "Done!", error: "Failed" };
const RESET_MS: Partial<Record<RefreshState, number>> = { ok: 3000, error: 4000 };

function BulkPricesRefresh() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<RefreshState>("idle");
  useEffect(() => {
    const ms = RESET_MS[state];
    if (ms === undefined) return;
    const id = window.setTimeout(() => {
      setState("idle");
    }, ms);
    return () => {
      window.clearTimeout(id);
    };
  }, [state]);
  return (
    <div className="flex items-center gap-3">
      <Button
        loading={state === "loading"}
        onClick={() => {
          setState("loading");
          refreshBulkPrices(queryClient).then(
            () => {
              setState("ok");
            },
            () => {
              setState("error");
            },
          );
        }}
      >
        {REFRESH_LABEL[state]}
      </Button>
      {state === "error" && <span className="text-xs text-danger">Could not download prices. Check your internet connection.</span>}
    </div>
  );
}

function MinutesField({ value, disabled, onCommit }: { value: number; disabled: boolean; onCommit: (minutes: number) => void }) {
  // The parent keys this field by value, so a saved value resets the draft.
  const [draft, setDraft] = useState(String(value));
  return (
    <FormField layout="row" label="Minutes before going invisible" description="Between 1 and 480.">
      <Input
        type="number"
        size="sm"
        className="w-24 text-end tabular-nums"
        min={AUTO_INVISIBLE_RANGE.min}
        max={AUTO_INVISIBLE_RANGE.max}
        value={draft}
        disabled={disabled}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onBlur={() => {
          const minutes = clampMinutes(draft);
          setDraft(String(minutes));
          if (minutes !== value) onCommit(minutes);
        }}
      />
    </FormField>
  );
}

export function MarketTab() {
  const { settings, set } = useSettingsFile();
  const { data: session } = useSession();
  const loggedIn = session != null;
  const autoInvisible = settings.wfmAutoInvisible === true;
  const minutes = autoInvisibleMinutes(settings.wfmAutoInvisibleMins);
  return (
    <>
      <SettingsGroup title="Prices">
        <SettingRow label="Bulk prices" description="Download the daily price data again now. Use this when prices look stale or are missing.">
          <BulkPricesRefresh />
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup title="Status automation">
        {!loggedIn && (
          <div>
            <Alert tone="info">Log in to warframe.market in Market → Trading to use these.</Alert>
          </div>
        )}
        <SwitchRow
          label="Go invisible on start"
          description="When BorkForge opens, set your warframe.market status to Invisible."
          checked={settings.wfmInvisibleOnStart === true}
          disabled={!loggedIn}
          onCheckedChange={(on) => {
            set({ wfmInvisibleOnStart: on });
          }}
        />
        <SwitchRow
          label="Go invisible on close"
          description="Before BorkForge exits, set your warframe.market status to Invisible."
          checked={settings.wfmInvisibleOnClose === true}
          disabled={!loggedIn}
          onCheckedChange={(on) => {
            set({ wfmInvisibleOnClose: on });
          }}
        />
        <SwitchRow
          label="Go invisible after a while"
          description={`After ${String(minutes)} minutes, set your status to Invisible.`}
          checked={autoInvisible}
          disabled={!loggedIn}
          onCheckedChange={(on) => {
            set({ wfmAutoInvisible: on });
          }}
        />
        <MinutesField
          key={minutes}
          value={minutes}
          disabled={!loggedIn || !autoInvisible}
          onCommit={(next) => {
            set({ wfmAutoInvisibleMins: next });
          }}
        />
      </SettingsGroup>

      <SettingsGroup title="Sale automation">
        <SwitchRow
          label="Record automatic sales"
          description="Record detected sales in your warframe.market statistics. When off, BorkForge only reduces or removes the listing. Recorded sales cannot be undone from BorkForge."
          checked={settings.wfmRecordSales === true}
          disabled={!loggedIn}
          onCheckedChange={(on) => {
            set({ wfmRecordSales: on });
          }}
        />
      </SettingsGroup>
    </>
  );
}
