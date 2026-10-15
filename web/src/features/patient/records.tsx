"use client";

import { FileText, FlaskConical } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LabResultStatusBadge } from "@/components/healthcare/status";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { StateMessage } from "@/components/ui/state-message";
import { Tabs } from "@/components/ui/tabs";
import { cn } from "@/lib/cn";
import { formatDate, recordCategoryLabel, type RecordTab } from "./format";
import { MedicationPanel, VitalPanel } from "./health-tracking";
import { patientApi, type ClinicalRecord, type LabResult } from "./patient-api";
import { ServiceRequestPanel } from "./service-requests";
import { RecordSharingPanel } from "./sharing";
import { useResource } from "@/features/workspace/use-resource";
import { ErrorRow, LoadingRows } from "@/features/workspace/states";
import { CountBadge, PrivacyCard, ViewBand, ViewColumns } from "./view-frame";


export function MedicalInformation({ tab, recordId }: { tab: RecordTab; recordId?: string }) {
  const router = useRouter();
  return (
    <>
      <ViewBand
        title="Medical information"
        description="Records your doctors have added, released laboratory results, and the health details you track yourself."
        action={
          <ButtonLink href="/patient/records?tab=sharing" variant="inverse">
            Manage record sharing
          </ButtonLink>
        }
      />
      <ViewColumns
        aside={
          <PrivacyCard>
            Doctors can read your records only while they have a confirmed appointment with you and your permission. You
            can withdraw permission at any time under Sharing.
          </PrivacyCard>
        }
      >
        {/* Only the active panel is mounted, so each tab loads fresh data when opened. */}
        <Tabs
          label="Medical information"
          value={tab}
          onChange={(id) => router.replace(id === "records" ? "/patient/records" : `/patient/records?tab=${id}`, { scroll: false })}
          items={[
            { id: "records", label: "Records", content: tab === "records" ? <RecordList selectedId={recordId} /> : null },
            {
              id: "laboratory",
              label: "Laboratory",
              content:
                tab === "laboratory" ? (
                  <div className="flex flex-col gap-6">
                    <LabResultList />
                    <ServiceRequestPanel kind="lab" />
                  </div>
                ) : null,
            },
            { id: "medications", label: "Medications", content: tab === "medications" ? <MedicationPanel /> : null },
            { id: "vitals", label: "Vitals", content: tab === "vitals" ? <VitalPanel /> : null },
            { id: "sharing", label: "Sharing", content: tab === "sharing" ? <RecordSharingPanel /> : null },
          ]}
        />
      </ViewColumns>
    </>
  );
}

const RECORD_PAGE_SIZE = 10;

function RecordList({ selectedId }: { selectedId?: string }) {
  const [page, setPage] = useState(1);
  const { resource, reload } = useResource((signal) => patientApi.records(page - 1, RECORD_PAGE_SIZE, signal), String(page));

  return (
    <Card>
      <CardHeader
        eyebrow="Current view"
        title="Clinical records"
        action={resource.state === "ready" ? <CountBadge count={resource.data.totalElements} noun="record" /> : undefined}
      />
      <p className="mt-1.5 text-data text-text-secondary">
        Added by doctors you have seen on MedNet. Corrections are added as new records that point to the original.
      </p>
      <div className="mt-4 border-t border-border">
        {resource.state === "loading" ? (
          <LoadingRows label="Loading records" />
        ) : resource.state === "error" ? (
          <ErrorRow title="Your records could not be loaded." onRetry={reload} status={resource.status} />
        ) : resource.data.content.length ? (
          <ul aria-label="Clinical records" className="divide-y divide-line-soft">
            {resource.data.content.map((record) => (
              <RecordItem key={record.id} record={record} selected={record.id === selectedId} />
            ))}
          </ul>
        ) : (
          <StateMessage
            kind="empty"
            className="mt-4"
            title="No records yet"
            description="Visit summaries, diagnoses and prescriptions appear here after a doctor adds them."
          />
        )}
      </div>
      {resource.state === "ready" && resource.data.totalPages > 1 ? (
        <div className="mt-5">
          <Pagination page={page} totalPages={resource.data.totalPages} onPageChange={setPage} label="Record pages" />
        </div>
      ) : null}
    </Card>
  );
}

