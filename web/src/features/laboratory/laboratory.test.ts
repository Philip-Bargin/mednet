import { describe, expect, it } from "vitest";
import type { LabRequest, SubmittedResult } from "./lab-api";
import { countRequests, labReference, labRequestStatus, labResultReview, orderBadge, requestTimeline } from "./status";

const request = (status: string, extra: Partial<LabRequest> = {}): LabRequest => ({
  id: "3f2a9c1e-55b0-4d4e-9a37-0c1d2e3f4a5b",
  requestType: "LABORATORY",
  requestedService: "Full blood count",
  locationDescription: null,
  status,
  scheduledAt: null,
  createdAt: "2026-10-10T09:00:00Z",
  updatedAt: "2026-10-11T09:00:00Z",
  ...extra,
});
const result = (status: string): SubmittedResult => ({
  id: "res-1",
  requestId: "3f2a9c1e-55b0-4d4e-9a37-0c1d2e3f4a5b",
  summary: "Synthetic",
  status,
  createdAt: "2026-10-11T10:00:00Z",
  reviewedAt: status === "PENDING_REVIEW" ? null : "2026-10-11T12:00:00Z",
});
const format = (iso: string) => iso.slice(0, 10);
const states = (steps: ReturnType<typeof requestTimeline>) => steps.map((step) => `${step.id}:${step.state}`);

describe("laboratory request presentation", () => {
  it("uses only backend statuses and never calls a submitted result released", () => {
    expect(labRequestStatus("OPEN").label).toBe("Not started");
    expect(labRequestStatus("IN_PROGRESS").label).toBe("Processing");
    expect(labRequestStatus("RESOLVED").label).toBe("Result released");
    expect(labRequestStatus("SOMETHING").tone).toBe("neutral");
  });

  it("builds a short reference without patient information", () => {
    expect(labReference("3f2a9c1e-55b0-4d4e-9a37-0c1d2e3f4a5b")).toBe("LAB-3F2A9C1E");
  });

  it("counts requests by status", () => {
    expect(countRequests([request("OPEN"), request("IN_PROGRESS"), request("IN_PROGRESS"), request("RESOLVED"), request("CANCELLED")])).toEqual({
      notStarted: 1,
      processing: 2,
      released: 1,
      cancelled: 1,
      total: 5,
    });
  });

  it("shows only stages the data proves, including a doctor's return", () => {
    expect(states(requestTimeline(request("OPEN"), undefined, format))).toEqual(["assigned:complete", "processing:current", "result:pending", "released:locked"]);
    expect(states(requestTimeline(request("IN_PROGRESS"), undefined, format))).toEqual(["assigned:complete", "processing:complete", "result:current", "released:locked"]);
    const pending = requestTimeline(request("IN_PROGRESS"), result("PENDING_REVIEW"), format);
    expect(states(pending)).toEqual(["assigned:complete", "processing:complete", "result:complete", "released:locked"]);
    expect(pending[2].stateLabel).toBe("Awaiting doctor review");
    expect(pending[3].stateLabel).toBe("Doctor decides");
    const returned = requestTimeline(request("IN_PROGRESS"), result("RETURNED"), format);
    expect(returned[2]).toMatchObject({ state: "required", stateLabel: "Returned · submit a correction" });
    expect(states(requestTimeline(request("RESOLVED"), result("RELEASED"), format)).at(-1)).toBe("released:complete");
    expect(states(requestTimeline(request("CANCELLED"), undefined, format))).toEqual(["assigned:complete", "processing:locked", "result:locked", "released:locked"]);
  });

  it("labels the queue badge from the request and the latest result, never as released by the laboratory", () => {
    expect(orderBadge(request("IN_PROGRESS"), result("PENDING_REVIEW")).label).toBe("Awaiting doctor review");
    expect(orderBadge(request("IN_PROGRESS"), result("RETURNED")).label).toBe("Returned · correction needed");
    expect(orderBadge(request("IN_PROGRESS"), undefined).label).toBe("Processing");
    expect(orderBadge(request("RESOLVED"), result("RELEASED")).label).toBe("Result released");
    expect(labResultReview("RELEASED").label).toBe("Released to patient");
    expect(labResultReview("RETURNED").label).toBe("Returned by doctor");
  });
});
