import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Reference: Metric card/Default (operations overviews: "18 Open tasks · 5 due today"). Measured
 * value: 25px bold brand-950. Administrator cards carry a coloured left edge per tone. The edge is
 * supplementary: put the meaning in `label`/`hint` text (e.g. "3 escalated"), never in the colour.
 */
export type MetricTone = "success" | "info" | "warning" | "critical" | "neutral";

const edges: Record<MetricTone, string> = {
  success: "border-l-action",
  info: "border-l-info",
  warning: "border-l-warning",
  critical: "border-l-critical",
  neutral: "border-l-border",
};

export function MetricCard({
  value,
  label,
  hint,
  tone = "neutral",
  className,
}: {
  value: ReactNode;
  label: ReactNode;
  hint?: ReactNode;
  tone?: MetricTone;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1 rounded-md border border-l-4 border-border bg-surface p-4 shadow-card md:p-5",
        edges[tone],
        className,
      )}
    >
      <p className="flex flex-wrap items-baseline gap-x-2.5">
        <span className="text-[1.5625rem] leading-[2.25rem] font-bold text-green-950 tabular-nums">{value}</span>
        <span className="text-data font-bold text-ink">{label}</span>
      </p>
      {hint ? <p className="text-caption text-text-secondary">{hint}</p> : null}
    </div>
  );
}

/** Responsive grid for metric cards: 1 → 2 → 4 columns. */
export function MetricGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-4 md:grid-cols-2 lg:grid-cols-4", className)}>{children}</div>;
}
