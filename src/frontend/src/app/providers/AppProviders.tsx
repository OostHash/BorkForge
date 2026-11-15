import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { ToastRegion } from "../../primitives/overlay";
import { startPreferenceSync, usePreferences } from "../../state/preferences";
import { applyTextScale } from "../textScale";
import { createQueryClient } from "./queryClient";
import { TauriEventBridge } from "./TauriEventBridge";

/** Every window's provider stack: server state (TanStack Query) and UI preferences. */
export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  const { textScale } = usePreferences();

  useEffect(() => startPreferenceSync(), []);

  useEffect(() => {
    applyTextScale(textScale).catch((error: unknown) => {
      console.error("text scale: setZoom failed", error);
    });
  }, [textScale]);

  return (
    <QueryClientProvider client={queryClient}>
      <TauriEventBridge />
      {children}
      <ToastRegion />
    </QueryClientProvider>
  );
}
