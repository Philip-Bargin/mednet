import {
  CalendarCheck,
  FlaskConical,
  House,
  MessageSquareText,
  NotebookTabs,
  Search,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import { PageIntro } from "@/components/layout/page-intro";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Services",
  description:
    "What MedNet offers today: approved-provider search, appointment requests, text consultations, consent-based records, and laboratory and home care requests.",
};

/**
 * No reference layout (footer link only). Content is limited to the backend's current scope
 * (README "Current scope"); the "Not available" list states the gated workflows plainly.
 */
const services: Array<{ id: string; icon: LucideIcon; title: string; text: string; detail: string }> = [
  {
    id: "find-a-doctor",
    icon: Search,
    title: "Find a doctor",
    text: "Search approved providers by name or specialty and see the appointment times they have open.",
    detail: "Only providers approved by a MedNet administrator are listed.",
  },
  {
    id: "appointments",
    icon: CalendarCheck,
    title: "Appointment requests",
    text: "Request an open time in person or by text consultation. The doctor confirms it or suggests another time.",
    detail: "Patient account and completed patient profile required.",
  },
  {
    id: "consultations",
    icon: MessageSquareText,
    title: "Text consultations and messages",
    text: "Confirmed appointments can open a text consultation, and you can message providers you already receive care from.",
    detail: "Text only. Attachments, video and voice calls are not available.",
  },
  {
    id: "records",
    icon: NotebookTabs,
    title: "Your health information",
    text: "Keep your records, medication schedules with daily reminders, and the vital signs you enter together in one timeline.",
    detail: "Doctors see your records only with your consent and an active care relationship.",
  },
  {
    id: "laboratory",
    icon: FlaskConical,
    title: "Laboratory requests",
    text: "Request laboratory services and follow the status. Results are reviewed and released by your doctor before you see them.",
    detail: "Patient account required.",
  },
  {
    id: "home-care",
    icon: House,
    title: "Home care requests",
    text: "Request home care and follow the visit as assigned staff schedule it and update its progress.",
    detail: "Patient account required.",
  },
];

const notAvailable = [
  "Emergency care. MedNet does not replace emergency services.",
  "Online payments, fees or insurance.",
  "Video or voice consultations.",
  "Electronic prescribing.",
];

export default function ServicesPage() {
  return (
    <main id="main-content">
      <PageIntro
        eyebrow="MedNet services"
        title="What you can do with MedNet"
        actions={
          <>
            <ButtonLink href="/find-care">Find a doctor</ButtonLink>
            <ButtonLink href="/sign-in" variant="secondary">
              Sign in or create an account
            </ButtonLink>
          </>
        }
      >
        Find an approved doctor, request an appointment, and keep track of your care. The services below are
        available today.
      </PageIntro>

      <section aria-labelledby="services-title" className="mx-auto max-w-page px-4 py-14 md:px-6 lg:px-8 lg:py-20">
        <h2 id="services-title" className="sr-only">
          Available services
        </h2>
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {services.map(({ id, icon: Icon, title, text, detail }) => (
            <li key={id} id={id} className="scroll-mt-6">
              <Card as="article" className="flex h-full flex-col">
                <span className="inline-flex size-12 items-center justify-center rounded-sm bg-green-50 text-green-800">
                  <Icon aria-hidden size={22} strokeWidth={1.8} />
                </span>
                <h3 className="mt-5 text-[1.125rem] leading-[1.6875rem] font-bold text-ink">{title}</h3>
                <p className="mt-2 mb-5 text-body text-text-secondary">{text}</p>
                <p className="mt-auto border-t border-border pt-4 text-caption text-text-muted">
                  {detail}
                </p>
              </Card>
            </li>
          ))}
        </ul>

        <div className="mt-12 max-w-3xl">
          <Alert tone="info" title="Not available on MedNet">
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {notAvailable.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Alert>
        </div>
      </section>
    </main>
  );
}
