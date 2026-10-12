import type { ConsultationMode } from "./provider-api";

/**
 * Appointment times are shown in Liberia time (Africa/Monrovia, GMT, no daylight saving) and
 * labelled as such, so people outside Liberia are not misled about when a text consultation starts.
 */
export const CARE_TIME_ZONE = "Africa/Monrovia";
export const CARE_TIME_ZONE_LABEL = "Liberia time (GMT)";

const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: CARE_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const timeOnly = new Intl.DateTimeFormat("en-US", { timeZone: CARE_TIME_ZONE, hour: "numeric", minute: "2-digit" });
const weekdayDate = new Intl.DateTimeFormat("en-GB", { timeZone: CARE_TIME_ZONE, weekday: "short", day: "numeric", month: "short" });
const longDate = new Intl.DateTimeFormat("en-GB", { timeZone: CARE_TIME_ZONE, weekday: "long", day: "numeric", month: "long" });

/** Calendar day in Liberia time, e.g. "2026-10-14". */
export function careDay(value: string | Date): string {
  return dayKey.format(new Date(value));
}

function relativeDay(value: string | Date, now: Date): string | null {
  const day = careDay(value);
  if (day === careDay(now)) return "Today";
  if (day === careDay(new Date(now.getTime() + 86_400_000))) return "Tomorrow";
  return null;
}

/** "Today, 2:30 PM" · "Tomorrow, 9:00 AM" · "Mon 14 Oct, 9:00 AM" (DoctorCard / reference wording). */
export function formatNextAvailable(value: string, now = new Date()): string {
  return `${relativeDay(value, now) ?? weekdayDate.format(new Date(value))}, ${timeOnly.format(new Date(value))}`;
}

/** Day group heading: "Today" · "Tomorrow" · "Monday 14 October". */
export function formatDayHeading(value: string, now = new Date()): string {
  return relativeDay(value, now) ?? longDate.format(new Date(value));
}

/** "2:30 PM – 3:00 PM" */
export function formatTimeRange(startsAt: string, endsAt: string): string {
  return `${timeOnly.format(new Date(startsAt))} – ${timeOnly.format(new Date(endsAt))}`;
}

/** Full description for confirmations: "Monday 14 October, 2:30 PM – 3:00 PM". */
export function formatSlot(startsAt: string, endsAt: string): string {
  return `${longDate.format(new Date(startsAt))}, ${formatTimeRange(startsAt, endsAt)}`;
}

/** Only the modes the backend supports. There is no video or voice consultation. */
export function consultationModeLabel(mode: ConsultationMode): string {
  if (mode === "IN_PERSON") return "In person";
  if (mode === "TEXT") return "Text consultation";
  return "Consultation";
}

/** Groups slots (already sorted by start) by Liberia calendar day, preserving order. */
export function groupByDay<T extends { startsAt: string }>(slots: T[]): Array<{ day: string; slots: T[] }> {
  const groups: Array<{ day: string; slots: T[] }> = [];
  for (const slot of slots) {
    const day = careDay(slot.startsAt);
    const last = groups.at(-1);
    if (last?.day === day) last.slots.push(slot);
    else groups.push({ day, slots: [slot] });
  }
  return groups;
}
