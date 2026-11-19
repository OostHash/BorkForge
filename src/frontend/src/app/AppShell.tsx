import { useCallback, useState, type ComponentType } from "react";
import { FoundryScreen } from "../screens/foundry/FoundryScreen";
import { ItemWindowHost } from "../screens/market/ItemWindow";
import { MarketScreen } from "../screens/market/MarketScreen";
import { RivensScreen } from "../screens/rivens/RivensScreen";
import { SettingsDialog, type SettingsTab } from "../screens/settings/SettingsDialog";
import { InventoryScreen } from "../screens/inventory/InventoryScreen";
import { RelicsScreen } from "../screens/relics/RelicsScreen";
import { TimersScreen } from "../screens/timers/TimersScreen";
import { AppLifecycle } from "./AppLifecycle";
import { ChangeLogDock } from "./ChangeLogDock";
import { FissureAlerts } from "./FissureAlerts";
import { Header } from "./Header";
import { MainNav, type NavScreen } from "./MainNav";
import { ModularDock } from "./ModularDock";
import { NAV_ICONS } from "./navIcons";
import { RelicOverlayController } from "./RelicOverlayController";
import { RivenOverlayController } from "./RivenOverlayController";
import { ScreenBoundary } from "./ScreenBoundary";
import { TradeWatcher } from "./TradeWatcher";
import { WindowTitleBar } from "./WindowTitleBar";

type ScreenDef = NavScreen & { Screen: ComponentType };

/** The screens of the main window, in sidebar order. */
const SCREENS: readonly ScreenDef[] = [
  { id: "inventory", label: "Inventory", icon: NAV_ICONS.inventory, Screen: InventoryScreen },
  { id: "foundry", label: "Foundry", icon: NAV_ICONS.foundry, Screen: FoundryScreen },
  { id: "relics", label: "Relics", icon: NAV_ICONS.relics, Screen: RelicsScreen },
  { id: "rivens", label: "Rivens", icon: NAV_ICONS.rivens, Screen: RivensScreen },
  { id: "timers", label: "Timers", icon: NAV_ICONS.timers, Screen: TimersScreen },
  { id: "market", label: "Market", icon: NAV_ICONS.market, Screen: MarketScreen },
];

/** Main window: navigation on the left, the active screen on the right. */
export function AppShell() {
  const [screen, setScreen] = useState("inventory");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("general");
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
        <MainNav
          screens={SCREENS}
          current={screen}
          onSelect={setScreen}
          settingsOpen={settingsOpen}
          onOpenSettings={() => {
            setSettingsOpen(true);
          }}
        />
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
    </div>
  );
}
