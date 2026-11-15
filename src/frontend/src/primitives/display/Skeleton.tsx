import { cn } from "../cn";

type Props = {
  /** Number of text lines; the last one is shorter. Ignored when className sets a size. */
  lines?: number;
  className?: string;
};

/** Loading placeholder. Decorative: pair it with a Spinner or aria-busy on the region. */
export function Skeleton({ lines = 1, className }: Props) {
  if (className) {
    return <div aria-hidden="true" className={cn("rounded-md bg-hover motion-safe:animate-pulse", className)} />;
  }
  return (
    <div aria-hidden="true" className="flex flex-col gap-2">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className={cn("h-3 rounded-sm bg-hover motion-safe:animate-pulse", i === lines - 1 && lines > 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}
