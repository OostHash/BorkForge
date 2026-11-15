import { useClock } from "../../api/statistics";
import { clockFormatFrom, type ClockFormat } from "../../domain/statistics";
import { Badge } from "../../primitives/display";
import { FormField, RadioGroup, Slider } from "../../primitives/forms";
import {
  availableChoices,
  clampTextScale,
  CONTRAST_LABEL,
  DENSITY_CHOICES,
  DENSITY_LABEL,
  setPreferences,
  TEXT_SCALE_RANGE,
  THEME_LABEL,
  usePreferences,
} from "../../state/preferences";
import { NotificationsGroup } from "./NotificationsGroup";
import { SettingRow, SettingsGroup, SwitchRow, useSettingsFile } from "./parts";

const CLOCK_OPTIONS: ReadonlyArray<{ value: ClockFormat; label: string }> = [
  { value: "auto", label: "Auto" },
  { value: "12h", label: "12h" },
  { value: "24h", label: "24h" },
];
const DENSITY_OPTIONS = DENSITY_CHOICES.map((value) => ({ value, label: DENSITY_LABEL[value] }));

const percent = (scale: number) => `${String(Math.round(scale * 100))}%`;

/** Theme, contrast, colours, density, text size and clock (vault settings.md, theming-7a.md). */
function AppearanceGroup() {
  const { settings, set } = useSettingsFile();
  const prefs = usePreferences();
  const { locale } = useClock();
  const clock = clockFormatFrom(settings.clockFormat);
  // Only choices with a token set behind them.
  const choices = availableChoices();
  return (
    <SettingsGroup title="Appearance">
      {choices.themes.length > 1 && (
        <SettingRow group={false} label="Theme">
          <RadioGroup
            legend="Theme"
            hideLegend
            appearance="segmented"
            value={prefs.theme}
            options={choices.themes.map((value) => ({ value, label: THEME_LABEL[value] }))}
            onValueChange={(theme) => {
              setPreferences({ theme });
            }}
          />
        </SettingRow>
      )}
      {choices.contrasts.length > 1 && (
        <SettingRow group={false} label="Contrast">
          <RadioGroup
            legend="Contrast"
            hideLegend
            appearance="segmented"
            value={prefs.contrast}
            options={choices.contrasts.map((value) => ({ value, label: CONTRAST_LABEL[value] }))}
            onValueChange={(contrast) => {
              setPreferences({ contrast });
            }}
          />
        </SettingRow>
      )}
      <SwitchRow
        label="Colour-blind palette"
        description="Blue and orange instead of green and red for gains and losses, owned and vaulted, success and errors."
        checked={prefs.cvd}
        onCheckedChange={(on) => {
          setPreferences({ cvd: on });
        }}
      />
      <SettingRow group={false} label="Density" description="Height of buttons, fields and table rows. Text size stays as set.">
        <RadioGroup
          legend="Density"
          hideLegend
          appearance="segmented"
          value={prefs.density}
          options={DENSITY_OPTIONS}
          onValueChange={(density) => {
            setPreferences({ density });
          }}
        />
      </SettingRow>
      <FormField layout="row" label="Text size">
        <Slider
          className="w-56"
          value={prefs.textScale}
          min={TEXT_SCALE_RANGE.min}
          max={TEXT_SCALE_RANGE.max}
          step={TEXT_SCALE_RANGE.step}
          formatValue={percent}
          onValueChange={(value) => {
            setPreferences({ textScale: clampTextScale(value) });
          }}
        />
      </FormField>
      <SettingRow
        group={false}
        label="Clock format"
        description={`How times are shown throughout the app.${clock === "auto" ? ` System locale: ${locale}.` : ""}`}
      >
        <RadioGroup
          legend="Clock format"
          hideLegend
          appearance="segmented"
          value={clock}
          options={CLOCK_OPTIONS}
          onValueChange={(next) => {
            set({ clockFormat: next });
          }}
        />
      </SettingRow>
    </SettingsGroup>
  );
}

export function GeneralTab() {
  const { settings, set } = useSettingsFile();
  return (
    <>
      <SettingsGroup
        title="Memory scanner"
        badge={
          <Badge tone="warning" variant="outline">
            EULA grey area
          </Badge>
        }
      >
        <SwitchRow
          label="Enable memory scanner"
          description={
            <>
              Required for live inventory, quantity tracking and mod ranks. Reads Warframe&apos;s process memory with <code>ReadProcessMemory</code>.
              DE has historically tolerated read-only tools, but has not given explicit permission. Enable at your own risk.
            </>
          }
          checked={settings.memoryScannerEnabled === true}
          onCheckedChange={(on) => {
            set({ memoryScannerEnabled: on });
          }}
        />
      </SettingsGroup>

      <SettingsGroup title="Windows">
        <SwitchRow
          label="Modular window in its own window"
          description="Detach the modular window from the main window into a window you can place anywhere."
          checked={settings.modularPopout === true}
          onCheckedChange={(on) => {
            set({ modularPopout: on });
          }}
        />
        <SwitchRow
          label="Changelog in its own window"
          description="Detach the changelog from the bottom of the main window into a window you can place anywhere."
          checked={settings.changelogPopout === true}
          onCheckedChange={(on) => {
            set({ changelogPopout: on });
          }}
        />
      </SettingsGroup>

      <NotificationsGroup />

      <AppearanceGroup />
    </>
  );
}
