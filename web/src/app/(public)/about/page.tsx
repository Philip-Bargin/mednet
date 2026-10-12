import { EyeOff, KeyRound, UserCheck, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import { PageIntro } from "@/components/layout/page-intro";
import { ButtonLink } from "@/components/ui/button";
import { Card, Eyebrow } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "How MedNet works",
  description:
    "How patients find approved doctors and request care through MedNet, and how MedNet protects access to health information.",
};

/**
 * "How it works" / "About MedNet" (header and footer links). No reference layout; built from the
 * homepage's steps pattern and Phase 3 cards. Every statement reflects implemented backend rules
 * (README "Current scope"; req.md OQ-07 records policy).
 */
const patientSteps = [
  {
    title: "Create a patient account",
    text: "Sign up with your email and verify it, or continue with Google where it is enabled. Then complete your patient profile.",
  },
  {
    title: "Find a doctor and request a time",
    text: "Search approved providers by name or specialty and request one of their open times, in person or by text consultation.",
  },
  {
    title: "The doctor confirms",
    text: "The doctor confirms your request or suggests another time. You are notified in MedNet.",
  },
  {
    title: "Receive care and keep track",
    text: "Attend your appointment, then find released results, records and your own medication and vital entries in one place.",
  },
];

const protections: Array<{ icon: LucideIcon; title: string; text: string }> = [
  {
    icon: UserCheck,
    title: "Approved providers only",
    text: "A provider is listed, and can receive appointment requests, only after a MedNet administrator approves their application.",
  },
  {
    icon: KeyRound,
    title: "Your consent decides",
    text: "A doctor can open your records only with your explicit consent and an active care relationship. You can withdraw consent.",
  },
  {
    icon: EyeOff,
    title: "Administrators don't see clinical details",
    text: "MedNet administrators manage accounts and providers. They do not see the clinical content of your records.",
  },
];

export default function AboutPage() {
  return (
    <main id="main-content">
      <PageIntro
        eyebrow="How MedNet works"
        title="One place for the steps around your care"
        actions={
          <>
            <ButtonLink href="/find-care">Find a doctor</ButtonLink>
            <ButtonLink href="/services" variant="secondary">
              See all services
            </ButtonLink>
          </>
        }
      >
        MedNet helps you find an approved doctor in Liberia, request an appointment and keep track of your care.
        Diagnosis and treatment are provided by healthcare professionals. MedNet does not replace emergency services.
      </PageIntro>

      <section aria-labelledby="patients-title" className="bg-surface-warm">
        <div className="mx-auto max-w-page px-4 py-14 md:px-6 lg:px-8 lg:py-20">
          <Eyebrow tone="action">For patients</Eyebrow>
          <h2
            id="patients-title"
            className="mt-2 text-[1.875rem] leading-[2.25rem] font-normal tracking-[-0.025em] text-green-950 md:text-[2.25rem] md:leading-[2.6rem]"
          >
            From search to care
          </h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-2 xl:grid-cols-4">
            {patientSteps.map(({ title, text }, index) => (
              <li key={title} className="border-t border-[#d8d6cc] pt-6">
                <span aria-hidden className="text-caption font-bold text-action">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-4 text-[1.25rem] leading-[1.875rem] text-ink">{title}</h3>
                <p className="mt-2 text-body text-text-secondary">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="privacy-title" className="mx-auto max-w-page px-4 py-14 md:px-6 lg:px-8 lg:py-20">
        <Eyebrow tone="action">Your privacy</Eyebrow>
        <h2
          id="privacy-title"
          className="mt-2 text-[1.875rem] leading-[2.25rem] font-normal tracking-[-0.025em] text-green-950 md:text-[2.25rem] md:leading-[2.6rem]"
        >
          Access is checked every time
        </h2>
        <p className="mt-3 max-w-2xl text-body text-text-secondary">
          MedNet&rsquo;s servers check who is asking before returning any health information. The website never decides
          on its own who can open a record.
        </p>
        <ul className="mt-10 grid gap-4 md:grid-cols-3">
          {protections.map(({ icon: Icon, title, text }) => (
            <li key={title}>
              <Card as="article" className="h-full">
                <span className="inline-flex size-12 items-center justify-center rounded-sm bg-green-50 text-green-800">
                  <Icon aria-hidden size={22} strokeWidth={1.8} />
                </span>
                <h3 className="mt-5 text-[1.125rem] leading-[1.6875rem] font-bold text-ink">{title}</h3>
                <p className="mt-2 text-body text-text-secondary">{text}</p>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
