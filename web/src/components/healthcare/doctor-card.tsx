import { Clock, ShieldCheck } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * Reference: Card/Doctor profile ("Explore available care" and doctor discovery results).
 * Avatar · approval marker · name · specialty and focus · next availability · fee · action.
 *
 * The reference marker reads "Profile verified". MedNet lists only administrator-approved
 * providers, but how credentials are verified is unresolved (req.md OQ-09), so the marker says
 * "Approved provider" — it must not claim credential verification.
 *
 * The fee is the provider-defined amount shown for information only — no payment is taken
 * (payments are out of scope). It is passed as a preformatted string and is omitted on live data,
 * because the API has no fee field.
 */
export function DoctorCard({
  name,
  specialty,
  focus,
  nextAvailable,
  fee,
  approved = false,
  href,
  actionLabel = "View profile",
  current = false,
  headingLevel = "h3",
}: {
  name: string;
  specialty: string;
  focus?: string;
  /** e.g. "Today, 2:30 PM"; omitted when the provider has no open slot. */
  nextAvailable?: string;
  /** e.g. "USD 35" */
  fee?: string;
  approved?: boolean;
  href: string;
  actionLabel?: string;
  /** Marks the card whose details are open (find-care selection). */
  current?: boolean;
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  return (
    <Card
      as="article"
      padding="sm"
      className={current ? "flex h-full flex-col border-action ring-2 ring-action/25 md:p-5" : "flex h-full flex-col md:p-5"}
    >
      <div className="flex items-start justify-between gap-3">
        <Avatar name={name} size="lg" />
        {approved ? (
          <span className="inline-flex items-center gap-1 text-[0.75rem] font-bold text-green-800">
            <ShieldCheck aria-hidden size={14} strokeWidth={1.8} />
            Approved provider
          </span>
        ) : null}
      </div>
      <Heading className="mt-4 text-[1.1875rem] leading-7 text-ink [overflow-wrap:anywhere]">{name}</Heading>
      <p className="mb-4 text-caption text-text-secondary [overflow-wrap:anywhere]">
        {specialty}
        {focus ? ` · ${focus}` : null}
      </p>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
        <p className="inline-flex items-center gap-1.5 text-caption text-text-secondary">
          <Clock aria-hidden size={14} strokeWidth={1.8} />
          {nextAvailable ?? "No open times"}
        </p>
        {fee ? (
          <p className="text-data font-bold text-green-900">
            <span className="sr-only">Fee: </span>
            {fee}
          </p>
        ) : null}
      </div>
      <ButtonLink
        href={href}
        variant="secondary"
        fullWidth
        className="mt-4"
        aria-label={`${actionLabel}: ${name}`}
        aria-current={current ? "true" : undefined}
        scroll={false}
      >
        {actionLabel}
      </ButtonLink>
    </Card>
  );
}
