"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Reference: Tabs/Underline. WAI-ARIA tabs pattern: arrow keys move between tabs (automatic
 * activation), Home/End jump to the ends, only the active tab is in the tab order. The focus ring is
 * inset because the scrollable tab list would otherwise clip it.
 */
export type TabItem = { id: string; label: ReactNode; content: ReactNode };

export function Tabs({
  items,
  label,
  defaultTab,
  value,
  onChange,
  className,
}: {
  items: TabItem[];
  /** Accessible name for the tab list. */
  label: string;
  defaultTab?: string;
  value?: string;
  onChange?: (id: string) => void;
  className?: string;
}) {
  const baseId = useId();
  const [internal, setInternal] = useState(defaultTab ?? items[0]?.id);
  const requested = value ?? internal;
  // An unknown id would leave no tab in the tab order; fall back to the first tab.
  const active = items.some((item) => item.id === requested) ? requested : items[0]?.id;
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function select(index: number) {
    const item = items[index];
    if (!item) return;
    setInternal(item.id);
    onChange?.(item.id);
    refs.current[index]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = items.length - 1;
    const next =
      event.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null;
    if (next === null) return;
    event.preventDefault();
    select(next);
  }

  return (
    <div className={className}>
      <div role="tablist" aria-label={label} className="flex gap-6 overflow-x-auto border-b border-border">
        {items.map((item, index) => {
          const selected = item.id === active;
          return (
            <button
              key={item.id}
              ref={(node) => {
                refs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(index)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                "-mb-px min-h-11 shrink-0 border-b-2 px-1.5 text-data focus-visible:outline-offset-[-3px] font-semibold whitespace-nowrap",
                selected
                  ? "border-action text-green-900"
                  : "border-transparent text-text-secondary hover:border-control-border hover:text-ink",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          role="tabpanel"
          id={`${baseId}-panel-${item.id}`}
          aria-labelledby={`${baseId}-tab-${item.id}`}
          hidden={item.id !== active}
          tabIndex={0}
          className="pt-5"
        >
          {item.content}
        </div>
      ))}
    </div>
  );
}
