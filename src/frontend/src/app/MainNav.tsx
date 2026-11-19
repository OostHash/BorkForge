import { Bug, PanelLeftClose, PanelLeftOpen, Settings, type LucideIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { openExternal } from "../api/links";
import { cn } from "../primitives/cn";
import { Icon } from "../primitives/display";
import { SidebarItem } from "../primitives/navigation";
import { Tooltip, type TooltipTriggerProps } from "../primitives/overlay";
import { HexDeskMark } from "./HexDeskMark";
import { useNavCollapsed } from "./navCollapsed";

export type NavScreen = { id: string; label: string; icon: LucideIcon };

const BUG_REPORT_URL = "https://github.com/OostHash/HexDesk/issues/new/choose";

// Narrow windows always get icons only; the collapse toggle decides for wider ones.
const ICON_ONLY_ITEM = "justify-center px-0 [&>span]:hidden";
const RESPONSIVE_ITEM = "justify-center px-0 md:justify-start md:px-3 [&>span]:hidden md:[&>span]:inline";

/** The label is already the accessible name; aria-describedby would only repeat it. */
function withoutDescription({ style, onPointerEnter, onPointerLeave, onFocus, onBlur }: TooltipTriggerProps) {
  return { style, onPointerEnter, onPointerLeave, onFocus, onBlur };
}

type ItemProps = Omit<ComponentProps<typeof SidebarItem>, "label" | "icon" | "aria-label" | "className"> & {
  label: string;
  icon: LucideIcon;
  collapsed: boolean;
};

/** A navigation entry that names itself in a tooltip whenever its label is hidden. */
function NavItem({ label, icon, collapsed, ...rest }: ItemProps) {
  return (
    <Tooltip content={label} placement="right" delay={150} className={collapsed ? "" : "md:hidden"}>
      {(trigger) => (
        <SidebarItem
          {...rest}
          {...withoutDescription(trigger)}
          label={label}
          icon={icon}
          iconSize="lg"
          aria-label={label}
          className={collapsed ? ICON_ONLY_ITEM : RESPONSIVE_ITEM}
        />
      )}
    </Tooltip>
  );
}

type Props = {
  screens: readonly NavScreen[];
  current: string;
  onSelect: (id: string) => void;
  settingsOpen: boolean;
  onOpenSettings: () => void;
};

/** The main window's sidebar: screens, then support and settings at the bottom. */
export function MainNav({ screens, current, onSelect, settingsOpen, onOpenSettings }: Props) {
  const [collapsed, setCollapsed] = useNavCollapsed();
  const toggleLabel = collapsed ? "Expand navigation" : "Collapse navigation";
  return (
    <nav
      aria-label="Main"
      data-collapsed={collapsed || undefined}
      className={cn("flex w-14 shrink-0 flex-col gap-4 border-e border-border bg-surface p-2", !collapsed && "md:w-52")}
    >
      <div className={cn("flex items-center justify-center gap-2 pt-1 text-sm font-semibold", !collapsed && "md:justify-start md:px-2")}>
        <HexDeskMark className="size-5 text-accent" />
        <span className={cn("hidden", !collapsed && "md:inline")}>HexDesk</span>
      </div>
      <ul className="flex flex-col gap-0.5">
        {screens.map((s) => (
          <li key={s.id}>
            <NavItem
              active={current === s.id}
              label={s.label}
              icon={s.icon}
              collapsed={collapsed}
              onClick={() => {
                onSelect(s.id);
              }}
            />
          </li>
        ))}
      </ul>
      {/* The empty space between the lists is the toggle. Narrow windows are always collapsed, so it is hidden there. */}
      <Tooltip content={toggleLabel} placement="right" delay={150}>
        {(trigger) => (
          <button
            type="button"
            aria-label={toggleLabel}
            className="group hidden min-h-control-md flex-1 items-end justify-center rounded-md pb-1 text-muted hover:bg-hover hover:text-text md:flex"
            onClick={() => {
              setCollapsed(!collapsed);
            }}
            {...withoutDescription(trigger)}
          >
            <Icon icon={collapsed ? PanelLeftOpen : PanelLeftClose} className="opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" />
          </button>
        )}
      </Tooltip>
      <ul aria-label="Support and settings" className="mt-auto flex flex-col gap-0.5 border-t border-border pt-2">
        <li>
          <NavItem
            active={false}
            label="Report a bug"
            icon={Bug}
            collapsed={collapsed}
            onClick={() => {
              void openExternal(BUG_REPORT_URL).catch(() => undefined);
            }}
          />
        </li>
        <li>
          <NavItem active={settingsOpen} label="Settings" icon={Settings} collapsed={collapsed} onClick={onOpenSettings} />
        </li>
      </ul>
    </nav>
  );
}
