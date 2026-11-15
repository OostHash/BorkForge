import { useEffect } from "react";
import { isTauri } from "../../api/env";
import { savePopoutGeometry } from "../../api/modular";
import { onWindowMovedOrResized } from "../../api/app";
import { ModularWindow } from "./ModularWindow";

const GEOMETRY_DEBOUNCE_MS = 400;

/** The modular window in its own window; remembers where you put it. */
export function ModularPopoutPage() {
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    let pending: number | undefined;
    void onWindowMovedOrResized(() => {
      window.clearTimeout(pending);
      pending = window.setTimeout(() => {
        void savePopoutGeometry().catch(() => undefined);
      }, GEOMETRY_DEBOUNCE_MS);
    }).then((fn) => {
      if (disposed) fn();
      else unlisten = fn;
    });
    return () => {
      disposed = true;
      window.clearTimeout(pending);
      unlisten?.();
    };
  }, []);

  return (
    <main className="flex h-full min-h-0">
      <h1 className="sr-only">Modular window</h1>
      <ModularWindow className="flex-1" />
    </main>
  );
}
