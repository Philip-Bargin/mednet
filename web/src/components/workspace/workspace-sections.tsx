import type { ReactNode } from "react";
import { Card, CardHeader, Eyebrow } from "@/components/ui/card";
import { cn } from "@/lib/cn";

/**
 * Reference: the dark green welcome band at the top of the patient and doctor overviews
 * ("Your care at a glance — Everything is ready for your next visit."). Measured: brand-900,
 * 26/30px padding, 13px radius (→ 12px token), white text, trailing white action.
 */
export function WelcomeBand({
  eyebrow,
  title,
  action,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-md bg-emphasis px-5 py-6 text-white [&_:focus-visible]:outline-green-100 md:flex-row md:items-center md:justify-between md:px-7.5 md:py-6.5">
      <div className="min-w-0">
        <Eyebrow tone="inverse">{eyebrow}</Eyebrow>
        <h2 className="mt-2 text-title font-normal text-white md:text-[1.625rem] md:leading-9">{title}</h2>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </section>
  );
}

/**
 * Reference: administrator "Permission boundary — Your assigned authority" card with
 * Allowed / Approval required / Not available groups. It explains scope only; the backend
 * remains the security boundary.
 */
export function PermissionBoundary({
  allowed,
  approvalRequired,
  notAvailable,
  approvalRequiredLabel = "Approval required",
  className,
}: {
  allowed: ReactNode;
  approvalRequired: ReactNode;
  notAvailable: ReactNode;
  /** Heading for the middle group, e.g. "Super administrator only" where no approval flow exists. */
  approvalRequiredLabel?: string;
  className?: string;
}) {
  const groups: Array<[string, ReactNode, string]> = [
    ["Allowed", allowed, "text-action"],
    [approvalRequiredLabel, approvalRequired, "text-warning"],
    ["Not available", notAvailable, "text-critical"],
  ];
  return (
    <Card className={className}>
      <CardHeader eyebrow="Permission boundary" title="Your assigned authority" />
      <dl className="mt-5 divide-y divide-border border-t border-border">
        {groups.map(([term, detail, tone]) => (
          <div key={term} className="py-4">
            <dt className={cn("text-eyebrow font-bold tracking-[0.08em] uppercase", tone)}>{term}</dt>
            <dd className="mt-1 text-data text-ink-soft">{detail}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
