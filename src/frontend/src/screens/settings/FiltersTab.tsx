import { useState } from "react";
import { usePresetManager } from "../../api/presets";
import type { PresetModule } from "../../domain/filterPresets";
import { PresetList } from "../../patterns/PresetBar";
import { FormField, Select } from "../../primitives/forms";
import { SettingsGroup, SwitchRow } from "./parts";

const PAGES: ReadonlyArray<{ value: PresetModule; label: string }> = [
  { value: "inventory", label: "Inventory" },
  { value: "foundry", label: "Foundry" },
  { value: "market", label: "Market Sets" },
  { value: "relics", label: "Relic browser" },
];

export function FiltersTab() {
  const [page, setPage] = useState<PresetModule>("inventory");
  const manager = usePresetManager(page);
  const pageLabel = PAGES.find((p) => p.value === page)?.label ?? page;
  return (
    <>
      <SettingsGroup title="Filter presets">
        <SwitchRow
          label="Restore previous filters on active preset click"
          description="Clicking an active pinned preset again restores the filters from before it, instead of clearing them."
          checked={manager.restorePrevious}
          onCheckedChange={manager.setRestorePrevious}
        />
        <FormField layout="row" label="Page" description="Manage saved and pinned presets for one page.">
          <Select
            className="w-48"
            value={page}
            onChange={(event) => {
              setPage(event.target.value as PresetModule);
            }}
          >
            {PAGES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </FormField>
      </SettingsGroup>
      <SettingsGroup title={`${pageLabel} presets`}>
        <div>
          <PresetList model={manager} />
        </div>
      </SettingsGroup>
    </>
  );
}
