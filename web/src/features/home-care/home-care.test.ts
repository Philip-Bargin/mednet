import { describe, expect, it } from "vitest";
import type { HomeCareRequest } from "./home-care-api";
import {
  countHomeCare,
  homeCareBadge,
  homeCareReference,
  homeCareStage,
  homeCareTimeline,
  sortForQueue,
  toVisitInput,
  visitTimeToIso,
} from "./status";

const request = (status: string, extra: Partial<HomeCareRequest> = {}): HomeCareRequest => ({
  id: "3f2a9c1e-55b0-4d4e-9a37-0c1d2e3f4a5b",
  requestType: "HOME_CARE",
  requestedService: "Wound dressing",
  locationDescription: "Sinkor, near the clinic",
  status,
  scheduledAt: null,
  createdAt: "2026-10-10T09:00:00Z",
  updatedAt: "2026-10-11T09:00:00Z",
  ...extra,
});
const format = (iso: string) => iso.slice(0, 16);
const states = (steps: ReturnType<typeof homeCareTimeline>) => steps.map((step) => `${step.id}:${step.state}`);

describe("home-care request presentation", () => {
  it("derives the stage from the backend status and visit time only", () => {
    expect(homeCareStage(request("OPEN"))).toBe("unscheduled");
    expect(homeCareStage(request("OPEN", { scheduledAt: "2026-10-12T10:00:00Z" }))).toBe("scheduled");
    expect(homeCareStage(request("IN_PROGRESS", { scheduledAt: "2026-10-12T10:00:00Z" }))).toBe("in-progress");
    expect(homeCareStage(request("RESOLVED"))).toBe("completed");
    expect(homeCareStage(request("CANCELLED"))).toBe("cancelled");
    expect(homeCareBadge(request("SOMETHING_NEW"))).toEqual({ label: "something new", tone: "neutral" });
  });

  it("uses the same characters as the administrator's request reference, with no patient information", () => {
    expect(homeCareReference("3f2a9c1e-55b0-4d4e-9a37-0c1d2e3f4a5b")).toBe("HCR-3F2A9C1E");
  });

  it("counts requests by stage", () => {
    expect(
      countHomeCare([
        request("OPEN"),
        request("OPEN", { scheduledAt: "2026-10-12T10:00:00Z" }),
        request("IN_PROGRESS"),
        request("RESOLVED"),
        request("RESOLVED"),
        request("CANCELLED"),
      ]),
    ).toEqual({ unscheduled: 1, scheduled: 1, "in-progress": 1, completed: 2, cancelled: 1, total: 6 });
  });

  it("puts work that needs action first and scheduled visits in time order", () => {
    const later = request("OPEN", { id: "later", scheduledAt: "2026-10-14T10:00:00Z" });
    const sooner = request("OPEN", { id: "sooner", scheduledAt: "2026-10-12T10:00:00Z" });
    const unscheduled = request("OPEN", { id: "unscheduled" });
    const started = request("IN_PROGRESS", { id: "started", scheduledAt: "2026-10-11T10:00:00Z" });
    const done = request("RESOLVED", { id: "done" });
    expect(sortForQueue([done, later, sooner, started, unscheduled]).map((r) => r.id)).toEqual([
      "unscheduled",
      "started",
      "sooner",
      "later",
      "done",
    ]);
  });

  it("shows each supported stage on the timeline, and locks the rest when cancelled", () => {
    expect(states(homeCareTimeline(request("OPEN"), format))).toEqual([
      "assigned:complete",
      "scheduled:current",
      "started:pending",
      "completed:pending",
    ]);
    expect(states(homeCareTimeline(request("IN_PROGRESS", { scheduledAt: "2026-10-12T10:00:00Z" }), format))).toEqual([
      "assigned:complete",
      "scheduled:complete",
      "started:complete",
      "completed:current",
    ]);
    expect(states(homeCareTimeline(request("CANCELLED"), format))).toEqual([
      "assigned:complete",
      "scheduled:locked",
      "started:locked",
      "completed:locked",
    ]);
  });

  it("reads visit times as Liberia time (GMT) and rejects incomplete input", () => {
    expect(visitTimeToIso("2026-10-12T14:30")).toBe("2026-10-12T14:30:00.000Z");
    expect(visitTimeToIso("2026-10-12")).toBeNull();
    expect(visitTimeToIso("")).toBeNull();
    expect(toVisitInput(new Date("2026-10-12T14:30:45Z"))).toBe("2026-10-12T14:30");
  });
});
