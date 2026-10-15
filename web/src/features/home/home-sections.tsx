import { FlaskConical, LockKeyhole, MessageSquareText, ShieldCheck, type LucideIcon } from "lucide-react";
import { Eyebrow } from "@/components/ui/card";

/**
 * Reference: the dark green four-point band and "Care in three clear steps".
 *
 * The reference band promises fixed fees, payment authorisation and provider payout tracking, and
 * its steps include paying online. Payments are out of scope (AGENTS.md), so each point is replaced
 * by a capability the backend actually provides (README "Current scope"). Layout and styling follow
 * the reference measurements: band 48px padding on green-950; steps 88px padding on the warm surface.
 */
const assurances: Array<{ icon: LucideIcon; title: string; text: string }> = [
  {
    icon: ShieldCheck,
    title: "Approved provider profiles",
    text: "Providers are listed only after a MedNet administrator approves their application.",
  },
  {
    icon: MessageSquareText,
    title: "In person or by text",
    text: "Choose an open time in the consultation mode each doctor offers.",
  },
  {
    icon: LockKeyhole,
    title: "Records shared with consent",
    text: "Doctors see your records only with your consent and an active care relationship.",
  },
  {
    icon: FlaskConical,
    title: "Laboratory and home care",
    text: "Request laboratory or home care services and follow their progress.",
  },
];

const steps = [
  {
    title: "Choose your doctor",
    text: "Compare approved doctors by specialty and the appointment times they have open.",
  },
  {
    title: "Request a time",
    text: "Pick an open time and send a request. The doctor confirms it and MedNet lets you know.",
  },
  {
    title: "Receive care",
    text: "Attend in person or join the text consultation. Results your doctor releases appear in your records.",
  },
];

export function HomeAssurances() {
  return (
    <section aria-label="How MedNet protects your care" className="bg-green-950 text-white">
      <ul className="mx-auto grid max-w-page gap-8 px-4 py-12 md:grid-cols-2 md:px-6 lg:px-8 xl:grid-cols-4 xl:gap-11">
        {assurances.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-4">
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-sm bg-white/10 text-green-100">
              <Icon aria-hidden size={20} strokeWidth={1.8} />
            </span>
            <div className="min-w-0">
              <h3 className="text-[1.0625rem] leading-[1.6rem] text-white">{title}</h3>
              <p className="mt-1 text-data text-green-100">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function HomeSteps() {
  return (
    <section aria-labelledby="steps-title" className="bg-surface-warm">
      <div className="mx-auto max-w-page px-4 py-16 md:px-6 lg:px-8 lg:py-[5.5rem]">
        <div className="text-center">
          <Eyebrow tone="action">Simple from the start</Eyebrow>
          <h2
            id="steps-title"
            className="mt-2 text-[1.875rem] leading-[2.25rem] font-normal tracking-[-0.025em] text-green-950 md:text-[2.25rem] md:leading-[2.6rem]"
          >
            Care in three clear steps
          </h2>
        </div>
        <ol className="mt-12 grid gap-8 md:grid-cols-3 md:gap-8">
          {steps.map(({ title, text }, index) => (
            <li key={title} className="border-t border-[#d8d6cc] pt-8">
              <span aria-hidden className="text-caption font-bold text-action">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-6 text-[1.375rem] leading-[2.0625rem] text-ink md:mt-9">{title}</h3>
              <p className="mt-3 max-w-[22rem] text-body text-text-secondary">{text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
