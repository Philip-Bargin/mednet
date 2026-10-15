import { CalendarDays, Check, FileText, Heart, Stethoscope, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ActivityList, ActivityRow, DescriptionList, RestrictedNotice } from "@/components/ui/lists";
import { Badge } from "@/components/ui/badge";

/**
 * Reference: patient "Recent activity" medical information list. Each record type keeps the
 * glyph the reference uses (stethoscope, heart, check, calendar). The component only displays
 * records the API already returned — it adds no clinical interpretation.
 */
export type MedicalRecordKind = "visit-summary" | "lab-result" | "prescription" | "consultation" | "document";

const kindIcons: Record<MedicalRecordKind, LucideIcon> = {
  "visit-summary": Stethoscope,
  "lab-result": Heart,
  prescription: Check,
  consultation: CalendarDays,
  /** Other clinical record categories (diagnosis, allergy, history, document); not in the reference. */
  document: FileText,
};

export type MedicalRecordItem = {
  id: string;
  kind: MedicalRecordKind;
  title: string;
  meta: string;
  /** Badge already chosen by the caller (e.g. `<LabResultStatusBadge />`). */
  status?: ReactNode;
  href?: string;
};

export function MedicalRecordList({ records, label = "Recent medical information" }: { records: MedicalRecordItem[]; label?: string }) {
  return (
    <ActivityList label={label}>
      {records.map((record) => (
        <ActivityRow
          key={record.id}
          icon={kindIcons[record.kind]}
          title={record.title}
          meta={record.meta}
          trailing={record.status}
          href={record.href}
        />
      ))}
    </ActivityList>
  );
}

/**
 * Reference: operations "Order detail" / "Pickup detail" patient block — a patient reference,
 * only the context the role is authorised to see, and the restriction note. Never shows names
 * or clinical history unless the caller passes them from an authorised API response.
 */
export function PatientSummary({
  patientReference,
  fields,
  restriction,
  privacyLabel,
}: {
  patientReference: string;
  fields: Array<{ term: string; detail: ReactNode }>;
  restriction: ReactNode;
  /** e.g. "Private" — shown as a neutral badge. */
  privacyLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-data text-text-secondary">
          Patient reference <span className="font-semibold text-ink">{patientReference}</span>
        </p>
        {privacyLabel ? <Badge tone="neutral">{privacyLabel}</Badge> : null}
      </div>
      <DescriptionList items={fields} columns={2} />
      <RestrictedNotice>{restriction}</RestrictedNotice>
    </div>
  );
}
