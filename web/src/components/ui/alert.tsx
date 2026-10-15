import { CircleAlert, Info, ShieldCheck, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Reference: Alert/Information, Alert/Warning, Alert/Critical (measured: 14px padding, 9px radius
 * → 8px token, tone-soft background, tone-coloured bold title) and the green "Your information is
 * protected" note (`success`).
 *
 * Alerts are static by default (no live role), so content present at page load is not announced as
 * an event. Pass `live` when the alert appears in response to something: "assertive" uses
 * role="alert" (interrupts), "polite" uses role="status".
 */
export type AlertTone = "info" | "warning" | "critical" | "success";

const tones: Record<AlertTone, { box: string; icon: LucideIcon }> = {
  info: { box: "bg-info-soft text-info", icon: Info },
  warning: { box: "bg-warning-soft text-warning", icon: TriangleAlert },
  critical: { box: "bg-critical-soft text-critical", icon: CircleAlert },
  success: { box: "bg-green-50 text-green-800 ring-1 ring-inset ring-green-100", icon: ShieldCheck },
};

export function Alert({
  tone = "info",
  title,
  children,
  action,
  icon,
  live = false,
  className,
}: {
  tone?: AlertTone;
  live?: false | "polite" | "assertive";
  title: ReactNode;
  children?: ReactNode;
  /** Optional trailing control, e.g. a retry button. */
  action?: ReactNode;
  /** Override the default tone icon. */
  icon?: LucideIcon;
  className?: string;
}) {
  const Icon = icon ?? tones[tone].icon;
  return (
    <div
      role={live === "assertive" ? "alert" : live === "polite" ? "status" : undefined}
      className={cn("flex gap-3 rounded-sm p-3.5", tones[tone].box, className)}
    >
      <Icon aria-hidden size={20} strokeWidth={1.8} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-bold">{title}</p>
        {children ? <div className="mt-0.5 text-data text-ink-soft">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0 self-center">{action}</div> : null}
    </div>
  );
}
