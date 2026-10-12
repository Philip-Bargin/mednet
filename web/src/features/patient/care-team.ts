import { patientApi, type Appointment, type Conversation, type RecordConsent } from "./patient-api";

/**
 * Providers the patient has a care relationship with, for record sharing and messaging.
 *
 * Built from the patient's own appointments (`providerId`, `providerSpecialty`, added to
 * `AppointmentDetails` in Phase 4D) plus providers already known from consents and conversations.
 * The API still requires a CONFIRMED, COMPLETED or RESCHEDULE_REQUESTED appointment
 * (`PatientCareAccess`) for every consent or message and answers 403 otherwise.
 */
export const CARE_RELATIONSHIP_STATUSES = ["CONFIRMED", "COMPLETED", "RESCHEDULE_REQUESTED"];

export type CareTeamMember = { providerId: string; name: string; specialty: string };

export function careTeamFrom({
  appointments,
  consents,
  conversations,
}: {
  appointments: Appointment[];
  consents: RecordConsent[];
  conversations: Conversation[];
}): CareTeamMember[] {
  const team = new Map<string, CareTeamMember>();
  for (const appointment of appointments) {
    if (CARE_RELATIONSHIP_STATUSES.includes(appointment.status) && appointment.providerId && !team.has(appointment.providerId)) {
      team.set(appointment.providerId, {
        providerId: appointment.providerId,
        name: appointment.providerName,
        specialty: appointment.providerSpecialty ?? "",
      });
    }
  }
  for (const consent of consents) {
    if (!team.has(consent.providerId)) {
      team.set(consent.providerId, { providerId: consent.providerId, name: consent.providerName, specialty: consent.specialty });
    }
  }
  for (const conversation of conversations) {
    if (!team.has(conversation.providerId)) {
      team.set(conversation.providerId, { providerId: conversation.providerId, name: conversation.providerDisplayName, specialty: "" });
    }
  }
  return [...team.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadCareTeam(signal: AbortSignal) {
  const [appointments, consents, conversations] = await Promise.all([
    patientApi.appointments(0, 100, signal),
    patientApi.consents(signal),
    patientApi.conversations(signal),
  ]);
  return { team: careTeamFrom({ appointments: appointments.content, consents, conversations }), consents, conversations };
}
