import { createContext, useContext, useId, type ReactNode } from "react";
import { cn } from "../cn";
import { Label } from "./Label";

type FieldContext = {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
  required: boolean;
};

const Context = createContext<FieldContext | null>(null);

/**
 * Props a control inside a FormField spreads onto its native element: id,
 * aria-describedby, aria-invalid, required. Outside a FormField it passes the
 * control's own values through.
 */
export function useFieldControl(own: { id?: string | undefined; invalid?: boolean | undefined; required?: boolean | undefined }) {
  const field = useContext(Context);
  // Every field gets an id, also outside a FormField: browsers want an id or
  // name on each form field (DevTools "form field should have an id or name").
  const fallbackId = useId();
  const invalid = own.invalid ?? field?.invalid ?? false;
  return {
    id: own.id ?? field?.id ?? fallbackId,
    "aria-describedby": field?.describedBy,
    "aria-invalid": invalid || undefined,
    required: own.required ?? field?.required,
  };
}

type Props = {
  label: ReactNode;
  description?: ReactNode;
  /** Error text. Also marks the control aria-invalid. */
  error?: ReactNode;
  required?: boolean;
  /** "row": label and description on the left, the control on the right (settings rows). */
  layout?: "stack" | "row";
  className?: string;
  children: ReactNode;
};

/** Label + control + description + error, wired with generated ids. */
export function FormField({ label, description, error, required = false, layout = "stack", className, children }: Props) {
  const id = useId();
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  const field = <Context value={{ id, describedBy, invalid: Boolean(error), required }}>{children}</Context>;

  if (layout === "row") {
    return (
      <div className={cn("flex flex-wrap items-center justify-between gap-x-6 gap-y-2", className)}>
        <div className="flex min-w-56 flex-1 flex-col gap-0.5">
          <Label htmlFor={id} required={required} className="text-sm text-text">
            {label}
          </Label>
          {description && (
            <p id={descriptionId} className="text-xs text-muted">
              {description}
            </p>
          )}
          {error && (
            <p id={errorId} className="text-xs text-danger">
              {error}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">{field}</div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      {field}
      {description && (
        <p id={descriptionId} className="text-xs text-muted">
          {description}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
