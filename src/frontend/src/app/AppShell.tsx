import { Backpack, Bug, Clock, Gem, Hammer, Settings, Sparkles, Store, type LucideIcon } from "lucide-react";
import { useCallback, useState, type ComponentType } from "react";
import { openExternal } from "../api/links";
import { SidebarItem } from "../primitives/navigation";
import { FoundryScreen } from "../screens/foundry/FoundryScreen";
import { ItemWindowHost } from "../screens/market/ItemWindow";
import { MarketScreen } from "../screens/market/MarketScreen";
import { RivensScreen } from "../screens/rivens/RivensScreen";
import { BatchPreviewDialog } from "../screens/inventory/BatchPreviewDialog";
import { SettingsDialog, type SettingsTab } from "../screens/settings/SettingsDialog";
import { setBatchPreviewOpen, useBatchPreviewOpen } from "../state/batchPreview";
import { InventoryScreen } from "../screens/inventory/InventoryScreen";
import { RelicsScreen } from "../screens/relics/RelicsScreen";
import { TimersScreen } from "../screens/timers/TimersScreen";
import { AppLifecycle } from "./AppLifecycle";
import { BorkForgeMark } from "./BorkForgeMark";
import { ChangeLogDock } from "./ChangeLogDock";
import { FissureAlerts } from "./FissureAlerts";
import { Header } from "./Header";
import { ModularDock } from "./ModularDock";
import { RelicOverlayController } from "./RelicOverlayController";
import { RivenOverlayController } from "./RivenOverlayController";
import { ScreenBoundary } from "./ScreenBoundary";
import { TradeWatcher } from "./TradeWatcher";
import { WindowTitleBar } from "./WindowTitleBar";

type ScreenDef = { id: string; label: string; icon: LucideIcon; Screen: ComponentType };

/** Ported screens. Grows as screens move over (vault plan, port ledger). */
const SCREENS: readonly ScreenDef[] = [
  { id: "inventory", label: "Inventory", icon: Backpack, Screen: InventoryScreen },
  { id: "foundry", label: "Foundry", icon: Hammer, Screen: FoundryScreen },
  { id: "relics", label: "Relics", icon: Gem, Screen: RelicsScreen },
  { id: "rivens", label: "Rivens", icon: Sparkles, Screen: RivensScreen },
  { id: "timers", label: "Timers", icon: Clock, Screen: TimersScreen },
  { id: "market", label: "Market", icon: Store, Screen: MarketScreen },
];

const BUG_REPORT_URL = "https://github.com/OostHash/BorkForge/issues/new/choose";
const NARROW_NAV_ITEM = "justify-center px-0 md:justify-start md:px-3 [&>span]:hidden md:[&>span]:inline";

/** Main window: navigation on the left, the active screen on the right. */
export function AppShell() {
  const [screen, setScreen] = useState("inventory");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("general");
  const batchPreviewOpen = useBatchPreviewOpen();
  const current = SCREENS.find((s) => s.id === screen) ?? SCREENS[0];
  // Stable: the changelog dock listens for the pop-out's requests with it.
  const openInventory = useCallback(() => {
    setScreen("inventory");
  }, []);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <AppLifecycle />
      <FissureAlerts />
      <TradeWatcher />
      <RelicOverlayController />
      <RivenOverlayController />
      <WindowTitleBar />
      <div className="flex min-h-0 flex-1">
        <nav aria-label="Main" className="flex w-14 shrink-0 flex-col gap-4 border-e border-border bg-surface p-2 md:w-52">
          <div className="flex items-center justify-center gap-2 pt-1 text-sm font-semibold md:justify-start md:px-2">
            <BorkForgeMark className="size-5 text-accent" />
            <span className="hidden md:inline">BorkForge</span>
          </div>
          <ul className="flex flex-col gap-0.5">
            {SCREENS.map((s) => (
              <li key={s.id}>
                <SidebarItem
                  active={screen === s.id}
                  label={s.label}
                  icon={s.icon}
                  aria-label={s.label}
                  title={s.label}
                  className={NARROW_NAV_ITEM}
                  onClick={() => {
                    setScreen(s.id);
                  }}
                />
              </li>
            ))}
          </ul>
          <ul aria-label="Support and settings" className="mt-auto flex flex-col gap-0.5 border-t border-border pt-2">
            <li>
              <SidebarItem
                active={false}
                label="Report a bug"
                icon={Bug}
                aria-label="Report a bug"
                title="Report a bug"
                className={NARROW_NAV_ITEM}
                onClick={() => {
                  void openExternal(BUG_REPORT_URL).catch(() => undefined);
                }}
              />
            </li>
            <li>
              <SidebarItem
                active={settingsOpen}
                label="Settings"
                icon={Settings}
                aria-label="Settings"
                title="Settings"
                className={NARROW_NAV_ITEM}
                onClick={() => {
                  setSettingsOpen(true);
                }}
              />
            </li>
          </ul>
        </nav>
        <div className="flex min-w-0 flex-1 flex-col">
          <Header
            onOpenScreen={setScreen}
            onOpenSettings={() => {
              setSettingsOpen(true);
            }}
          />
          <div className="flex min-h-0 flex-1">
            <div className="flex min-w-0 flex-1 flex-col">
              <main className="flex min-h-0 flex-1 flex-col">
                <h1 className="sr-only">{current?.label}</h1>
                {current && (
                  <ScreenBoundary key={current.id} label={current.label}>
                    <current.Screen />
                  </ScreenBoundary>
                )}
              </main>
              <ChangeLogDock onOpenInventory={openInventory} />
            </div>
            <ModularDock />
          </div>
        </div>
      </div>
      {/* Outside the screens: React Aria renders Tabs children in a detached collection pass, where showModal() fails. */}
      <ItemWindowHost />
      <SettingsDialog
        open={settingsOpen}
        tab={settingsTab}
        onTabChange={setSettingsTab}
        onClose={() => {
          setSettingsOpen(false);
        }}
      />
      {/* Opened from Settings → Debugging; on top of Settings. */}
      <BatchPreviewDialog
        open={batchPreviewOpen}
        onClose={() => {
          setBatchPreviewOpen(false);
        }}
      />
    </div>
  );
}
