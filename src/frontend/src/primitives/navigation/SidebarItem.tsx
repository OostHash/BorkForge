import type { LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../cn";
import { Icon } from "../display/Icon";

type Props = Omit<ComponentProps<"button">, "children"> & {
  active: boolean;
  label: ReactNode;
  icon?: LucideIcon;
  /** Small count shown at the end, e.g. items in a category. */
  count?: number;
  /** Free slot after the label, e.g. a Badge. */
  badge?: ReactNode;
};

/**
 * Category/navigation entry for a sidebar list. Put it in <nav><ul><li>.
 * The active entry gets aria-current="page".
 */
export function SidebarItem({ active, label, icon, count, badge, className, type = "button", ...rest }: Props) {
  return (
    <button
      type={type}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-control-md w-full items-center gap-2 rounded-md border-s-2 px-3 text-start text-sm transition-colors motion-reduce:transition-none",
        active ? "border-accent bg-accent-soft text-text" : "border-transparent text-muted hover:bg-hover hover:text-text",
        className,
      )}
      {...rest}
    >
      {icon && <Icon icon={icon} size="sm" />}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge}
      {count !== undefined && <span className="text-xs text-muted tabular-nums">{count}</span>}
    </button>
  );
}
