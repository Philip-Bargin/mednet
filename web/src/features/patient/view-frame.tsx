import { ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Card, Eyebrow } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * Reference: the patient sub-view template (Find a doctor, Appointments, Messages, Medical
 * information, Payments, Help & support): a dark band with the view name and one action, a
 * "Current view" list card, and a "Privacy and access" card beside it from 1200px.
 */
export function ViewBand({
  title,
  description,
  action,
  eyebrow = "Patient workspace",
}: {
  eyebrow?: string;
  title: string;
  description: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-md bg-emphasis px-5 py-6 text-white [&_:focus-visible]:outline-green-100 md:flex-row md:items-center md:justify-between md:px-7.5 md:py-8">
      <div className="min-w-0">
        <Eyebrow tone="inverse">{eyebrow}</Eyebrow>
        <h2 className="mt-2 text-[1.75rem] leading-9 font-normal text-white md:text-[1.875rem]">{title}</h2>
        <p className="mt-2 max-w-2xl text-body text-white/90">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </section>
  );
}

/** Main column + the reference's narrow "Privacy and access" column (stacked below 1200px). */
export function ViewColumns({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="flex min-w-0 flex-col gap-6">{children}</div>
      <div className="flex min-w-0 flex-col gap-6">{aside ?? <PrivacyCard />}</div>
    </div>
  );
}

/**
 * Reference: "Privacy and access — Role-scoped information". The reference's "View access history"
 * link is omitted: there is no patient-facing access-history endpoint.
 */
export function PrivacyCard({ children }: { children?: ReactNode }) {
  return (
    <Card>
      <Eyebrow>Privacy and access</Eyebrow>
      <ShieldCheck aria-hidden size={26} strokeWidth={1.8} className="mt-4 text-green-800" />
      <h2 className="mt-3 text-title font-normal text-ink">Role-scoped information</h2>
      <p className="mt-1.5 text-data text-text-secondary">
        {children ??
          "What each person can see depends on their role and their relationship to you. A doctor needs a confirmed appointment with you and your permission to read your records. MedNet checks every request."}
      </p>
    </Card>
  );
}

/** "Current view" card header with the reference's "3 items" count pill. */
export function CountBadge({ count, noun = "item" }: { count: number; noun?: string }) {
  return (
    <Badge tone="neutral">
      {count} {count === 1 ? noun : `${noun}s`}
    </Badge>
  );
}
