import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { factoryReset, refreshCatalogue } from "../../api/app";
import { clearInventoryCache, useItemListStatus } from "../../api/inventory";
import { Button } from "../../primitives/actions";
import { ConfirmDialog } from "../../primitives/overlay";
import { ResultText, SettingRow, SettingsGroup } from "./parts";

type Result = { ok: boolean; text: string } | null;

function CatalogueRefresh() {
  const queryClient = useQueryClient();
  const status = useItemListStatus();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>(null);
  return (
    <SettingRow
      label="Item database"
      description={
        status ? `${status.count.toLocaleString()} items · ${status.recipe_count.toLocaleString()} recipes cached` : "Catalogue status unknown"
      }
      result={result && <ResultText tone={result.ok ? "success" : "danger"}>{result.text}</ResultText>}
    >
      <Button
        size="sm"
        loading={busy}
        onClick={() => {
          setBusy(true);
          setResult(null);
          refreshCatalogue(queryClient, true)
            .then(
              ({ items, recipes }) => {
                setResult({ ok: true, text: `Loaded ${items.toLocaleString()} items, ${recipes.toLocaleString()} recipes.` });
              },
              (error: unknown) => {
                setResult({ ok: false, text: `Error: ${String(error)}` });
              },
            )
            .finally(() => {
              setBusy(false);
            });
        }}
      >
        {busy ? "Fetching…" : "Refresh catalogue"}
      </Button>
    </SettingRow>
  );
}

function ClearCache() {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>(null);
  return (
    <SettingRow
      label="Inventory cache"
      description="Forget all scanned quantities, mods, mastery and the change log. The scanner fills them again."
      result={result && <ResultText tone={result.ok ? "success" : "danger"}>{result.text}</ResultText>}
    >
      <Button
        variant="danger"
        size="sm"
        onClick={() => {
          setResult(null);
          setConfirming(true);
        }}
      >
        Clear cache
      </Button>
      <ConfirmDialog
        open={confirming}
        onClose={() => {
          setConfirming(false);
        }}
        title="Clear the inventory cache?"
        description="Scanned quantities, mods, mastery and the change log are removed. Settings, trades and presets stay."
        confirmLabel="Clear cache"
        destructive
        busy={busy}
        onConfirm={() => {
          setBusy(true);
          clearInventoryCache(queryClient)
            .then(
              () => {
                setResult({ ok: true, text: "Cache cleared." });
              },
              (error: unknown) => {
                setResult({ ok: false, text: `Error: ${String(error)}` });
              },
            )
            .finally(() => {
              setBusy(false);
              setConfirming(false);
            });
        }}
      />
    </SettingRow>
  );
}

function FactoryReset() {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <SettingRow
      label="Factory reset"
      description="Delete all app data (settings, inventory cache, trade log, market prices, warframe.market login) and restart. This cannot be undone."
      result={error && <ResultText tone="danger">{error}</ResultText>}
    >
      <Button
        variant="danger"
        size="sm"
        onClick={() => {
          setError(null);
          setConfirming(true);
        }}
      >
        Reset everything
      </Button>
      <ConfirmDialog
        open={confirming}
        onClose={() => {
          setConfirming(false);
        }}
        title="Reset HexDesk?"
        description="All app data is deleted and HexDesk restarts. This cannot be undone."
        confirmLabel="Reset everything"
        destructive
        busy={busy}
        onConfirm={() => {
          setBusy(true);
          // On success the backend restarts the app; only a failure comes back here.
          factoryReset().catch((e: unknown) => {
            setBusy(false);
            setConfirming(false);
            setError(`Error: ${String(e)}`);
          });
        }}
      />
    </SettingRow>
  );
}

export function DataTab() {
  return (
    <>
      <SettingsGroup title="Cache">
        <CatalogueRefresh />
        <ClearCache />
      </SettingsGroup>
      <SettingsGroup title="Reset">
        <FactoryReset />
      </SettingsGroup>
    </>
  );
}
