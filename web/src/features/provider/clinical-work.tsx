"use client";

import { useState } from "react";
import { FlaskConical, Lock, MessageSquareText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { ActivityList, ActivityRow } from "@/components/ui/lists";
import { StateMessage } from "@/components/ui/state-message";
import { formatShortDate } from "@/features/patient/format";
import { CountBadge, PrivacyCard, ViewBand, ViewColumns } from "@/features/patient/view-frame";
import { ErrorRow, LoadingRows } from "@/features/workspace/states";
import { useResource } from "@/features/workspace/use-resource";
import { providerApi, type ReviewQueueEntry, type ReviewQueuePage } from "./provider-api";

/** Patients per page in the clinical-work queue. */
export const REVIEW_PAGE_SIZE = 20;

/**
 * Results waiting for review across the provider's care patients, from one paged call
 * (`GET /providers/me/lab-review-queue`, Phase 5D). It replaces one request per patient, which stopped
 * after 25 patients and the first 100 appointments. Patients without record access are included so the
 * page can say so; no result text is loaded here.
 */
export function loadReviewQueue(signal: AbortSignal, page = 0, size = REVIEW_PAGE_SIZE): Promise<ReviewQueuePage> {
  return providerApi.reviewQueue(page, size, signal);
}

export function patientLabel(entry: ReviewQueueEntry): string {
  return entry.patientName ?? "Patient (profile not completed)";
}

export function ProviderClinicalWork() {
  const [page, setPage] = useState(0);
  const { resource, reload } = useResource((signal) => loadReviewQueue(signal, page), `review-${page}`);
  const content = resource.state === "ready" ? resource.data.content : [];
  const withResults = content.filter((entry) => entry.recordAccess && entry.pendingResults > 0);
  const noAccess = content.filter((entry) => !entry.recordAccess);
  const total = resource.state === "ready" ? resource.data.totalPendingResults : 0;

  return (
    <>
      <ViewBand eyebrow="Doctor workspace" title="Clinical work" description="Laboratory results waiting for your review, and patients whose records you cannot open yet." />
      <ViewColumns
        aside={
          <PrivacyCard>
            Results are listed only for patients with a care relationship who have allowed you access. Releasing a result shows
            it to the patient and adds it to their record.
          </PrivacyCard>
        }
      >
        <Card>
          <CardHeader eyebrow="Current view" title="Results to review" action={resource.state === "ready" ? <CountBadge count={total} noun="result" /> : undefined} />
          <div className="mt-4 border-t border-border">
            {resource.state === "loading" ? (
              <LoadingRows label="Loading results to review" />
            ) : resource.state === "error" ? (
              <ErrorRow title="Results to review could not be loaded." onRetry={reload} status={resource.status} />
            ) : withResults.length ? (
              <ActivityList label="Patients with results to review">
                {withResults.map((entry) => (
                  <ActivityRow
                    key={entry.patientAccountId}
                    icon={FlaskConical}
                    tileTone="warning"
                    title={patientLabel(entry)}
                    meta={`${entry.pendingResults} ${entry.pendingResults === 1 ? "result" : "results"}${entry.oldestPendingAt ? ` · oldest ${formatShortDate(entry.oldestPendingAt)}` : ""}`}
                    trailing={<Badge tone="warning">Doctor review</Badge>}
                    href={`/provider/patients/${encodeURIComponent(entry.patientAccountId)}?tab=results`}
                  />
                ))}
              </ActivityList>
            ) : (
              <StateMessage kind="empty" layout="inline" className="mt-4" title="No laboratory results are waiting for you." />
            )}
          </div>
        </Card>

        {noAccess.length ? (
          <Card>
            <CardHeader
              eyebrow="Access"
              title="Records not shared with you"
              action={<CountBadge count={resource.state === "ready" ? resource.data.patientsWithoutRecordAccess : noAccess.length} noun="patient" />}
            />
            <p className="mt-1.5 text-data text-text-secondary">
              These patients have a care relationship with you but have not allowed you to see their records, so their results
              cannot be shown.
            </p>
            <div className="mt-4 border-t border-border">
              <ActivityList label="Patients without record access">
                {noAccess.map((entry) => (
                  <ActivityRow key={entry.patientAccountId} icon={Lock} title={patientLabel(entry)} meta="Patient has not allowed access" />
                ))}
              </ActivityList>
            </div>
          </Card>
        ) : null}

        {resource.state === "ready" && resource.data.totalPages > 1 ? (
          <Pagination
            page={resource.data.number + 1}
            totalPages={resource.data.totalPages}
            onPageChange={(next) => setPage(next - 1)}
            label="Review queue pages"
          />
        ) : null}

        <Card>
          <CardHeader eyebrow="Not available" title="Other clinical tools" titleAs="h3" />
          <ActivityList label="Unavailable tools">
            <ActivityRow icon={MessageSquareText} title="Encounter note drafts" meta="Records are added directly from a patient’s page; drafts are not supported." />
            <ActivityRow icon={FlaskConical} title="Laboratory orders and electronic prescribing" meta="Not available on MedNet. Patients request laboratory tests themselves." />
          </ActivityList>
        </Card>
      </ViewColumns>
    </>
  );
}