function RecordItem({ record, selected }: { record: ClinicalRecord; selected: boolean }) {
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: "center" });
  }, [selected]);
  return (
    <li ref={ref} className={cn("py-4", selected && "-mx-3 rounded-sm bg-green-50/60 px-3 ring-1 ring-green-100")}>
      <details open={selected} className="group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-sm [&::-webkit-details-marker]:hidden">
          <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-sm bg-surface-soft text-green-800">
            <FileText size={20} strokeWidth={1.8} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold text-ink [overflow-wrap:anywhere]">{record.title}</span>
            <span className="block text-caption text-text-secondary [overflow-wrap:anywhere]">
              {recordCategoryLabel(record.category)} · {formatDate(record.effectiveAt)} · {record.authorName}
            </span>
          </span>
          {record.amendsRecordId ? <Badge tone="info">Correction</Badge> : null}
          <span className="text-caption font-semibold text-green-800 group-open:hidden">Show</span>
          <span className="hidden text-caption font-semibold text-green-800 group-open:inline">Hide</span>
        </summary>
        <div className="mt-3 ml-13 flex flex-col gap-2">
          {record.clinicalCode ? <p className="text-caption text-text-secondary">Code: {record.clinicalCode}</p> : null}
          <p className="text-data whitespace-pre-line text-ink [overflow-wrap:anywhere]">{record.summary}</p>
        </div>
      </details>
    </li>
  );
}

function LabResultList() {
  const [page, setPage] = useState(0);
  const { resource, reload } = useResource((signal) => patientApi.labResults(page, 20, signal), `lab-results-${page}`);
  const results: LabResult[] = resource.state === "ready" ? resource.data.content : [];
  return (
    <Card>
      <CardHeader
        eyebrow="Laboratory"
        title="Laboratory results"
        action={resource.state === "ready" ? <CountBadge count={resource.data.totalElements} noun="result" /> : undefined}
      />
      <p className="mt-1.5 text-data text-text-secondary">
        A result appears here only after a doctor caring for you has reviewed and released it.
      </p>
      <div className="mt-4 border-t border-border">
        {resource.state === "loading" ? (
          <LoadingRows label="Loading laboratory results" />
        ) : resource.state === "error" ? (
          <ErrorRow title="Your laboratory results could not be loaded." onRetry={reload} status={resource.status} />
        ) : results.length ? (
          <ul aria-label="Laboratory results" className="divide-y divide-line-soft">
            {results.map((result) => (
              <li key={result.id} className="py-4">
                <details className="group">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-sm [&::-webkit-details-marker]:hidden">
                    <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-sm bg-surface-soft text-green-800">
                      <FlaskConical size={20} strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold text-ink">Laboratory result</span>
                      <span className="block text-caption text-text-secondary">
                        Released {formatDate(result.reviewedAt ?? result.createdAt)}
                      </span>
                    </span>
                    <LabResultStatusBadge status={result.status} />
                    <span className="text-caption font-semibold text-green-800 group-open:hidden">Show</span>
                    <span className="hidden text-caption font-semibold text-green-800 group-open:inline">Hide</span>
                  </summary>
                  <p className="mt-3 ml-13 text-data whitespace-pre-line text-ink [overflow-wrap:anywhere]">{result.summary}</p>
                </details>
              </li>
            ))}
          </ul>
        ) : (
          <StateMessage kind="empty" layout="inline" className="mt-4" title="No released results yet." />
        )}
      </div>
      {resource.state === "ready" && resource.data.totalPages > 1 ? (
        <div className="mt-4">
          <Pagination page={page + 1} totalPages={resource.data.totalPages} onPageChange={(next) => setPage(next - 1)} label="Laboratory result pages" />
        </div>
      ) : null}
    </Card>
  );
}
