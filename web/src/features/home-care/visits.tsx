"use client";

import { useState, type FormEvent } from "react";
import { StatusTimeline } from "@/components/healthcare/status-timeline";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { ConfirmDialog } from "@/components/ui/dialog";
import { SearchInput, SelectField, TextInput } from "@/components/ui/inputs";
import { DescriptionList } from "@/components/ui/lists";
import { ApiRequestError } from "@/lib/api";
import { ErrorRow } from "@/features/workspace/states";
import { actionError } from "@/features/workspace/use-resource";
import {
  ListCard,
  NoRecordSelected,
  RecordLayout,
  SelectedRecord,
  formatOperationsDateTime,
} from "@/features/workspace/record-layout";
import { homeCareApi, type HomeCareRequest } from "./home-care-api";
import { useHomeCare } from "./home-care-workspace";
import {
  HOME_CARE_STAGE,
  homeCareBadge,
  homeCareReference,
  homeCareStage,
  homeCareTimeline,
  sortForQueue,
  toVisitInput,
  visitTimeToIso,
} from "./status";

type Notice = { tone: "success" | "critical"; text: string };

/**
 * Assigned home-care visits (layout follows the laboratory order queue: list plus "Selected record").
 * Columns and actions are limited to `PartnerRequestDetails` and the partner endpoints: no patient name
 * or contact, no reassignment, no rescheduling (the API sets a visit time once), no visit notes.
 */
