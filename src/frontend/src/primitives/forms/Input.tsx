import type { ComponentProps } from "react";
import { cn } from "../cn";
import { fieldVariants, type FieldSize } from "./fieldStyles";
import { useFieldControl } from "./FormField";

type Props = Omit<ComponentProps<"input">, "size"> & {
  size?: FieldSize;
  invalid?: boolean;
};

/** Native <input>. Inside a FormField it picks up id, description and error wiring. */
export function Input({ size, invalid, id, required, className, ...rest }: Props) {
  const field = useFieldControl({ id, invalid, required });
  return <input className={cn(fieldVariants({ size }), "border-border", className)} {...field} {...rest} />;
}
