import { cn } from "@/lib/cn";

/**
 * Reference: the "Fictional data" chip in the operations top bar. Every screen that
 * renders presentation-only data (no backend endpoint yet) must show this badge.
 */
export function FictionalDataBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-8 items-center rounded-full bg-green-50 px-3 text-caption font-semibold text-green-900",
        className,
      )}
    >
      Fictional data
    </span>
  );
}
