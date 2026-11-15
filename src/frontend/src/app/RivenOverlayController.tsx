import { useEffect, useRef } from "react";
import { isTauri } from "../api/env";
import { emitWith, onEvent } from "../api/events";
import { checkRivenOnScreen, closeRivenWindow, gameRect, logRivenError, monitorScaleAt, overlayPrefsFrom, placeRivenWindow } from "../api/overlays";
import { useSettings } from "../api/settings";
import { PREVIEW_VIEW, resultFromError, resultFromOcr, RETRIGGER_MS, rivenPlacement, type RivenView } from "../domain/rivenOverlay";
import { getPreferences } from "../state/preferences";

/**
 * Main window: runs the riven check (OCR, then analysis) and owns the riven
 * overlay window (vault overlay-riven.md). It keeps the latest view, so a
 * window that just opened asks for it (riven-window-ready) instead of
 * racing the result.
 */
export function RivenOverlayController() {
  const { data: settings } = useSettings();
  const prefs = useRef(overlayPrefsFrom(settings));
  useEffect(() => {
    prefs.current = overlayPrefsFrom(settings);
  });

  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    const unlisteners: Array<() => void> = [];
    const keep = (p: Promise<() => void>) => {
      void p.then((fn) => {
        if (disposed) fn();
        else unlisteners.push(fn);
      });
    };
    let latest: RivenView | null = null;
    let run = 0;
    let rollCount = 0;
    let lastTrigger = 0;

    const send = (view: RivenView) => {
      latest = view;
      void emitWith("riven-view", view);
    };
    const place = async (visible: boolean) => {
      const rect = await gameRect();
      const scale = await monitorScaleAt(rect[0], rect[1]);
      const { rivenX, rivenY } = prefs.current.offsets;
      await placeRivenWindow(rivenPlacement(rect, scale, getPreferences().textScale, { x: rivenX, y: rivenY }), visible);
    };
    const close = () => {
      run += 1;
      latest = null;
      void closeRivenWindow();
    };
    const check = async () => {
      const mine = ++run;
      rollCount += 1;
      lastTrigger = Date.now();
      await place(true).catch(() => undefined);
      if (mine !== run) return;
      send({ kind: "scanning", rollCount });
      try {
        const { ocr, analysis } = await checkRivenOnScreen();
        if (mine === run) send(resultFromOcr(ocr, analysis, rollCount));
      } catch (error) {
        void logRivenError(String(error));
        if (mine === run) send(resultFromError(error, rollCount));
      }
    };

    keep(
      onEvent("riven-screen-open", () => {
        const p = prefs.current;
        if (!p.overlaysEnabled || !p.rivenEnabled) return;
        if (Date.now() - lastTrigger < RETRIGGER_MS) return;
        void check();
      }),
    );
    keep(onEvent("riven-manual-check", () => void check()));
    keep(onEvent("riven-screen-close", close));
    keep(
      onEvent("riven-overlay-hide", ({ reason }) => {
        if (reason) void logRivenError(`[HIDE] ${reason}`);
        close();
      }),
    );
    keep(onEvent("overlays-disabled", close));
    keep(
      onEvent("riven-window-ready", () => {
        if (latest) void emitWith("riven-view", latest);
      }),
    );
    keep(
      onEvent("riven-preview", () => {
        // A live check is shown: the preview waits.
        if (latest && !(latest.kind === "result" && latest.preview)) return;
        void place(true)
          .then(() => {
            send(PREVIEW_VIEW);
          })
          .catch(() => undefined);
      }),
    );
    keep(
      onEvent("riven-preview-close", () => {
        if (latest?.kind === "result" && latest.preview) close();
      }),
    );
    return () => {
      disposed = true;
      for (const fn of unlisteners) fn();
    };
  }, []);

  return null;
}
