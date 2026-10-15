import { describe, expect, it } from "vitest";
import { careTeamFrom } from "./care-team";
import { formatDuration, formatHeaderDate, formatWhen, greeting, nextAppointment, recordCategoryLabel, sortAppointments } from "./format";
import { recentMedicalActivity } from "./overview";
import type { Appointment, ClinicalRecord, LabResult } from "./patient-api";

const now = new Date("2026-10-11T09:00:00Z"); // 09:00 in Monrovia (GMT)

function appointment(id: string, status: string, startsAt: string, providerName = "Dr. Ama Doe"): Appointment {
  const end = new Date(new Date(startsAt).getTime() + 30 * 60_000).toISOString();
  return {
    id,
    patientAccountId: "me",
    status,
    patientName: "Me",
    providerName,
    consultationMode: "TEXT",
    startsAt,
    endsAt: end,
    proposedStartsAt: null,
    proposedEndsAt: null,
    createdAt: startsAt,
    updatedAt: startsAt,
  };
}

describe("patient formatting (Liberia time)", () => {
  it("greets by time of day with the first name only", () => {
    expect(greeting("James Brown", now)).toBe("Good morning, James");
    expect(greeting("  ", new Date("2026-10-11T13:00:00Z"))).toBe("Good afternoon");
    expect(greeting(null, new Date("2026-10-11T19:30:00Z"))).toBe("Good evening");
  });

  it("formats the top-bar date and relative appointment times", () => {
    expect(formatHeaderDate(now)).toBe("Sunday, 11 October");
    expect(formatWhen("2026-10-11T14:30:00Z", now)).toBe("Today at 2:30 PM");
    expect(formatWhen("2026-10-12T09:00:00Z", now)).toBe("Tomorrow at 9:00 AM");
    expect(formatWhen("2026-10-20T09:00:00Z", now)).toBe("20 October 2026 at 9:00 AM");
  });

  it("describes durations in words", () => {
    expect(formatDuration("2026-10-11T09:00:00Z", "2026-10-11T09:30:00Z")).toBe("30 minutes");
    expect(formatDuration("2026-10-11T09:00:00Z", "2026-10-11T10:00:00Z")).toBe("1 hour");
    expect(formatDuration("2026-10-11T09:00:00Z", "2026-10-11T10:15:00Z")).toBe("1 hour 15 minutes");
  });

  it("labels record categories without inventing unknown ones", () => {
    expect(recordCategoryLabel("ENCOUNTER_SUMMARY")).toBe("Visit summary");
    expect(recordCategoryLabel("NEW_KIND")).toBe("new kind");
  });
});

describe("appointment ordering", () => {
  const list = [
    appointment("later", "CONFIRMED", "2026-10-15T09:00:00Z"),
    appointment("soon", "PENDING", "2026-10-12T09:00:00Z"),
    appointment("cancelled", "CANCELLED", "2026-10-11T12:00:00Z"),
    appointment("past", "COMPLETED", "2026-10-01T09:00:00Z"),
    appointment("ended", "CONFIRMED", "2026-10-10T09:00:00Z"),
  ];

  it("picks the soonest active appointment that has not ended", () => {
    expect(nextAppointment(list, now)?.id).toBe("soon");
    expect(nextAppointment([list[2], list[3]], now)).toBeUndefined();
  });

  it("splits upcoming from past and closed", () => {
    const { upcoming, past } = sortAppointments(list, now);
    expect(upcoming.map((item) => item.id)).toEqual(["soon", "later"]);
    expect(past.map((item) => item.id)).toEqual(["cancelled", "ended", "past"]);
  });
});

describe("care team", () => {
  const withProvider = (a: Appointment, providerId: string, providerSpecialty: string): Appointment => ({ ...a, providerId, providerSpecialty });

  it("uses the provider id from appointments with a care relationship, plus consents and conversations", () => {
    const team = careTeamFrom({
      appointments: [
        withProvider(appointment("a", "COMPLETED", "2026-10-01T09:00:00Z", "Dr. Ama Doe"), "p-doe", "General medicine"),
        withProvider(appointment("a2", "CONFIRMED", "2026-10-13T09:00:00Z", "Dr. Ama Doe"), "p-doe", "General medicine"),
        withProvider(appointment("b", "PENDING", "2026-10-12T09:00:00Z", "Dr. Other"), "p-other", "Dermatology"),
        withProvider(appointment("c", "DECLINED", "2026-10-12T09:00:00Z", "Dr. Samuel Kollie"), "p-kollie", "Pediatrics"),
      ],
      consents: [{ providerId: "p-gone", providerName: "Dr. Former", specialty: "Surgery", status: "REVOKED", grantedAt: null, revokedAt: null }],
      conversations: [
        { id: "c1", patientAccountId: "me", providerId: "p-kollie", providerDisplayName: "Dr. Samuel Kollie", createdAt: "", updatedAt: "" },
      ],
    });
    expect(team).toEqual([
      { providerId: "p-doe", name: "Dr. Ama Doe", specialty: "General medicine" },
      { providerId: "p-gone", name: "Dr. Former", specialty: "Surgery" },
      { providerId: "p-kollie", name: "Dr. Samuel Kollie", specialty: "" },
    ]);
  });
});

describe("recent medical activity", () => {
  it("merges records and released results, newest first, with links", () => {
    const records: ClinicalRecord[] = [
      { id: "r1", category: "PRESCRIPTION", title: "Amoxicillin", clinicalCode: null, summary: "", effectiveAt: "2026-10-05T09:00:00Z", createdAt: "", amendsRecordId: null, authorName: "Dr. Doe" },
      { id: "r2", category: "ALLERGY", title: "Penicillin", clinicalCode: null, summary: "", effectiveAt: "2026-09-01T09:00:00Z", createdAt: "", amendsRecordId: null, authorName: "Dr. Doe" },
    ];
    const results: LabResult[] = [{ id: "l1", requestId: "q", summary: "", status: "RELEASED", createdAt: "2026-10-01T00:00:00Z", reviewedAt: "2026-10-08T09:00:00Z" }];
    const items = recentMedicalActivity(records, results, 2);
    expect(items.map((item) => [item.id, item.kind])).toEqual([
      ["lab-l1", "lab-result"],
      ["record-r1", "prescription"],
    ]);
    expect(items[1].href).toBe("/patient/records?record=r1");
    expect(recentMedicalActivity(records, [], 4)[1].kind).toBe("document");
  });
});
