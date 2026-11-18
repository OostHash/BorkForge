import { useAppVersion } from "../../api/app";
import { Modal } from "../../primitives/overlay";
import { Tab, TabList, TabPanel, Tabs } from "../../primitives/navigation";
import { ConsoleTab } from "./ConsoleTab";
import { DataTab } from "./DataTab";
import { DebuggingTab } from "./DebuggingTab";
import { FiltersTab } from "./FiltersTab";
import { GeneralTab } from "./GeneralTab";
import { MarketTab } from "./MarketTab";
import { OverlaysTab } from "./OverlaysTab";

/** Every tab (vault settings.md, overlay-settings.md, debugging.md; Console is the activity console). */
export const SETTINGS_TABS = [
  { id: "general", label: "General", Panel: GeneralTab },
  { id: "overlays", label: "Overlays", Panel: OverlaysTab },
  { id: "market", label: "Market", Panel: MarketTab },
  { id: "filters", label: "Filters", Panel: FiltersTab },
  { id: "data", label: "Data", Panel: DataTab },
  { id: "debugging", label: "Debugging", Panel: DebuggingTab },
  { id: "console", label: "Console", Panel: ConsoleTab },
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number]["id"];

type Props = {
  open: boolean;
  tab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  onClose: () => void;
};

/** Settings in a modal: one tab per area, the app version at the bottom. */
export function SettingsDialog({ open, tab, onTabChange, onClose }: Props) {
  const version = useAppVersion();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Settings"
      size="xl"
      // Same height for every tab, so switching tabs never moves the dialog.
      className="h-[85dvh]"
      footer={<p className="me-auto text-xs text-muted">HexDesk {version ? `v${version}` : ""}</p>}
    >
      {open && (
        <Tabs selectedKey={tab} onSelectionChange={onTabChange}>
          {/* Stays visible while a long tab scrolls (the body has py-3). */}
          <TabList label="Settings" className="sticky -top-3 z-(--ff-z-sticky) bg-surface-raised pt-1">
            {SETTINGS_TABS.map((t) => (
              <Tab key={t.id} id={t.id}>
                {t.label}
              </Tab>
            ))}
          </TabList>
          {SETTINGS_TABS.map((t) => (
            <TabPanel key={t.id} id={t.id} className="flex flex-col gap-6">
              <t.Panel />
            </TabPanel>
          ))}
        </Tabs>
      )}
    </Modal>
  );
}
