import { Badge, domainTone } from "../primitives/display";

/** Whole numbers with thousands separators, as on warframe.market. */
export const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

/** Platinum as text ("12p"), never an icon alone. */
export function PlatBadge({ value, suffix }: { value: number; suffix?: string }) {
  return (
    <Badge tone="domain" style={domainTone("price-platinum")} title={`${fmt(value)} platinum${suffix ? ` ${suffix}` : ""}`}>
      {fmt(value)}p{suffix ? ` ${suffix}` : ""}
    </Badge>
  );
}

export function DucatBadge({ value }: { value: number }) {
  return (
    <Badge tone="domain" style={domainTone("ducat")}>
      {fmt(value)} ducats
    </Badge>
  );
}
