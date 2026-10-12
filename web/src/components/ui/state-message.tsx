import { Check, CircleAlert, Inbox, Lock, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

/**
 * Reference: the five standard states shown on every workspace ("Loading queue", "Empty: no
 * assigned work", "Error: retry failed sync", "Success: action recorded", "Permission denied").
 *
 * `inline` reproduces the compact state chips; `panel` is the full in-content version for empty
 * lists and failed loads (interpretation: the reference shows only the compact chips).
 *
 * Loading, error and success are transient results of an action, so they are announced by default
 * (error assertively). Empty and denied are steady page content and are not live unless `live` is set.
 */
export type StateKind = "loading" | "empty" | "error" | "success" | "denied";

const config: Record<StateKind, { icon?: LucideIcon; mark: string; role: "status" | "alert"; liveByDefault: boolean }> = {
  loading: { mark: "text-action", role: "status", liveByDefault: true },
  empty: { icon: Inbox, mark: "bg-surface-soft text-text-secondary", role: "status", liveByDefault: false },
  error: { icon: CircleAlert, mark: "bg-critical-soft text-critical", role: "alert", liveByDefault: true },
  success: { icon: Check, mark: "bg-green-50 text-action", role: "status", liveByDefault: true },
  denied: { icon: Lock, mark: "bg-critical-soft text-critical", role: "status", liveByDefault: false },
};

export function StateMessage({
  kind,
  title,
  description,
  action,
  layout = "panel",
  live,
  className,
}: {
  kind: StateKind;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  layout?: "panel" | "inline";
  /** Override whether the message is announced as it appears. */
  live?: boolean;
  className?: string;
}) {
  const { icon: Icon, mark, liveByDefault } = config[kind];
  const role = (live ?? liveByDefault) ? config[kind].role : undefined;
  const symbol =
    kind === "loading" ? (
      <Spinner size={layout === "inline" ? 14 : 20} />
    ) : Icon ? (
      <Icon aria-hidden size={layout === "inline" ? 14 : 22} strokeWidth={1.8} />
    ) : null;

  if (layout === "inline") {
    return (
      <div
        role={role}
        className={cn(
          "flex min-h-10 items-center gap-2.5 rounded-sm bg-surface-soft px-3 py-2 text-caption text-ink-soft",
          className,
        )}
      >
        <span className={cn("inline-flex size-6 shrink-0 items-center justify-center rounded-full", mark)}>{symbol}</span>
        <span className="min-w-0">{title}</span>
        {action ? <span className="ml-auto shrink-0">{action}</span> : null}
      </div>
    );
  }

  return (
    <div
      role={role}
      className={cn(
        "flex flex-col items-center gap-3 rounded-md border border-dashed border-border bg-surface px-6 py-10 text-center",
        className,
      )}
    >
      <span className={cn("inline-flex size-12 items-center justify-center rounded-full", mark)}>{symbol}</span>
      <p className="text-title text-ink">{title}</p>
      {description ? <p className="max-w-md text-data text-text-secondary">{description}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
