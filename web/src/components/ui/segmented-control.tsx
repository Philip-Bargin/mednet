"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";
import type { SelectOption } from "./inputs";

/**
 * Reference: Segmented control/Default (consultation mode, list filters such as "Assigned to me").
 * Native radios underneath, so arrow keys and form submission behave as a radio group.
 */
export function SegmentedControl({
  legend,
  name,
  options,
  value,
  onChange,
  className,
}: {
  legend: string;
  name?: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const generated = useId();
  const groupName = name ?? `segmented-${generated}`;
  return (
    <fieldset className={cn("min-w-0", className)}>
      <legend className="sr-only">{legend}</legend>
      <div className="inline-flex max-w-full flex-wrap gap-1 rounded-sm border border-border bg-surface-soft p-1">
        {options.map((option) => (
          <label
            key={option.value}
            className="relative inline-flex min-h-10 cursor-pointer items-center rounded-[6px] px-3 text-data font-semibold text-text-secondary has-checked:bg-surface has-checked:text-green-900 has-checked:shadow-card has-focus-visible:outline-3 has-focus-visible:outline-offset-1 has-focus-visible:outline-action has-disabled:cursor-not-allowed has-disabled:opacity-[0.42]"
          >
            <input
              type="radio"
              name={groupName}
              value={option.value}
              checked={value === option.value}
              disabled={option.disabled}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
