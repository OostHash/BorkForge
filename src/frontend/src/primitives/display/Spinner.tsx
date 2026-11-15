import { LoaderCircle } from "lucide-react";
import { cn } from "../cn";
import { Icon, type IconSize } from "./Icon";
import { strings } from "../strings";

type Props = {
  size?: IconSize;
  /** Announced to screen readers. */
  label?: string;
  className?: string;
};

/** Busy indicator. Stops spinning under prefers-reduced-motion. */
export function Spinner({ size = "sm", label = strings.loading, className }: Props) {
  return (
    <span role="status" className={cn("inline-flex text-muted", className)}>
      <Icon icon={LoaderCircle} size={size} className="motion-safe:animate-spin" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
