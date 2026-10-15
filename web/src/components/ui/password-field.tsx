"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { Field, controlClasses, type FieldProps } from "./field";

/**
 * Password input with a show/hide toggle (replaces the legacy `PasswordInput`). The toggle is a
 * 44px button inside the control, named "Show password"/"Hide password" with aria-pressed.
 */
export function PasswordField({
  label,
  description,
  error,
  required,
  id,
  fieldClassName,
  className,
  ...input
}: Pick<FieldProps, "label" | "description" | "error" | "required" | "id"> &
  Omit<ComponentProps<"input">, "id" | "type" | "required"> & { fieldClassName?: string }) {
  const [visible, setVisible] = useState(false);
  const actionLabel = visible ? "Hide password" : "Show password";
  return (
    <Field label={label} description={description} error={error} required={required} id={id} className={fieldClassName}>
      {(control) => (
        <div className="relative">
          <input
            {...input}
            {...control}
            type={visible ? "text" : "password"}
            className={cn(controlClasses, "pr-12", className)}
          />
          <button
            type="button"
            aria-label={actionLabel}
            aria-pressed={visible}
            aria-controls={control.id}
            onClick={() => setVisible((value) => !value)}
            className="absolute top-1/2 right-0.5 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-sm text-text-secondary hover:text-ink focus-visible:outline-offset-[-3px]"
          >
            {visible ? (
              <EyeOff aria-hidden size={20} strokeWidth={1.8} />
            ) : (
              <Eye aria-hidden size={20} strokeWidth={1.8} />
            )}
          </button>
        </div>
      )}
    </Field>
  );
}
