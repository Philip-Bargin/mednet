import { Badge, type BadgeTone } from "@/components/ui/badge";

/**
 * Status vocabularies come from the backend's database constraints — never invented here.
 * Labels follow the reference's wording where it shows the state, otherwise plain language.
 */
type StatusPresentation = { label: string; tone: BadgeTone };

/** `appointments.status` (V6 migration). */
export const APPOINTMENT_STATUS: Record<string, StatusPresentation> = {
  PENDING: { label: "Pending", tone: "warning" },
  CONFIRMED: { label: "Confirmed", tone: "success" },
  RESCHEDULE_REQUESTED: { label: "Reschedule requested", tone: "warning" },
  DECLINED: { label: "Declined", tone: "critical" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
  COMPLETED: { label: "Completed", tone: "success" },
};

/**
 * `laboratory_results.status` (V10 migration). The reference shows "Doctor review" for a result
 * awaiting the ordering doctor and "Available" once released to the patient.
 */
export const LAB_RESULT_STATUS: Record<string, StatusPresentation> = {
  PENDING_REVIEW: { label: "Doctor review", tone: "warning" },
  RELEASED: { label: "Available", tone: "info" },
  RETURNED: { label: "Returned to laboratory", tone: "critical" },
};

/** Home-care and laboratory `service_requests.status` (V8 migration). */
export const SERVICE_REQUEST_STATUS: Record<string, StatusPresentation> = {
  OPEN: { label: "Open", tone: "info" },
  IN_PROGRESS: { label: "In progress", tone: "warning" },
  RESOLVED: { label: "Resolved", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

function presentation(map: Record<string, StatusPresentation>, status: string): StatusPresentation {
  // Unknown values render neutrally with the raw value rather than guessing a meaning.
  return map[status] ?? { label: status.replaceAll("_", " ").toLowerCase(), tone: "neutral" };
}

export function AppointmentStatusBadge({ status }: { status: string }) {
  const { label, tone } = presentation(APPOINTMENT_STATUS, status);
  return <Badge tone={tone}>{label}</Badge>;
}

export function LabResultStatusBadge({ status }: { status: string }) {
  const { label, tone } = presentation(LAB_RESULT_STATUS, status);
  return <Badge tone={tone}>{label}</Badge>;
}

export function ServiceRequestStatusBadge({ status }: { status: string }) {
  const { label, tone } = presentation(SERVICE_REQUEST_STATUS, status);
  return <Badge tone={tone}>{label}</Badge>;
}
