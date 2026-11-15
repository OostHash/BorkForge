import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppProviders } from "./app/providers/AppProviders";
import { WindowRoot } from "./app/WindowRoot";
import { resolveWindowKind } from "./app/windowKind";
import "./theme/index.css";

const container = document.getElementById("root");
if (!container) throw new Error("#root missing from index.html");

const kind = resolveWindowKind();
// Overlay windows keep a transparent background (theme/index.css).
document.documentElement.dataset.window = kind;

// Dev-only pages (tokens, kitchen sink) in a real Tauri window: ?view=...
// import.meta.env.DEV is false in builds, so Vite drops this branch entirely.
const devView = import.meta.env.DEV ? new URLSearchParams(window.location.search).get("view") : null;
const DevView = devView ? await import("./dev/devViews").then((m) => m.loadDevView(devView)) : null;

createRoot(container).render(
  <StrictMode>
    <AppProviders>{DevView ? <DevView /> : <WindowRoot kind={kind} />}</AppProviders>
  </StrictMode>,
);
