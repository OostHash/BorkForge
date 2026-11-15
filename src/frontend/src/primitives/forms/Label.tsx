import type { ComponentProps } from "react";
import { cn } from "../cn";

type Props = ComponentProps<"label"> & { required?: boolean };

export function Label({ required = false, className, children, ...rest }: Props) {
  return (
    <label className={cn("text-xs font-medium text-muted", className)} {...rest}>
      {children}
      {required && (
        <span aria-hidden="true" className="ms-0.5 text-danger">
          *
        </span>
      )}
    </label>
  );
}
