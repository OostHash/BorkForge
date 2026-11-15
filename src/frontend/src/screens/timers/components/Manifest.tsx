import { Badge, domainTone } from "../../../primitives/display";
import type { WsManifestItem } from "../../../domain/worldstate.types";

type Props = {
  label: string;
  items: readonly WsManifestItem[];
  quantities: Readonly<Record<string, number>>;
  /** Which prices to show: Baro (ducats + credits) or Prime Resurgence (aya). */
  currency: "baro" | "aya";
};

const owned = (item: WsManifestItem, quantities: Readonly<Record<string, number>>) =>
  item.uniqueName !== undefined && (quantities[item.uniqueName] ?? 0) > 0;

/** Trader inventory with prices and an "Owned" badge for items you already have. */
export function Manifest({ label, items, quantities, currency }: Props) {
  return (
    <ul aria-label={label} className="flex max-h-64 flex-col overflow-y-auto">
      {items.map((item) => (
        <li key={item.uniqueName ?? item.name} className="flex items-center gap-2 border-b border-border/60 py-1 text-sm last:border-b-0">
          <span className="min-w-0 flex-1 truncate">{item.name}</span>
          {owned(item, quantities) && <Badge tone="success">Owned</Badge>}
          {currency === "baro" ? (
            <>
              {item.primePrice !== undefined && (
                <span className="text-tone tabular-nums" style={domainTone("ducat")}>
                  {item.primePrice} <span className="text-xs">Ducats</span>
                </span>
              )}
              {item.regularPrice !== undefined && (
                <span className="text-muted tabular-nums">
                  {item.regularPrice.toLocaleString("en-US")} <span className="text-xs">cr</span>
                </span>
              )}
            </>
          ) : (
            <>
              {item.regalAyaPrice !== undefined && (
                <Badge tone="domain" style={domainTone("state-void")}>
                  {item.regalAyaPrice} Regal Aya
                </Badge>
              )}
              {item.ayaPrice !== undefined && (
                <Badge tone="domain" style={domainTone("ducat")}>
                  {item.ayaPrice} Aya
                </Badge>
              )}
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
