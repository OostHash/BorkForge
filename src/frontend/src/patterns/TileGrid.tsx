import type { ReactNode } from "react";
import { cn } from "../primitives/cn";

const MIN = { sm: "grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]", md: "grid-cols-[repeat(auto-fill,minmax(13rem,1fr))]" } as const;

type Props = {
  /** Minimum tile width before the grid wraps. */
  min?: keyof typeof MIN;
  className?: string;
  children: ReactNode;
};

/** Responsive grid of tiles; a list for assistive tech. */
export function TileGrid({ min = "md", className, children }: Props) {
  return <ul className={cn("grid gap-3", MIN[min], className)}>{children}</ul>;
}
