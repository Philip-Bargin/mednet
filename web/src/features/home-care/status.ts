import type { BadgeTone } from "@/components/ui/badge";
import type { TimelineStep } from "@/components/healthcare/status-timeline";
import type { HomeCareRequest } from "./home-care-api";

/**
 * Home-care view of `service_requests.status` (V8) plus `scheduled_at`. The assigned staff member sets
 * the visit time once (OPEN), starts the visit (IN_PROGRESS) and completes it (RESOLVED). The patient
 * can cancel while it is OPEN; an administrator while it is OPEN or IN_PROGRESS.
 */
export type HomeCareStage = "unscheduled" | "scheduled" | "in-progress" | "completed" | "cancelled" | "other";

export function homeCareStage(request: HomeCareRequest): HomeCareStage {
  switch (request.status) {
    case "OPEN":
      return request.scheduledAt ? "scheduled" : "unscheduled";
    case "IN_PROGRESS":
      return "in-progress";
    case "RESOLVED":
      return "completed";
    case "CANCELLED":
      return "cancelled";
    default:
      return "other";
  }
}

export const HOME_CARE_STAGE: Record<Exclude<HomeCareStage, "other">, { label: string; tone: BadgeTone }> = {
  unscheduled: { label: "Needs a visit time", tone: "warning" },
  scheduled: { label: "Visit scheduled", tone: "info" },
  "in-progress": { label: "Visit in progress", tone: "info" },
  completed: { label: "Completed", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export function homeCareBadge(request: HomeCareRequest): { label: string; tone: BadgeTone } {
  const stage = homeCareStage(request);
  return stage === "other"
    ? { label: request.status.replaceAll("_", " ").toLowerCase(), tone: "neutral" }
    : HOME_CARE_STAGE[stage];
}

/** "HCR-3F2A9C1E": the same 8 characters administrators see as "Request 3F2A9C1E". No patient data. */
export function homeCareReference(id: string): string {
  return `HCR-${id.replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

export type HomeCareCounts = Record<Exclude<HomeCareStage, "other">, number> & { total: number };

export function countHomeCare(requests: HomeCareRequest[]): HomeCareCounts {
  const counts: HomeCareCounts = { unscheduled: 0, scheduled: 0, "in-progress": 0, completed: 0, cancelled: 0, total: requests.length };
  for (const request of requests) {
    const stage = homeCareStage(request);
    if (stage !== "other") counts[stage] += 1;
  }
  return counts;
}

/** Open work first (unscheduled, then by visit time), then the rest newest first. */
export function sortForQueue(requests: HomeCareRequest[]): HomeCareRequest[] {
  const rank: Record<HomeCareStage, number> = { unscheduled: 0, "in-progress": 1, scheduled: 2, completed: 3, cancelled: 4, other: 5 };
  return [...requests].sort((a, b) => {
    const byStage = rank[homeCareStage(a)] - rank[homeCareStage(b)];
    if (byStage) return byStage;
    if (homeCareStage(a) === "scheduled") return (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? "");
    return b.createdAt.localeCompare(a.createdAt);
  });
}

/** The supported stages for one request. */
export function homeCareTimeline(request: HomeCareRequest, format: (iso: string) => string): TimelineStep[] {
  const stage = homeCareStage(request);
  const cancelled = stage === "cancelled";
  const scheduled = Boolean(request.scheduledAt);
  const started = stage === "in-progress" || stage === "completed";
  const completed = stage === "completed";
  return [
    { id: "assigned", title: "Assigned to you by MedNet", state: "complete", detail: `Requested ${format(request.createdAt)}` },
    {
      id: "scheduled",
      title: "Visit time set",
      state: scheduled ? "complete" : cancelled ? "locked" : "current",
      stateLabel: scheduled ? "Scheduled" : cancelled ? "Cancelled" : "Set a time",
      detail: request.scheduledAt ? format(request.scheduledAt) : undefined,
    },
    {
      id: "started",
      title: "Visit started",
      state: started ? "complete" : cancelled ? "locked" : scheduled ? "current" : "pending",
      stateLabel: started ? "Started" : cancelled ? "Cancelled" : "Not started",
    },
    {
      id: "completed",
      title: "Visit completed",
      state: completed ? "complete" : cancelled ? "locked" : started ? "current" : "pending",
      stateLabel: completed ? "Completed" : cancelled ? "Cancelled" : "Not completed",
      detail: completed ? `Updated ${format(request.updatedAt)}` : undefined,
    },
  ];
}

/**
 * `datetime-local` value (Liberia time, GMT = UTC, no daylight saving) to an ISO instant, or null when
 * it is not a valid time.
 */
export function visitTimeToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** `datetime-local` value for a moment, in Liberia time. */
export function toVisitInput(date: Date): string {
  return date.toISOString().slice(0, 16);
}
