"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Reference: Filter bar/Default and the "Search and filter" pattern — search input → high-value
 * filters → applied-filter summary → result count. Filters are passed in as controls
 * (SearchInput, SelectField with hidden labels) so this component only handles layout and the
 * applied-filter summary.
 */
export type AppliedFilter = { id: string; label: string };

export function FilterBar({
  search,
  filters,
  applied = [],
  onRemove,
  onClearAll,
  resultCount,
  label = "Filters",
}: {
  search?: ReactNode;
  filters?: ReactNode;
  applied?: AppliedFilter[];
  onRemove?: (id: string) => void;
  onClearAll?: () => void;
  /** Announced politely when it changes. */
  resultCount?: ReactNode;
  label?: string;
}) {
  return (
    <div role="search" aria-label={label} className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
        {search ? <div className="min-w-0 md:flex-[2_1_18rem]">{search}</div> : null}
        {filters ? (
          <div className="grid min-w-0 gap-3 md:flex md:flex-[3_1_24rem] md:flex-wrap md:[&>*]:flex-[1_1_9rem]">{filters}</div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2 empty:hidden">
        {applied.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => onRemove?.(filter.id)}
            aria-label={`Remove filter: ${filter.label}`}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-green-50 px-3 text-caption font-semibold text-green-900 hover:bg-green-100"
          >
            {filter.label}
            <X aria-hidden size={14} strokeWidth={1.8} />
          </button>
        ))}
        {applied.length > 1 && onClearAll ? (
          <button
            type="button"
            onClick={onClearAll}
            className="min-h-10 rounded-sm px-2 text-caption font-semibold text-green-800 underline-offset-2 hover:underline"
          >
            Clear all
          </button>
        ) : null}
      </div>
      {/* Always mounted so the first count change is announced. */}
      <p aria-live="polite" className="text-right text-caption text-text-secondary empty:hidden">
        {resultCount}
      </p>
    </div>
  );
}
