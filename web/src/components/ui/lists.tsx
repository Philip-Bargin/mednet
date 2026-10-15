import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Reference: Activity list/Default ("Recent activity": icon tile · title · meta · status),
 * the "For you" action list (chevron rows) and Queue item/Default (operations queues with an
 * initial tile). One row component covers all three; rows separate with the soft line colour.
 */
export function ActivityList({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <ul aria-label={label} className="divide-y divide-line-soft">
      {children}
    </ul>
  );
}

const tileTones = {
  neutral: "bg-surface-soft text-green-800",
  success: "bg-green-50 text-action",
  info: "bg-info-soft text-info",
  warning: "bg-warning-soft text-warning",
} as const;

export function ActivityRow({
  icon: Icon,
  marker,
  tileTone = "neutral",
  title,
  meta,
  trailing,
  href,
}: {
  icon?: LucideIcon;
  /** Text marker instead of an icon (queue items: "V", "LAB", "T-842"). */
  marker?: string;
  tileTone?: keyof typeof tileTones;
  title: ReactNode;
  meta?: ReactNode;
  /** Badge or value at the end of the row. */
  trailing?: ReactNode;
  /** Makes the whole row a link and shows a chevron (the "For you" pattern). */
  // Narrower than ~320px the badge and chevron wrap under the title instead of overflowing (Phase 5E reflow).
  href?: string;
}) {
  const body = (
    <>
      {Icon || marker ? (
        <span
          aria-hidden
          className={cn(
            "inline-flex size-10 shrink-0 items-center justify-center rounded-sm text-[0.6875rem] font-bold",
            tileTones[tileTone],
          )}
        >
          {Icon ? <Icon size={20} strokeWidth={1.8} /> : marker}
        </span>
      ) : null}
      <span className="min-w-[9rem] flex-1">
        <span className="block font-bold text-ink [overflow-wrap:anywhere]">{title}</span>
        {meta ? <span className="block text-caption text-text-secondary">{meta}</span> : null}
      </span>
      {trailing ? <span className="ml-auto shrink-0">{trailing}</span> : null}
      {href ? <ChevronRight aria-hidden size={20} strokeWidth={1.8} className="shrink-0 text-ink-soft" /> : null}
    </>
  );
  return (
    <li>
      {href ? (
        <Link href={href} className="flex min-h-16 flex-wrap items-center gap-x-3 gap-y-2 rounded-sm py-3.5 hover:bg-surface-soft">
          {body}
        </Link>
      ) : (
        <div className="flex min-h-16 flex-wrap items-center gap-x-3 gap-y-2 py-3.5">{body}</div>
      )}
    </li>
  );
}

/** Reference: Audit event/Default ("09:42 Role assignment changed · Super admin SA-03 · User AD-12"). */
export function AuditEvent({ time, title, actor }: { time: string; title: ReactNode; actor: ReactNode }) {
  return (
    <li className="grid grid-cols-[3.5rem_1fr] gap-3 py-3">
      <time className="text-caption font-semibold text-text-secondary tabular-nums">{time}</time>
      <span className="min-w-0">
        <span className="block font-bold text-ink">{title}</span>
        <span className="block text-caption text-text-secondary">{actor}</span>
      </span>
    </li>
  );
}

/** Key–value summary ("Date 12 August 2025 · Duration 30 minutes", "Selected record"). */
export function DescriptionList({
  items,
  columns = 1,
  className,
}: {
  items: Array<{ term: ReactNode; detail: ReactNode }>;
  columns?: 1 | 2 | 3;
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid gap-x-6 gap-y-4",
        columns === 2 && "md:grid-cols-2",
        columns === 3 && "md:grid-cols-3",
        className,
      )}
    >
      {items.map((item, index) => (
        <div key={index} className="min-w-0">
          <dt className="text-caption text-text-muted">{item.term}</dt>
          <dd className="mt-0.5 text-data font-semibold text-ink [overflow-wrap:anywhere]">{item.detail}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Reference: "RESTRICTED — Only order-relevant clinical context is available…" boundary notes in
 * every operations detail panel. Communicates scope only; enforcement is the backend's job.
 */
export function RestrictedNotice({ children, label = "Restricted" }: { children: ReactNode; label?: string }) {
  return (
    <div className="rounded-sm border border-critical-border bg-critical-soft/50 p-3">
      <p className="text-eyebrow font-bold tracking-[0.08em] text-critical uppercase">{label}</p>
      <p className="mt-1 text-caption text-ink-soft">{children}</p>
    </div>
  );
}
