import { cn } from "../primitives/cn";

type Props = {
  /** 0–1, relative to the largest value in the list. */
  share: number;
  className?: string;
};

/**
 * One row's bar in a ranked list (dataviz: "part-to-whole beside its
 * figures"). One hue, square at the baseline, 4px rounded data end, 8px
 * thick. Decorative: the figure next to it is the value.
 */
export function RankBar({ share, className }: Props) {
  const pct = Math.max(0, Math.min(1, share)) * 100;
  return (
    <span aria-hidden="true" className={cn("block h-2 w-full", className)}>
      {pct > 0 && <span className="block h-full rounded-e-sm bg-accent" style={{ width: `${String(Math.max(pct, 1))}%` }} />}
    </span>
  );
}
