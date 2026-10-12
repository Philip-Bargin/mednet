"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Reference: form field anatomy — label (13px semibold), control, description (muted) and
 * error (critical). Description and error text are raised from the reference's 11px to the 13px
 * caption size for legibility (documented deviation).
 */
export type FieldControlProps = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  required?: boolean;
};

export type FieldProps = {
  label: ReactNode;
  description?: ReactNode;
  /** When present the control is marked invalid and the message is announced with it. */
  error?: ReactNode;
  required?: boolean;
  /** Visually hide the label (it stays available to assistive tech). */
  hideLabel?: boolean;
  id?: string;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
};

export function Field({
  label,
  description,
  error,
  required,
  hideLabel,
  id,
  className,
  children,
}: FieldProps) {
  const generated = useId();
  const controlId = id ?? `field-${generated}`;
  const descriptionId = description ? `${controlId}-description` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={controlId}
        className={cn("text-caption font-semibold text-ink", hideLabel && "sr-only")}
      >
        {label}
        {required ? (
          <span className="text-critical" aria-hidden>
            {" "}*
          </span>
        ) : null}
      </label>
      {children({
        id: controlId,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
        required,
      })}
      {description ? (
        <p id={descriptionId} className="text-caption text-text-muted">
          {description}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-caption font-semibold text-critical">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Shared control styling: 45px, 12px inline padding, control-border, 8px radius, critical ring when invalid. */
export const controlClasses =
  "w-full min-h-11 rounded-sm border border-control-border bg-surface px-3 py-2.5 text-body text-ink placeholder:text-text-muted hover:border-ink-faint focus-visible:border-action disabled:cursor-not-allowed disabled:bg-surface-soft disabled:text-text-muted aria-invalid:border-critical aria-invalid:ring-1 aria-invalid:ring-critical";
