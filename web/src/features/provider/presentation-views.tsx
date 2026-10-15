import { CalendarClock, FileText, LockKeyhole, MessageSquareText, WalletCards, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Card, CardHeader } from "@/components/ui/card";
import { FictionalDataBadge } from "@/components/ui/fictional-data-badge";
import { CountBadge, PrivacyCard, ViewBand, ViewColumns } from "@/features/patient/view-frame";
import { FICTIONAL_EARNINGS } from "./fictional";

/** Earnings & payouts — presentation-only (payments and payouts are out of scope). */
export function ProviderEarnings() {
  return (
    <>
      <ViewBand eyebrow="Doctor workspace" title="Earnings & payouts" description="A preview of the approved earnings design. MedNet does not take payments or make payouts." action={<FictionalDataBadge />} />
      <ViewColumns>
        <Alert tone="info" icon={WalletCards} title="Earnings and payouts are not available on MedNet">
          Appointments are not paid through MedNet. The values below are example data from the design, not your account.
        </Alert>
        <Card>
          <CardHeader eyebrow="Current view" title="Provider financial summary" action={<CountBadge count={FICTIONAL_EARNINGS.data.length} />} />
          <dl className="mt-4 grid gap-3 md:grid-cols-2">
            {FICTIONAL_EARNINGS.data.map((item) => (
              <div key={item.label} className="rounded-sm border border-border p-4">
                <dt className="text-caption text-text-muted">{item.label}</dt>
                <dd className="mt-0.5 text-title font-bold text-green-950">{item.value}</dd>
                <dd className="text-caption text-text-secondary">{item.note}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </ViewColumns>
    </>
  );
}

/** Help & support — factual guidance linking to features that exist; no support channel is invented. */
export function ProviderHelp() {
  const topics: Array<{ icon: LucideIcon; title: string; body: string; link?: { href: string; label: string } }> = [
    {
      icon: CalendarClock,
      title: "Open times and requests",
      body: "Publish single open times in Liberia time. A patient request holds the time until you confirm or decline it. Closed times cannot be reopened; publish a new one.",
      link: { href: "/provider/schedule", label: "Open schedule" },
    },
    {
      icon: MessageSquareText,
      title: "Text consultations",
      body: "Available for confirmed text appointments. Either you or the patient can open it; only you can end it. Video and voice calls are not available.",
      link: { href: "/provider/appointments?tab=upcoming", label: "Upcoming appointments" },
    },
    {
      icon: FileText,
      title: "Records and results",
      body: "You can read and add records, see vital readings and review results only while the patient has a confirmed or completed appointment with you and has allowed you access.",
      link: { href: "/provider/patients", label: "Your patients" },
    },
    {
      icon: LockKeyhole,
      title: "Your listing",
      body: "Your display name and specialty come from your approved application. Changes go through a MedNet administrator.",
      link: { href: "/provider/profile", label: "Your profile" },
    },
  ];
  return (
    <>
      <ViewBand eyebrow="Doctor workspace" title="Help & support" description="How MedNet works for providers." />
      <ViewColumns
        aside={
          <PrivacyCard>
            A MedNet support team and contact channel are not available yet. MedNet does not replace emergency services.
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
      </ViewColumns>
    </>
  );
}
