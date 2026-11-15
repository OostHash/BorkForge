import { ArrowLeft } from "lucide-react";
import type { ComponentType } from "react";
import { Icon } from "../primitives/display";

/** Dev-only pages, reachable as ?view=<name> on mock.html and (in dev) index.html. */
const DEV_VIEWS: Record<string, () => Promise<ComponentType>> = {
  "kitchen-sink": () => import("./kitchen-sink/KitchenSink").then((m) => m.KitchenSink),
  tokens: () => import("./kitchen-sink/TokensPage").then((m) => m.TokensPage),
};

/** The current URL without ?view=, so a Tauri window (no browser back button) can return. */
function backHref(): string {
  const params = new URLSearchParams(window.location.search);
  params.delete("view");
  const query = params.toString();
  return `${window.location.pathname}${query ? `?${query}` : ""}`;
}

function withBackLink(Page: ComponentType): ComponentType {
  return function DevPage() {
    // The window never scrolls (theme/index.css); dev pages get their own panel.
    return (
      <div className="h-full overflow-y-auto">
        <nav aria-label="Developer navigation" className="px-6 pt-4">
          <a href={backHref()} className="inline-flex items-center gap-1 text-sm text-accent underline">
            <Icon icon={ArrowLeft} size="xs" />
            Back
          </a>
        </nav>
        <Page />
      </div>
    );
  };
}

export function loadDevView(name: string): Promise<ComponentType> | null {
  const load = Object.hasOwn(DEV_VIEWS, name) ? DEV_VIEWS[name] : undefined;
  return load ? load().then(withBackLink) : null;
}
