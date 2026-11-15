import { cva } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../cn";
import { Icon } from "./Icon";
import type { Tone } from "./tone";

// Soft and outline badges sit on a tint of their own colour, which costs
// contrast; their ink is mixed towards the text colour (lighter on dark,
// darker on light) so every tone stays at WCAG AA. How far is per theme
// (--ff-tone-ink): domain colours are tuned for dark pages.
const badgeVariants = cva(
  "inline-flex shrink-0 items-center gap-1 rounded-sm font-medium whitespace-nowrap " +
    "[--badge-ink:color-mix(in_oklab,var(--badge)_var(--ff-tone-ink),var(--ff-text))]",
  {
    variants: {
      tone: {
        neutral: "[--badge:var(--ff-text-muted)]",
        accent: "[--badge:var(--ff-accent)]",
        info: "[--badge:var(--ff-info)]",
        success: "[--badge:var(--ff-success)]",
        warning: "[--badge:var(--ff-warning)]",
        danger: "[--badge:var(--ff-danger)]",
        domain: "[--badge:var(--ff-tone,var(--ff-text-muted))]",
      },
      variant: {
        soft: "bg-(--badge)/15 text-(--badge-ink)",
        outline: "border border-(--badge)/40 text-(--badge-ink)",
        solid: "bg-(--badge) text-bg",
      },
      size: {
        sm: "px-1.5 py-px text-xs",
        md: "px-2 py-0.5 text-sm",
      },
    },
    defaultVariants: { tone: "neutral", variant: "soft", size: "sm" },
  },
);

type Props = Omit<ComponentProps<"span">, "children"> & {
  tone?: Tone;
  variant?: "soft" | "outline" | "solid";
  size?: "sm" | "md";
  icon?: LucideIcon;
  /** Always text: status is never conveyed by colour alone (WCAG 1.4.1). */
  children: ReactNode;
};

export function Badge({ tone, variant, size, icon, className, children, ...rest }: Props) {
  return (
    <span className={cn(badgeVariants({ tone, variant, size }), className)} {...rest}>
      {icon && <Icon icon={icon} size="xs" />}
      {children}
    </span>
  );
}