export function VisitQueue({ limit, title = "Assigned home-care visits" }: { limit?: number; title?: string }) {
  const { requests, reloadRequests } = useHomeCare();
  const [stage, setStage] = useState("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const all = requests.state === "ready" ? sortForQueue(requests.data) : [];
  const needle = query.trim().toLowerCase();
  const filtered = all.filter(
    (request) =>
      (!stage || homeCareStage(request) === stage) &&
      (!needle ||
        homeCareReference(request.id).toLowerCase().includes(needle) ||
        request.requestedService.toLowerCase().includes(needle) ||
        (request.locationDescription ?? "").toLowerCase().includes(needle)),
  );
  const rows = limit ? filtered.slice(0, limit) : filtered;
  const selected = all.find((request) => request.id === selectedId) ?? null;
  const toSchedule = all.filter((request) => homeCareStage(request) === "unscheduled").length;

  const columns: DataColumn<HomeCareRequest>[] = [
    {
      id: "request",
      header: "Request",
      primary: true,
      cell: (request) => <code className="font-mono font-semibold">{homeCareReference(request.id)}</code>,
    },
    { id: "care", header: "Care requested", cell: (request) => <span className="[overflow-wrap:anywhere]">{request.requestedService}</span> },
    {
      id: "visit",
      header: "Visit",
      cell: (request) => (request.scheduledAt ? formatOperationsDateTime(request.scheduledAt) : <span className="text-text-secondary">Not set</span>),
    },
    {
      id: "status",
      header: "Status",
      cell: (request) => (
        <Badge tone={homeCareBadge(request).tone} className="whitespace-nowrap">
          {homeCareBadge(request).label}
        </Badge>
      ),
    },
    {
      id: "open",
      header: "Details",
      align: "end",
      cell: (request) => (
        <Button
          size="sm"
          className="whitespace-nowrap"
          variant={request.id === selectedId ? "primary" : "secondary"}
          aria-pressed={request.id === selectedId}
          aria-label={`Open ${homeCareReference(request.id)}`}
          onClick={() => setSelectedId(request.id)}
        >
          Open
        </Button>
      ),
    },
  ];

  return (
    <>
      {notice ? (
        <Alert
          tone={notice.tone}
          live={notice.tone === "critical" ? "assertive" : "polite"}
          title={notice.text}
          action={
            <Button size="sm" variant="tertiary" onClick={() => setNotice(null)}>
              Dismiss
            </Button>
          }
        />
      ) : null}
      <RecordLayout
        list={
          <ListCard
            eyebrow="Assigned work"
            title={title}
            action={toSchedule ? <Badge tone="warning">{`${toSchedule} need a visit time`}</Badge> : undefined}
          >
            <div role="search" aria-label="Visit filters" className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <SearchInput
                label="Search visits"
                placeholder="Reference, care or location"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <SelectField
                label="Visit status"
                hideLabel
                value={stage}
                onChange={(event) => setStage(event.target.value)}
                options={[{ value: "", label: "Status: all" }, ...Object.entries(HOME_CARE_STAGE).map(([value, { label }]) => ({ value, label }))]}
              />
            </div>
            {requests.state === "error" ? (
              <ErrorRow title="Your assigned visits could not be loaded" status={requests.status} onRetry={reloadRequests} />
            ) : (
              <DataTable
                caption={title}
                columns={columns}
                rows={rows}
                rowKey={(request) => request.id}
                selectedKey={selectedId ?? undefined}
                loading={requests.state === "loading"}
                empty={{
                  title: all.length ? "No visits match" : "No home-care requests are assigned to you",
                  description: all.length ? undefined : "A MedNet administrator assigns patients' home-care requests to your account.",
                }}
              />
            )}
            {limit && filtered.length > limit ? (
              <p className="text-caption text-text-secondary">{`Showing ${limit} of ${filtered.length}. All visits are under Visits.`}</p>
            ) : null}
          </ListCard>
        }
        record={
          selected ? (
            <VisitDetail key={selected.id} request={selected} onNotice={setNotice} />
          ) : (
            <NoRecordSelected>Open a request to see the care requested, where, and what you can do next.</NoRecordSelected>
          )
        }
      />
    </>
  );
}

function VisitDetail({ request, onNotice }: { request: HomeCareRequest; onNotice: (notice: Notice) => void }) {
  const { replaceRequest, reloadRequests } = useHomeCare();
  const [confirming, setConfirming] = useState<"start" | "complete" | null>(null);
  const [busy, setBusy] = useState(false);
  const stage = homeCareStage(request);
  const reference = homeCareReference(request.id);

  async function changeStatus(next: "start" | "complete") {
    setBusy(true);
    try {
      const saved = next === "start" ? await homeCareApi.startVisit(request.id) : await homeCareApi.completeVisit(request.id);
      replaceRequest(saved);
      onNotice({
        tone: "success",
        text: next === "start" ? `${reference}: visit started. The patient was notified.` : `${reference}: visit completed. The patient was notified.`,
      });
    } catch (error) {
      onNotice({ tone: "critical", text: actionError(error, "The visit could not be updated.") });
      // The request may have changed elsewhere (cancelled by the patient or an administrator).
      if (error instanceof ApiRequestError && (error.status === 409 || error.status === 404)) reloadRequests();
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  }

  return (
    <>
      <SelectedRecord
        focusKey={request.id}
        reference={reference}
        title={<Badge tone={homeCareBadge(request).tone}>{homeCareBadge(request).label}</Badge>}
        actions={
          stage === "scheduled" ? (
            <Button onClick={() => setConfirming("start")}>Start visit</Button>
          ) : stage === "in-progress" ? (
            <Button onClick={() => setConfirming("complete")}>Mark visit completed</Button>
          ) : null
        }
        restricted="Only the care requested and the visit location are shared with you. Patient name, contact details and medical records are not available here."
      >
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-sm bg-green-50 p-4">
            <p className="text-caption text-text-secondary">Care requested (as written by the patient)</p>
            <p className="mt-1 font-semibold text-ink [overflow-wrap:anywhere]">{request.requestedService}</p>
          </div>
          <div className="rounded-sm bg-green-50 p-4">
            <p className="text-caption text-text-secondary">Visit location (as written by the patient)</p>
            <p className="mt-1 font-semibold text-ink [overflow-wrap:anywhere]">{request.locationDescription ?? "Not provided"}</p>
          </div>
        </div>
        <DescriptionList
          columns={2}
          items={[
            { term: "Visit time", detail: request.scheduledAt ? `${formatOperationsDateTime(request.scheduledAt)} (Liberia time)` : "Not set" },
            { term: "Requested", detail: formatOperationsDateTime(request.createdAt) },
            { term: "Last updated", detail: formatOperationsDateTime(request.updatedAt) },
          ]}
        />
        <StatusTimeline label={`Progress of ${reference}`} steps={homeCareTimeline(request, formatOperationsDateTime)} />
        {stage === "unscheduled" ? (
          <ScheduleForm request={request} onNotice={onNotice} />
        ) : stage === "scheduled" ? (
          <p className="text-caption text-text-secondary">
            Start the visit when you arrive. The visit time cannot be changed in MedNet once set; if it must move, contact a MedNet administrator.
          </p>
        ) : stage === "in-progress" ? (
          <p className="text-caption text-text-secondary">Mark the visit completed when the requested care has been given. The patient is told.</p>
        ) : stage === "completed" ? (
          <p className="text-caption text-text-secondary">This visit is complete. No further action is available.</p>
        ) : stage === "cancelled" ? (
          <p className="text-caption text-text-secondary">This request was cancelled by the patient or an administrator. Do not visit.</p>
        ) : null}
      </SelectedRecord>
      <ConfirmDialog
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        onConfirm={() => confirming && void changeStatus(confirming)}
        title={confirming === "complete" ? `Mark ${reference} completed?` : `Start the visit for ${reference}?`}
        description={
          confirming === "complete"
            ? "The request is closed as completed and the patient is notified. This cannot be undone from the home-care workspace."
            : "The request moves to in progress and the patient is notified. This cannot be undone from the home-care workspace."
        }
        confirmLabel={confirming === "complete" ? "Mark completed" : "Start visit"}
        loading={busy}
      />
    </>
  );
}

/** Sets the visit time once (`PATCH …/schedule`). The API requires a future time. */
function ScheduleForm({ request, onNotice }: { request: HomeCareRequest; onNotice: (notice: Notice) => void }) {
  const { replaceRequest, reloadRequests } = useHomeCare();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [failure, setFailure] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  // Earliest selectable time, fixed when the form opens; the API checks again on submit.
  const [minimum] = useState(() => toVisitInput(new Date(Date.now() + 60_000)));
  const reference = homeCareReference(request.id);

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailure("");
    const iso = visitTimeToIso(value);
    const problem = !iso ? "Choose the visit date and time." : new Date(iso).getTime() <= Date.now() ? "Choose a time in the future." : "";
    if (problem) {
      setError(problem);
      const form = event.currentTarget;
      requestAnimationFrame(() => form.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
      return;
    }
    setError("");
    setConfirming(true);
  }

  async function submit() {
    const iso = visitTimeToIso(value);
    if (!iso) return;
    setBusy(true);
    try {
      const saved = await homeCareApi.schedule(request.id, iso);
      replaceRequest(saved);
      onNotice({ tone: "success", text: `${reference}: visit scheduled for ${formatOperationsDateTime(saved.scheduledAt ?? iso)}. The patient was notified.` });
    } catch (caught) {
      const message = actionError(caught, "The visit could not be scheduled.");
      if (caught instanceof ApiRequestError && (caught.status === 409 || caught.status === 404)) {
        // Changed elsewhere (cancelled or already scheduled): this form goes away with the refresh, so
        // the explanation is shown above the queue instead.
        onNotice({ tone: "critical", text: message });
        reloadRequests();
      } else {
        setFailure(message);
      }
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <form noValidate onSubmit={review} className="flex flex-col gap-3 border-t border-border pt-5">
      <TextInput
        label="Visit date and time"
        type="datetime-local"
        required
        min={minimum}
        description="Liberia time (GMT). It can be set once; the patient sees it."
        value={value}
        error={error || undefined}
        onChange={(event) => setValue(event.target.value)}
      />
      {failure ? <Alert tone="critical" live="assertive" title={failure} /> : null}
      <div>
        <Button type="submit">Schedule visit</Button>
      </div>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => void submit()}
        title={`Schedule the visit for ${reference}?`}
        description={`${value ? formatOperationsDateTime(visitTimeToIso(value) ?? new Date().toISOString()) : ""} (Liberia time). The patient is notified, and the time cannot be changed in MedNet afterwards.`}
        confirmLabel="Schedule visit"
        loading={busy}
      />
    </form>
  );
}
