import { Video, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardHeader } from "@/components/ui/card";
import { DescriptionList } from "@/components/ui/lists";
import { AppointmentStatusBadge } from "./status";

/**
 * Reference: Card/Appointment (compact: date tile · status · mode · doctor and time · action).
 */
export function AppointmentCard({
  day,
  month,
  status,
  mode,
  doctorName,
  time,
  action,
}: {
  day: string;
  month: string;
  /** Backend appointment status, e.g. "CONFIRMED". */
  status: string;
  mode: string;
  doctorName: string;
  time: string;
  action?: ReactNode;
}) {
  return (
    <Card as="article" padding="sm" className="flex flex-wrap items-center gap-4">
      <p className="flex size-14 shrink-0 flex-col items-center justify-center rounded-sm bg-green-50 text-green-900">
        <span className="text-title leading-none font-bold">{day}</span>
        <span className="text-caption">{month}</span>
      </p>
      <div className="min-w-0 flex-1">
        <AppointmentStatusBadge status={status} />
        <p className="mt-1.5 font-semibold text-ink">{mode}</p>
        <p className="text-caption text-text-secondary">
          {doctorName} · {time}
        </p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </Card>
  );
}

/**
 * Reference: patient "Next appointment" panel — when, doctor, consultation mode, then
 * Date / Duration / Fixed cost, then actions. "Fixed cost" is displayed information only.
 */
export function AppointmentSummary({
  when,
  status,
  doctorName,
  specialty,
  mode,
  modeIcon: ModeIcon = Video,
  details,
  actions,
}: {
  when: string;
  status: string;
  doctorName: string;
  specialty: string;
  mode: string;
  /** Glyph for the consultation mode; the reference shows a camera for its video consultation. */
  modeIcon?: LucideIcon;
  details: Array<{ term: string; detail: ReactNode }>;
  actions?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader eyebrow="Next appointment" title={when} action={<AppointmentStatusBadge status={status} />} />
      <div className="mt-5 flex flex-wrap items-center gap-4 border-y border-border py-4">
        <Avatar name={doctorName} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-ink">{doctorName}</p>
          <p className="text-data text-text-secondary">{specialty}</p>
        </div>
        <p className="inline-flex items-center gap-2 text-data font-semibold text-green-800">
          <ModeIcon aria-hidden size={18} strokeWidth={1.8} />
          {mode}
        </p>
      </div>
      <DescriptionList items={details} columns={3} className="mt-4" />
      {actions ? <div className="mt-5 flex flex-wrap gap-3">{actions}</div> : null}
    </Card>
  );
}
