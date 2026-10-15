import { CalendarDays, LockKeyhole, ReceiptText, ShieldCheck, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { FictionalDataBadge } from "@/components/ui/fictional-data-badge";
import { ActivityList, ActivityRow } from "@/components/ui/lists";
import { FICTIONAL_RECEIPTS, type FictionalReceipt } from "./fictional";
import { CountBadge, PrivacyCard, ViewBand, ViewColumns } from "./view-frame";

const receiptTone: Record<FictionalReceipt["status"], BadgeTone> = { Authorized: "info", Paid: "success", Pending: "warning" };

/**
 * Payments — presentation-only (approved design kept; payments are out of scope in AGENTS.md).
 * Nothing is interactive: there is no receipt, download or transaction behind these rows.
 */
export function PatientPayments() {
  const receipts = FICTIONAL_RECEIPTS.data;
  return (
    <>
      <ViewBand title="Payments" description="A preview of the approved payments design. MedNet does not take payments." action={<FictionalDataBadge />} />
      <ViewColumns>
        <Alert tone="info" title="Payments are not available on MedNet">
          No fees are charged for appointment requests. The rows below are example data from the design, not your account.
        </Alert>
        <Card>
          <CardHeader eyebrow="Current view" title="Payments" action={<CountBadge count={receipts.length} />} />
          <div className="mt-4 border-t border-border">
            <ActivityList label="Example payments">
              {receipts.map((receipt) => (
                <ActivityRow
                  key={receipt.reference}
                  icon={ReceiptText}
                  title={receipt.amount}
                  meta={`${receipt.reference} · ${receipt.description} · ${receipt.date}`}
                  trailing={<Badge tone={receiptTone[receipt.status]}>{receipt.status}</Badge>}
                />
              ))}
            </ActivityList>
          </div>
        </Card>
      </ViewColumns>
    </>
  );
}

/**
 * Help & support — the reference's three topics. There is no support team, ticket API or approved
 * help content, so each topic points to the part of MedNet that exists and states what does not.
 */
export function PatientHelp() {
  const topics: Array<{ icon: LucideIcon; title: string; body: string; link?: { href: string; label: string } }> = [
    {
      icon: CalendarDays,
      title: "Appointment help",
      body: "Requests stay pending until the doctor confirms. You can cancel until the appointment starts, and answer a new time the doctor proposes.",
      link: { href: "/patient/appointments", label: "Open appointments" },
    },
    {
      icon: ReceiptText,
      title: "Payment help",
      body: "MedNet does not take payments, so there are no charges, receipts or refunds to manage.",
    },
    {
      icon: LockKeyhole,
      title: "Privacy help",
      body: "Choose which doctors can see your records, and withdraw access at any time.",
      link: { href: "/patient/records?tab=sharing", label: "Manage record sharing" },
    },
  ];
  return (
    <>
      <ViewBand title="Help & support" description="Answers about how MedNet works for patients." />
      <ViewColumns
        aside={
          <PrivacyCard>
            A MedNet support team and contact channel are not available yet. For urgent or emergency care, contact
            emergency services: MedNet does not replace them.
          </PrivacyCard>
        }
      >
        <Card>
          <CardHeader eyebrow="Current view" title="Help topics" action={<CountBadge count={topics.length} noun="topic" />} />
          <ul aria-label="Help topics" className="mt-4 divide-y divide-line-soft border-t border-border">
            {topics.map((topic) => (
              <li key={topic.title} className="flex flex-wrap items-start gap-3 py-4">
                <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-sm bg-surface-soft text-green-800">
                  <topic.icon size={20} strokeWidth={1.8} />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-ink">{topic.title}</h3>
                  <p className="mt-0.5 text-data text-text-secondary">{topic.body}</p>
                </div>
                {topic.link ? (
                  <Link href={topic.link.href} className="inline-flex min-h-11 items-center rounded-sm text-data font-bold text-green-800 hover:text-action">
                    {topic.link.label}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
        <Alert tone="success" icon={ShieldCheck} title="Signing in and your password">
          To change your password, sign out and use “Forgot password” on the sign-in page.
        </Alert>
      </ViewColumns>
    </>
  );
}
