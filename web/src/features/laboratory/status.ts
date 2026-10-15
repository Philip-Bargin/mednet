import type { BadgeTone } from "@/components/ui/badge";
import type { TimelineStep } from "@/components/healthcare/status-timeline";
import type { LabRequest, LatestResult } from "./lab-api";

/**
 * Laboratory view of `service_requests.status` (V8 migration). The laboratory moves a request only
 * from OPEN to IN_PROGRESS; it becomes RESOLVED when a doctor releases the result, and CANCELLED when
 * the patient or an administrator cancels it. Nothing here is a specimen or validation state.
 */
export const LAB_REQUEST_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  OPEN: { label: "Not started", tone: "warning" },
  IN_PROGRESS: { label: "Processing", tone: "info" },
  RESOLVED: { label: "Result released", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

export function labRequestStatus(status: string) {
  return LAB_REQUEST_STATUS[status] ?? { label: status.replaceAll("_", " ").toLowerCase(), tone: "neutral" as BadgeTone };
}

/** "LAB-3F2A9C1E": a short, stable reference from the request ID (no patient information). */
export function labReference(id: string): string {
  return `LAB-${id.replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

export type LabCounts = { notStarted: number; processing: number; released: number; cancelled: number; total: number };

export function countRequests(requests: LabRequest[]): LabCounts {
  const by = (status: string) => requests.filter((request) => request.status === status).length;
  return { notStarted: by("OPEN"), processing: by("IN_PROGRESS"), released: by("RESOLVED"), cancelled: by("CANCELLED"), total: requests.length };
}

/**
 * `laboratory_results.status` (V10) as the laboratory sees it. "Released" means a doctor released it
 * to the patient; the laboratory never releases.
 */
export const LAB_RESULT_REVIEW: Record<string, { label: string; tone: BadgeTone }> = {
  PENDING_REVIEW: { label: "Awaiting doctor review", tone: "warning" },
  RETURNED: { label: "Returned by doctor", tone: "critical" },
  RELEASED: { label: "Released to patient", tone: "success" },
};

export function labResultReview(status: string) {
  return LAB_RESULT_REVIEW[status] ?? { label: status.replaceAll("_", " ").toLowerCase(), tone: "neutral" as BadgeTone };
}

/** Queue badge: the request status, refined by the latest result while the order is processing. */
export function orderBadge(request: LabRequest, latest: LatestResult | null | undefined) {
  if (request.status === "IN_PROGRESS" && latest?.status === "PENDING_REVIEW") return LAB_RESULT_REVIEW.PENDING_REVIEW;
  if (request.status === "IN_PROGRESS" && latest?.status === "RETURNED") return { label: "Returned · correction needed", tone: "critical" as BadgeTone };
  return labRequestStatus(request.status);
}

/** The supported request stages, from the request status and the laboratory's latest result. */
export function requestTimeline(request: LabRequest, latest: LatestResult | null | undefined, format: (iso: string) => string): TimelineStep[] {
  const cancelled = request.status === "CANCELLED";
  const started = request.status === "IN_PROGRESS" || request.status === "RESOLVED";
  const released = request.status === "RESOLVED";
  const pending = latest?.status === "PENDING_REVIEW";
  const returned = !released && latest?.status === "RETURNED";
  return [
    { id: "assigned", title: "Assigned to your laboratory", state: "complete", detail: `Received ${format(request.createdAt)}` },
    {
      id: "processing",
      title: "Processing started",
      state: cancelled ? "locked" : started ? "complete" : "current",
      stateLabel: cancelled ? "Cancelled" : started ? "Started" : "Not started",
    },
    {
      id: "result",
      title: "Result submitted for doctor review",
      state: cancelled ? "locked" : released || pending ? "complete" : returned ? "required" : started ? "current" : "pending",
      stateLabel: cancelled
        ? "Cancelled"
        : released
          ? "Submitted"
          : pending
            ? "Awaiting doctor review"
            : returned
              ? "Returned · submit a correction"
              : started
                ? "Enter result"
                : "Pending",
      detail: latest && !released ? `${pending ? "Sent" : "Returned"} ${format(pending ? latest.createdAt : (latest.reviewedAt ?? latest.createdAt))}` : undefined,
    },
    {
      id: "released",
      title: "Released to the patient by a doctor",
      state: released ? "complete" : "locked",
      stateLabel: released ? "Released" : cancelled ? "Cancelled" : "Doctor decides",
      detail: released ? `Updated ${format(latest?.reviewedAt ?? request.updatedAt)}` : undefined,
    },
  ];
}
