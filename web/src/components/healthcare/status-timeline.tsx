import { Check, Lock } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Reference: Timeline/Specimen handoff (vertical: "Collected 09:18 · Collector JA",
 * "Handoff in progress", "Laboratory receipt — Not yet received") and the laboratory
 * "Processing stages" (horizontal: Order accepted → Released to doctor, each with a state).
 *
 * Steps and states are supplied by the caller from workflow data; this component only renders them.
 * Each state is spoken as text so meaning never depends on colour or icon.
 */
export type TimelineState = "complete" | "current" | "pending" | "required" | "locked";

export type TimelineStep = {
  id: string;
  title: string;
  /** e.g. "09:18 · Collector JA" or "Offline event pending sync". */
  detail?: ReactNode;
  state: TimelineState;
  /** Overrides the default state wording, e.g. "Not validated". */
  stateLabel?: string;
};

const stateLabels: Record<TimelineState, string> = {
  complete: "Complete",
  current: "Current",
  pending: "Pending",
  required: "Required",
  locked: "Locked",
};

const markerClasses: Record<TimelineState, string> = {
  complete: "border-action bg-action text-white",
  current: "border-action bg-green-100 text-green-900",
  pending: "border-border bg-surface text-text-muted",
  required: "border-warning bg-warning-soft text-warning",
  locked: "border-border bg-surface-soft text-text-muted",
};

const labelClasses: Record<TimelineState, string> = {
  complete: "text-action",
  current: "text-green-900",
  pending: "text-text-muted",
  required: "text-warning",
  locked: "text-text-muted",
};

function Marker({ step, index }: { step: TimelineStep; index: number }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-[0.6875rem] font-bold",
        markerClasses[step.state],
      )}
    >
      {step.state === "complete" ? (
        <Check size={14} strokeWidth={2.4} />
      ) : step.state === "locked" ? (
        <Lock size={12} strokeWidth={2} />
      ) : (
        index + 1
      )}
    </span>
  );
}

export function StatusTimeline({
  steps,
  label,
  orientation = "vertical",
}: {
  steps: TimelineStep[];
  label: string;
  /** Horizontal lays stages out in a responsive grid (stacks below 768px). */
  orientation?: "vertical" | "horizontal";
}) {
  if (orientation === "horizontal") {
    return (
      <ol aria-label={label} className="grid gap-3 md:grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))]">
        {steps.map((step, index) => (
          <li
            key={step.id}
            aria-current={step.state === "current" ? "step" : undefined}
            className={cn(
              "flex min-w-0 gap-3 rounded-sm border p-3 md:min-h-28 md:flex-col",
              step.state === "current" ? "border-action bg-green-50" : "border-border bg-surface",
            )}
          >
            <Marker step={step} index={index} />
            <div className="min-w-0">
              <p className="text-data font-semibold text-ink [overflow-wrap:anywhere]">{step.title}</p>
              <p className={cn("text-caption font-semibold", labelClasses[step.state])}>
                {step.stateLabel ?? stateLabels[step.state]}
              </p>
              {step.detail ? <p className="text-caption text-text-secondary">{step.detail}</p> : null}
            </div>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <ol aria-label={label} className="flex flex-col">
      {steps.map((step, index) => (
        <li
          key={step.id}
          aria-current={step.state === "current" ? "step" : undefined}
          className="relative flex gap-3 pb-5 last:pb-0"
        >
          {index < steps.length - 1 ? (
            <span aria-hidden className="absolute top-8 bottom-1 left-3.5 w-px -translate-x-1/2 bg-border" />
          ) : null}
          <Marker step={step} index={index} />
          <div className="min-w-0 pt-0.5">
            <p className="text-data font-semibold text-ink">{step.title}</p>
            <p className="text-caption text-text-secondary">
              <span className={cn("font-semibold", labelClasses[step.state])}>{step.stateLabel ?? stateLabels[step.state]}</span>
              {step.detail ? <> · {step.detail}</> : null}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
