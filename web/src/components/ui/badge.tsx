import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Reference: Badge/Appointment/Confirmed and the status pills ("Confirmed", "Available",
 * "Doctor review", "Action required"). Measured: 28px pill, 9px inline padding, 12px bold,
 * 6px gap, tone-coloured dot. Status is always text + dot, never colour alone.
 */
export type BadgeTone = "success" | "info" | "warning" | "critical" | "neutral";

const tones: Record<BadgeTone, string> = {
  success: "bg-green-50 text-green-800",
  info: "bg-info-soft text-info",
  warning: "bg-warning-soft text-warning",
  critical: "bg-critical-soft text-critical",
  neutral: "bg-surface-soft text-text-secondary ring-1 ring-inset ring-border",
};

export function Badge({
  tone = "neutral",
  dot = true,
  icon,
  children,
  className,
}: {
  tone?: BadgeTone;
  /** The reference shows a leading dot on status pills. */
  dot?: boolean;
  /** Optional decorative icon instead of the dot (e.g. "Profile verified"). */
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-badge font-bold",
        tones[tone],
        className,
      )}
    >
      {icon ?? (dot ? <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" /> : null)}
      <span className="min-w-0 [overflow-wrap:anywhere]">{children}</span>
    </span>
  );
}
