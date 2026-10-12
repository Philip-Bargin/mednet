"use client";

import { ChevronDown, Search } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Field, controlClasses, type FieldProps } from "./field";

type FieldPassThrough = Pick<FieldProps, "label" | "description" | "error" | "required" | "hideLabel" | "id">;

function splitField<T extends FieldPassThrough>(props: T) {
  const { label, description, error, required, hideLabel, id, ...rest } = props;
  return { field: { label, description, error, required, hideLabel, id }, rest };
}

/**
 * Reference: Input/Text/Default and Input/Text/Error. Value text is 16px rather than the
 * reference's 13px so phones do not zoom on focus and the 16/24 body size is kept (deviation).
 */
export function TextInput(
  props: FieldPassThrough & Omit<ComponentProps<"input">, "id" | "required"> & { fieldClassName?: string },
) {
  const { field, rest } = splitField(props);
  const { className, fieldClassName, ...input } = rest;
  return (
    <Field {...field} className={fieldClassName}>
      {(control) => <input type="text" {...input} {...control} className={cn(controlClasses, className)} />}
    </Field>
  );
}

/** Reference: Textarea/Default (80px minimum). */
export function TextArea(
  props: FieldPassThrough & Omit<ComponentProps<"textarea">, "id" | "required"> & { fieldClassName?: string },
) {
  const { field, rest } = splitField(props);
  const { className, fieldClassName, rows = 3, ...textarea } = rest;
  return (
    <Field {...field} className={fieldClassName}>
      {(control) => (
        <textarea rows={rows} {...textarea} {...control} className={cn(controlClasses, "min-h-20 resize-y", className)} />
      )}
    </Field>
  );
}

export type SelectOption = { value: string; label: string; disabled?: boolean };

/** Reference: Select/Default. Native select for platform keyboard and screen-reader behaviour. */
export function SelectField(
  props: FieldPassThrough &
    Omit<ComponentProps<"select">, "id" | "required" | "children"> & {
      options: SelectOption[];
      placeholder?: string;
      fieldClassName?: string;
    },
) {
  const { field, rest } = splitField(props);
  const { className, fieldClassName, options, placeholder, ...select } = rest;
  return (
    <Field {...field} className={fieldClassName}>
      {(control) => (
        <div className="relative">
          <select
            {...select}
            {...control}
            className={cn(controlClasses, "appearance-none pr-10", className)}
          >
            {placeholder ? (
              <option value="" disabled>
                {placeholder}
              </option>
            ) : null}
            {options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden
            size={18}
            strokeWidth={1.8}
            className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-text-secondary"
          />
        </div>
      )}
    </Field>
  );
}

/**
 * Reference: Input/Search/Default ("Search task or reference"). The label defaults to visually
 * hidden because the search icon and placeholder carry the visual meaning.
 */
export function SearchInput(
  props: Partial<FieldPassThrough> & Omit<ComponentProps<"input">, "id" | "required" | "type"> & { fieldClassName?: string },
) {
  const { label = "Search", hideLabel = true, ...others } = props;
  const { field, rest } = splitField({ ...others, label, hideLabel });
  const { className, fieldClassName, ...input } = rest;
  return (
    <Field {...field} className={fieldClassName}>
      {(control) => (
        <div className="relative">
          <Search
            aria-hidden
            size={18}
            strokeWidth={1.8}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-muted"
          />
          <input type="search" {...input} {...control} className={cn(controlClasses, "pl-10", className)} />
        </div>
      )}
    </Field>
  );
}

const choiceInput =
  "size-[1.125rem] shrink-0 cursor-pointer accent-[var(--color-action)] disabled:cursor-not-allowed";

/** Reference: Checkbox/Default — native input with the action accent colour, 44px row target. */
export function Checkbox({
  label,
  description,
  className,
  ...props
}: Omit<ComponentProps<"input">, "type"> & { label: ReactNode; description?: ReactNode }) {
  return (
    <label className={cn("flex min-h-11 cursor-pointer items-start gap-2.5 py-2.5 text-data text-ink has-disabled:cursor-not-allowed has-disabled:opacity-[0.42]", className)}>
      <input type="checkbox" className={cn(choiceInput, "mt-px")} {...props} />
      <span className="flex flex-col">
        <span>{label}</span>
        {description ? <span className="text-caption text-text-muted">{description}</span> : null}
      </span>
    </label>
  );
}

/** Reference: Radio/Default, grouped in a fieldset with a legend. */
export function RadioGroup({
  legend,
  name,
  options,
  value,
  defaultValue,
  onChange,
  orientation = "horizontal",
  error,
  className,
}: {
  legend: ReactNode;
  name: string;
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  orientation?: "horizontal" | "vertical";
  error?: ReactNode;
  className?: string;
}) {
  const errorId = error ? `${name}-error` : undefined;
  return (
    <fieldset className={cn("flex flex-col gap-1", className)} aria-describedby={errorId}>
      <legend className="mb-1 text-caption font-semibold text-ink">{legend}</legend>
      <div className={cn("flex gap-x-5", orientation === "vertical" ? "flex-col" : "flex-wrap")}>
        {options.map((option) => (
          <label
            key={option.value}
            className="flex min-h-11 cursor-pointer items-center gap-2.5 text-data text-ink has-disabled:cursor-not-allowed has-disabled:opacity-[0.42]"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              disabled={option.disabled}
              checked={value === undefined ? undefined : value === option.value}
              defaultChecked={value !== undefined || defaultValue === undefined ? undefined : defaultValue === option.value}
              onChange={(event) => onChange?.(event.target.value)}
              className={choiceInput}
            />
            {option.label}
          </label>
        ))}
      </div>
      {error ? (
        <p id={errorId} className="text-caption font-semibold text-critical">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

/**
 * Reference: Switch/Default ("Notifications on"). A native checkbox exposed as role="switch"
 * so Space toggles it and state is announced as on/off.
 */
export function Switch({
  label,
  className,
  ...props
}: Omit<ComponentProps<"input">, "type" | "role"> & { label: ReactNode }) {
  return (
    <label className={cn("inline-flex min-h-11 cursor-pointer items-center gap-2.5 text-data text-ink has-disabled:cursor-not-allowed has-disabled:opacity-[0.42]", className)}>
      <span className="relative inline-flex h-6 w-10 shrink-0">
        <input type="checkbox" role="switch" className="peer absolute inset-0 z-10 m-0 cursor-pointer opacity-0 disabled:cursor-not-allowed" {...props} />
        <span
          aria-hidden
          className="absolute inset-0 rounded-full bg-control-border transition-colors peer-checked:bg-action peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-action"
        />
        <span
          aria-hidden
          className="absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-card transition-transform peer-checked:translate-x-4"
        />
      </span>
      {label}
    </label>
  );
}
