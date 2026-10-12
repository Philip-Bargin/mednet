import { Check, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";

/** Reference: Breadcrumb/Default (named in the inventory). Last item is the current page. */
export function Breadcrumb({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1.5 text-caption text-text-secondary">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
              {item.href && !last ? (
                <Link href={item.href} className="rounded-sm font-semibold text-green-800 hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={cn(last && "text-ink")}>
                  {item.label}
                </span>
              )}
              {last ? null : <ChevronRight aria-hidden size={14} strokeWidth={1.8} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Reference: booking progress "1 Find care · 2 Profile · 3 Schedule · 4 Sign in · 5 Review ·
 * 6 Confirmed" and the collection-agent step indicator (Arrive → Handoff).
 * Below 768px only the current step label is shown beside the numbered markers.
 */
export function Stepper({
  steps,
  current,
  label = "Progress",
}: {
  steps: string[];
  /** 0-based index of the current step. */
  current: number;
  label?: string;
}) {
  return (
    <nav aria-label={label}>
      <p className="mb-2 text-caption font-semibold text-text-secondary md:sr-only">
        Step {current + 1} of {steps.length}: {steps[current]}
      </p>
      <ol className="flex items-center gap-2">
        {steps.map((step, index) => {
          const state = index < current ? "complete" : index === current ? "current" : "upcoming";
          return (
            <li
              key={`${index}-${step}`}
              aria-current={state === "current" ? "step" : undefined}
              className="flex min-w-0 flex-1 items-center gap-2"
            >
              <span
                className={cn(
                  "inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-caption font-bold",
                  state === "complete" && "border-action bg-action text-white",
                  state === "current" && "border-action bg-green-50 text-green-900",
                  state === "upcoming" && "border-border bg-surface text-text-muted",
                )}
              >
                {state === "complete" ? <Check aria-hidden size={14} strokeWidth={2.4} /> : index + 1}
              </span>
              <span
                className={cn(
                  "hidden truncate text-caption md:inline",
                  state === "upcoming" ? "text-text-muted" : "font-semibold text-ink",
                )}
              >
                {step}
                <span className="sr-only">{state === "complete" ? " (completed)" : state === "upcoming" ? " (not started)" : ""}</span>
              </span>
              {index < steps.length - 1 ? <span aria-hidden className="h-px min-w-3 flex-1 bg-border" /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
