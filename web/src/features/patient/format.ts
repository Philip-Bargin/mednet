import { CARE_TIME_ZONE, careDay } from "@/features/find-care/format";
import type { Appointment } from "./patient-api";

/** Dates are shown in Liberia time like the rest of the care experience (see find-care/format). */
const hourOnly = new Intl.DateTimeFormat("en-GB", { timeZone: CARE_TIME_ZONE, hour: "numeric", hourCycle: "h23" });
const headerDate = new Intl.DateTimeFormat("en-GB", { timeZone: CARE_TIME_ZONE, weekday: "long", day: "numeric", month: "long" });
const dayMonthYear = new Intl.DateTimeFormat("en-GB", { timeZone: CARE_TIME_ZONE, day: "numeric", month: "long", year: "numeric" });
const dayMonth = new Intl.DateTimeFormat("en-GB", { timeZone: CARE_TIME_ZONE, day: "numeric", month: "short" });
const time = new Intl.DateTimeFormat("en-US", { timeZone: CARE_TIME_ZONE, hour: "numeric", minute: "2-digit" });

/** "Monday, 12 August" — the reference's top-bar eyebrow. */
export function formatHeaderDate(now = new Date()): string {
  const [weekday, ...rest] = headerDate.format(now).split(" ");
  return `${weekday.replace(/,$/, "")}, ${rest.join(" ")}`;
}

/** "Good morning, James" — the first word of the profile name; a neutral greeting without one. */
export function greeting(fullName: string | null | undefined, now = new Date()): string {
  const hour = Number(hourOnly.format(now));
  const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const first = fullName?.trim().split(/\s+/)[0];
  return first ? `${part}, ${first}` : part;
}

/** "12 August 2025" */
export function formatDate(value: string | Date): string {
  return dayMonthYear.format(new Date(value));
}

/** "8 Aug" — compact list metadata. */
export function formatShortDate(value: string | Date): string {
  return dayMonth.format(new Date(value));
}

/** "Today at 2:30 PM" · "Tomorrow at 9:00 AM" · "14 October 2026 at 9:00 AM" */
export function formatWhen(value: string, now = new Date()): string {
  const day = careDay(value);
  const label =
    day === careDay(now) ? "Today" : day === careDay(new Date(now.getTime() + 86_400_000)) ? "Tomorrow" : formatDate(value);
  return `${label} at ${time.format(new Date(value))}`;
}

/** "30 minutes" · "1 hour" · "1 hour 15 minutes" */
export function formatDuration(startsAt: string, endsAt: string): string {
  const minutes = Math.max(0, Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60_000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const parts = [hours ? `${hours} ${hours === 1 ? "hour" : "hours"}` : "", rest ? `${rest} ${rest === 1 ? "minute" : "minutes"}` : ""];
  return parts.filter(Boolean).join(" ") || "0 minutes";
}

/** Statuses in which an appointment is still ahead of the patient. */
export const ACTIVE_APPOINTMENT_STATUSES = ["PENDING", "CONFIRMED", "RESCHEDULE_REQUESTED"] as const;

export function isActive(appointment: Appointment): boolean {
  return (ACTIVE_APPOINTMENT_STATUSES as readonly string[]).includes(appointment.status);
}

/** The earliest active appointment that has not ended. */
export function nextAppointment(appointments: Appointment[], now = new Date()): Appointment | undefined {
  return appointments
    .filter((appointment) => isActive(appointment) && new Date(appointment.endsAt) > now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
}

/** Upcoming first (soonest first), then past and closed (most recent first). */
export function sortAppointments(appointments: Appointment[], now = new Date()) {
  const upcoming = appointments
    .filter((appointment) => isActive(appointment) && new Date(appointment.endsAt) > now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = appointments.filter((appointment) => !upcoming.includes(appointment)).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  return { upcoming, past };
}

/** Labels for `clinical_records.category` (CreateRecordRequest pattern). Unknown values fall back to plain text. */
export const RECORD_CATEGORY_LABELS: Record<string, string> = {
  ENCOUNTER_SUMMARY: "Visit summary",
  DIAGNOSIS: "Diagnosis",
  PRESCRIPTION: "Prescription",
  ALLERGY: "Allergy",
  MEDICAL_HISTORY: "Medical history",
  DOCUMENT: "Document",
  /** Created by the backend when a doctor releases a laboratory result. */
  LAB_RESULT: "Laboratory result",
};

export function recordCategoryLabel(category: string): string {
  return RECORD_CATEGORY_LABELS[category] ?? category.replaceAll("_", " ").toLowerCase();
}

export function plural(count: number, noun: string, pluralNoun = `${noun}s`): string {
  return `${count} ${count === 1 ? noun : pluralNoun}`;
}

/** Medical information tabs (`/patient/records?tab=`). Kept out of the client module so server pages can read it. */
export const RECORD_TABS = ["records", "laboratory", "medications", "vitals", "sharing"] as const;
export type RecordTab = (typeof RECORD_TABS)[number];
