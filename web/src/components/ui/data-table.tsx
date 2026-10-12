import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { SkeletonCard } from "./skeleton";
import { StateMessage } from "./state-message";

/**
 * Reference: Table/Data (laboratory order queue, finance transaction queue). Measured header:
 * soft-canvas background, uppercase bold muted label; selected row tinted brand-50.
 * Header text is 11px and cell text 13px instead of the reference's 10px/12px (legibility).
 *
 * Below 768px rows stack as labelled cards so nothing scrolls sideways (interpretation: the
 * reference does not show a compact table). Both layouts are rendered and one is hidden with CSS,
 * so `cell` renderers must be stateless and must not emit fixed element ids.
 * The selected row is marked by aria-current, a tint and a 3px action edge (not colour alone).
 */
export type DataColumn<Row> = {
  id: string;
  header: string;
  cell: (row: Row) => ReactNode;
  align?: "start" | "end";
  /** Hide the label in stacked (compact) rows, e.g. for the primary identifier. */
  primary?: boolean;
};

export function DataTable<Row>({
  caption,
  columns,
  rows,
  rowKey,
  selectedKey,
  loading = false,
  empty,
  className,
}: {
  /** Accessible table name; visually hidden. */
  caption: string;
  columns: DataColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  selectedKey?: string;
  loading?: boolean;
  /** Shown when there are no rows. */
  empty?: { title: ReactNode; description?: ReactNode; action?: ReactNode };
  className?: string;
}) {
  if (loading) return <SkeletonCard lines={4} label={`Loading ${caption.toLowerCase()}`} />;
  if (rows.length === 0) {
    return (
      <StateMessage
        kind="empty"
        title={empty?.title ?? "Nothing to show yet"}
        description={empty?.description}
        action={empty?.action}
      />
    );
  }

  return (
    <div className={cn("min-w-0", className)}>
      <table className="hidden w-full border-collapse overflow-hidden rounded-sm text-left md:table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                className={cn(
                  "bg-surface-soft px-3 py-2.5 text-eyebrow font-bold tracking-[0.06em] text-ink-faint uppercase",
                  column.align === "end" && "text-right",
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = rowKey(row);
            return (
              <tr
                key={key}
                aria-current={key === selectedKey ? "true" : undefined}
                className={cn(
                  "border-t border-line-soft",
                  key === selectedKey && "bg-green-50 shadow-[inset_3px_0_0_var(--color-action)]",
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.id}
                    className={cn("px-3 py-3 align-middle text-caption text-ink", column.align === "end" && "text-right")}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>

      <ul aria-label={caption} className="flex flex-col gap-3 md:hidden">
        {rows.map((row) => {
          const key = rowKey(row);
          return (
            <li
              key={key}
              className={cn(
                "rounded-sm border border-border bg-surface p-4",
                key === selectedKey && "border-action bg-green-50 shadow-[inset_3px_0_0_var(--color-action)]",
              )}
            >
              <dl className="grid gap-2">
                {columns.map((column) => (
                  <div key={column.id} className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <dt className={cn("text-caption text-text-muted", column.primary && "sr-only")}>{column.header}</dt>
                    <dd className={cn("min-w-0 text-data text-ink", column.primary && "font-semibold")}>{column.cell(row)}</dd>
                  </div>
                ))}
              </dl>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
