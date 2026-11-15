import { useEffect, useState, useSyncExternalStore } from "react";
import { isTauri } from "../api/env";
import { closeModularPopout, openModularPopout, useModularPrefs } from "../api/modular";
import { useSettings } from "../api/settings";
import { clampModularWidth, MODULAR_WIDTH } from "../domain/modular";
import { ResizeHandle } from "../primitives/behavior/ResizeHandle";
import { toast } from "../primitives/overlay";
import { ModularWindow } from "../screens/modular/ModularWindow";

function subscribeResize(listener: () => void) {
  window.addEventListener("resize", listener);
  return () => {
    window.removeEventListener("resize", listener);
  };
}
const useWindowWidth = () => useSyncExternalStore(subscribeResize, () => window.innerWidth);

/**
 * The modular window docked on the right of the main window, or — with
 * modularPopout — in its own window, which this component opens and closes
 * (current app: useModularWindow).
 */
export function ModularDock() {
  const { prefs, loaded, setWidth, setPopout } = useModularPrefs();
  const { data: settings } = useSettings();
  const windowWidth = useWindowWidth();
  // Live width while dragging; saved once on release.
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const width = clampModularWidth(dragWidth ?? prefs.width, windowWidth);

  const popout = prefs.popout;
  useEffect(() => {
    if (!loaded || !isTauri()) return;
    if (!popout) {
      void closeModularPopout().catch(() => undefined);
      return;
    }
    openModularPopout(settings, width, () => {
      // The user closed the window: dock the panel again.
      setPopout(false);
    }).catch((error: unknown) => {
      setPopout(false);
      toast({ title: "Could not open the modular window", description: String(error), tone: "danger" });
    });
    // Only the switch opens or closes the window; width and settings are read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popout, loaded]);

  if (popout) return null;
  return (
    <div className="relative flex shrink-0 border-s border-border" style={{ width }}>
      <ResizeHandle
        label="Modular window width"
        axis="x"
        direction={-1}
        value={width}
        min={MODULAR_WIDTH.min}
        max={clampModularWidth(MODULAR_WIDTH.max, windowWidth)}
        onValueChange={setDragWidth}
        onValueCommit={(value) => {
          setDragWidth(null);
          setWidth(value);
        }}
        className="absolute inset-y-0 start-0 z-(--ff-z-sticky) w-1.5"
      />
      <ModularWindow
        className="flex-1"
        onPopout={() => {
          setPopout(true);
        }}
      />
    </div>
  );
}
