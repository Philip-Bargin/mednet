"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

/** Page numbers to show around the current page, with gaps marked as null. Pages are 1-based. */
export function pageWindow(current: number, total: number): Array<number | null> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);
  const result: Array<number | null> = [];
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) result.push(null);
    result.push(page);
  });
  return result;
}

/**
 * Reference: Pagination/Default (named in the component inventory; not drawn). Backend lists use
 * zero-based `page`/`size` — convert at the call site. Interpretation: previous/next plus a
 * compact page window; below 768px only previous/next and "Page x of y".
 */
export function Pagination({
  page,
  totalPages,
  onPageChange,
  label = "Pagination",
}: {
  /** 1-based current page. */
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  label?: string;
}) {
  if (totalPages <= 1) return null;
  const item =
    "inline-flex min-h-10 min-w-10 items-center justify-center rounded-sm border px-2 text-data font-semibold aria-disabled:cursor-not-allowed aria-disabled:opacity-[0.42]";
  // aria-disabled (not disabled) keeps keyboard focus on Previous/Next when reaching either end.
  return (
    <nav aria-label={label} className="flex items-center justify-between gap-3 md:justify-start">
      <button
        type="button"
        className={cn(item, "border-border bg-surface text-green-800 hover:bg-action-subtle")}
        onClick={() => page > 1 && onPageChange(page - 1)}
        aria-disabled={page <= 1 || undefined}
        aria-label="Previous page"
      >
        <ChevronLeft aria-hidden size={18} strokeWidth={1.8} />
      </button>
      <p className="text-data text-text-secondary md:hidden">
        Page {page} of {totalPages}
      </p>
      <ul className="hidden items-center gap-1.5 md:flex">
        {pageWindow(page, totalPages).map((entry, index) =>
          entry === null ? (
            <li key={`gap-${index}`} aria-hidden className="px-1 text-text-muted">
              …
            </li>
          ) : (
            <li key={entry}>
              <button
                type="button"
                onClick={() => onPageChange(entry)}
                aria-current={entry === page ? "page" : undefined}
                aria-label={`Page ${entry}`}
                className={cn(
                  item,
                  entry === page
                    ? "border-action bg-action text-white"
                    : "border-border bg-surface text-ink hover:bg-surface-soft",
                )}
              >
                {entry}
              </button>
            </li>
          ),
        )}
      </ul>
      <button
        type="button"
        className={cn(item, "border-border bg-surface text-green-800 hover:bg-action-subtle")}
        onClick={() => page < totalPages && onPageChange(page + 1)}
        aria-disabled={page >= totalPages || undefined}
        aria-label="Next page"
      >
        <ChevronRight aria-hidden size={18} strokeWidth={1.8} />
      </button>
    </nav>
  );
}
