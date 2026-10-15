"use client";

import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, Eyebrow } from "@/components/ui/card";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { SearchInput, TextArea } from "@/components/ui/inputs";
import { ActivityList, ActivityRow, AuditEvent, DescriptionList, RestrictedNotice } from "@/components/ui/lists";
import { OperationsPageHeading, RecordLayout } from "@/features/workspace/record-layout";
import { WORKSPACES, type WorkspaceId } from "@/features/workspace/workspaces";
import { PayoutsCard, PreviewHeading, PreviewMetrics, PreviewSubView, StatusBadge } from "./components";
import {
  ACCESS_PRINCIPLES,
  AGENT_NEXT,
  AGENT_RULES,
  AGENT_SECTIONS,
  COLLECTION_AGENTS,
  COLLECTION_EXCEPTIONS,
  COLLECTION_METRICS,
  COLLECTION_PICKUPS,
  COLLECTION_SECTIONS,
  ENFORCED_TODAY,
  FINANCE_AUDIT,
  FINANCE_METRICS,
  FINANCE_RECIPIENTS,
  FINANCE_SECTIONS,
  FINANCE_TRANSACTIONS,
  LIFECYCLE_DEPENDENCIES,
  LIFECYCLE_EXCEPTIONS,
  LIFECYCLE_STAGES,
  PROPOSED_MATRIX,
  PROVIDER_PAYOUTS,
  SUPPORT_METRICS,
  SUPPORT_SECTIONS,
  SUPPORT_THREAD,
  SUPPORT_TICKETS,
  type PreviewSection,
  type PreviewWorkspaceKey,
  type Transaction,
} from "./fixtures";
import { PreviewAction } from "./preview-action";

/* ---------------- Index ---------------- */

const PREVIEW_IDS: WorkspaceId[] = ["collection-provider", "collection-agent", "support", "finance", "specimen-lifecycle", "permissions-matrix"];

const PREVIEW_SUMMARIES: Partial<Record<WorkspaceId, string>> = {
  "collection-provider": "Pickup coordination, agent workload, transport exceptions.",
  "collection-agent": "Mobile-first pickup steps for a single collection agent.",
  support: "Ticket queue and service-request conversation.",
  finance: "Payments, reconciliation, refunds and payouts.",
  "specimen-lifecycle": "The reference's cross-role specimen model, compared with MedNet today.",
  "permissions-matrix": "The reference's proposed role matrix beside what MedNet enforces today.",
};

export function PreviewIndex() {
  return (
    <main id="main-content" className="mx-auto w-full max-w-[64rem] px-4 py-10 md:px-6 md:py-14">
      <Eyebrow tone="action">Design preview</Eyebrow>
      <h1 className="mt-2 text-h2 font-normal text-green-950 md:text-[2rem] md:leading-[2.75rem]">Operations previews</h1>
      <p className="mt-2 max-w-3xl text-text-secondary">
        Approved designs for operations roles that MedNet does not have yet. Every value is fictional, no page reads or changes real
        records, and none of these roles can sign in.
      </p>
      <Alert tone="warning" title="Preview only — Fictional data" className="mt-6">
        These screens exist to review the design. Real workspaces are the patient, doctor, administration and laboratory workspaces.
      </Alert>
      <ul className="mt-6 grid gap-4 md:grid-cols-2">
        {PREVIEW_IDS.map((id) => (
          <li key={id}>
            <Link href={WORKSPACES[id].basePath} className="flex h-full flex-col gap-2 rounded-md border border-border bg-surface p-5 shadow-card hover:border-action">
              <span className="flex items-center justify-between gap-3">
                <span className="text-title text-ink">{WORKSPACES[id].name}</span>
                <Badge tone="neutral">Presentation only</Badge>
              </span>
              <span className="text-data text-text-secondary">{PREVIEW_SUMMARIES[id]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

const SECTION_SETS: Record<PreviewWorkspaceKey, { eyebrow: string; sections: PreviewSection[] }> = {
  collection: { eyebrow: "Collection provider", sections: COLLECTION_SECTIONS.data },
  agent: { eyebrow: "Collection agent", sections: AGENT_SECTIONS.data },
  support: { eyebrow: "Customer support", sections: SUPPORT_SECTIONS.data },
  finance: { eyebrow: "Financial officer", sections: FINANCE_SECTIONS.data },
};

/** Sub-view by menu id (the route has already checked the id against PREVIEW_SECTION_IDS). */
export function PreviewSectionPage({ workspace, id }: { workspace: PreviewWorkspaceKey; id: string }) {
  const set = SECTION_SETS[workspace];
  const section = set.sections.find((candidate) => candidate.id === id);
  return section ? <PreviewSubView eyebrow={set.eyebrow} section={section} /> : null;
}

/* ---------------- Collection provider ---------------- */

export function CollectionOverview() {
  const selected = COLLECTION_PICKUPS.data[0];
  return (
    <>
      <PreviewHeading eyebrow="Collection provider" title="Pickup coordination" description="Assign pickups, monitor custody handoffs and resolve transport exceptions." action="Schedule pickup" />
      <PreviewMetrics metrics={COLLECTION_METRICS.data} />
      <RecordLayout
        list={
          <Card>
            <CardHeader eyebrow="Dispatch queue" title="Pickup requests" />
            <div className="mt-4">
              <SearchInput label="Search pickups" placeholder="Search pickup or patient reference" disabled />
            </div>
            <div className="mt-4">
              <ActivityList label="Pickup requests (fictional)">
                {COLLECTION_PICKUPS.data.map((pickup) => (
                  <ActivityRow key={pickup.ref} marker="PU" title={pickup.title} meta={pickup.meta} trailing={<StatusBadge status={pickup.status} tone={pickup.tone} />} />
                ))}
              </ActivityList>
            </div>
          </Card>
        }
        record={
          <Card>
            <CardHeader eyebrow="Pickup detail" title={selected.ref} action={<StatusBadge status="Awaiting assignment" tone="warning" />} titleAs="h3" />
            <DescriptionList className="mt-4" columns={2} items={selected.details.slice(0, 4)} />
            <div className="mt-4 rounded-sm border-l-4 border-info bg-info-soft p-4">
              <p className="font-bold text-info">Authorized instruction</p>
              <p className="text-caption text-ink-soft">{selected.details[4].detail}</p>
            </div>
            <div className="mt-4 flex flex-col gap-3">
              <PreviewAction variant="primary" fullWidth>
                Assign pickup
              </PreviewAction>
            </div>
            <div className="mt-4">
              <RestrictedNotice>No diagnosis, full medical record or laboratory result would be available to collection coordination.</RestrictedNotice>
            </div>
          </Card>
        }
      />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader eyebrow="Agent workload" title="Today’s coverage" />
          <ul aria-label="Agent workload (fictional)" className="mt-4 divide-y divide-line-soft">
            {COLLECTION_AGENTS.data.map((agent) => (
              <li key={agent.name} className="flex items-center gap-3 py-3">
                <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-green-50 text-caption font-bold text-green-900">
                  {agent.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex justify-between gap-3 font-bold text-ink">
                    {agent.name}
                    <span className="text-caption font-normal text-text-secondary">{agent.pickups} pickups</span>
                  </p>
                  <span aria-hidden className="mt-1.5 block h-1 rounded-full bg-surface-soft">
                    <span className="block h-1 rounded-full bg-action" style={{ width: `${(agent.pickups / 4) * 100}%` }} />
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader eyebrow="Exceptions" title="Needs coordination" action={<Badge tone="critical">3 open</Badge>} />
          <ul className="mt-4 divide-y divide-line-soft">
            {COLLECTION_EXCEPTIONS.data.map((exception) => (
              <li key={exception.title} className="py-3">
                <p className="text-eyebrow font-bold text-critical">{exception.kind}</p>
                <p className="font-bold text-ink">{exception.title}</p>
                <p className="text-caption text-text-secondary">{exception.detail}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <PayoutsCard title="Collection provider pricing and payouts" items={PROVIDER_PAYOUTS.data} />
    </>
  );
}


/* ---------------- Collection agent ---------------- */

export function AgentToday() {
  const next = AGENT_NEXT.data;
  return (
    <>
      <OperationsPageHeading eyebrow="Restricted mobile workspace" title="Collection agent" description="Only pickups assigned to the signed-in agent would be shown." />
      <div className="grid items-start gap-6 lg:grid-cols-[18rem_minmax(0,26rem)] lg:justify-center">
        <section className="rounded-md bg-emphasis p-5 text-white">
          <h2 className="text-title text-white">Mobile-first rules</h2>
          <ul className="mt-3 flex flex-col gap-2 text-data text-white/90">
            {AGENT_RULES.data.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          <p className="mt-5 border-t border-white/20 pt-4 text-data">
            <strong>Offline ready</strong>
            <span className="block text-caption text-green-100">3 assigned pickups cached (fictional)</span>
          </p>
        </section>
        <section aria-label="Agent phone view (fictional)" className="rounded-[1.75rem] border-8 border-emphasis bg-surface shadow-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <p className="text-caption text-text-secondary">Today · 3 assigned</p>
              <h2 className="font-bold text-ink">Next pickup</h2>
            </div>
            <span aria-hidden className="inline-flex size-10 items-center justify-center rounded-full bg-green-50 text-caption font-bold text-green-900">
              JA
            </span>
          </div>
          <div className="flex flex-col gap-4 p-4">
            <Card padding="sm">
              <p className="flex items-center justify-between text-caption font-semibold">
                {next.window}
                <Badge tone="success">Next</Badge>
              </p>
              <p className="mt-2 text-[1.1875rem] text-ink">{next.place}</p>
              <p className="text-caption text-text-secondary">{next.ref}</p>
              <p className="mt-3 border-t border-border pt-3 text-caption text-text-secondary">Destination</p>
              <p className="font-bold text-ink">{next.destination}</p>
            </Card>
            <ol aria-label="Pickup steps (preview)" className="grid grid-cols-5 gap-1">
              {next.steps.map((step, index) => (
                <li key={step} aria-current={index === 0 ? "step" : undefined} className="flex flex-col items-center gap-1 text-center">
                  <span
                    className={
                      index === 0
                        ? "inline-flex size-7 items-center justify-center rounded-full border border-action bg-green-50 text-caption font-bold text-green-900"
                        : "inline-flex size-7 items-center justify-center rounded-full border border-border bg-surface text-caption font-bold text-text-muted"
                    }
                  >
                    {index + 1}
                  </span>
                  <span className="text-caption text-text-secondary">{step}</span>
                </li>
              ))}
            </ol>
            <Card padding="sm">
              <Eyebrow tone="action">Step 1 of 5</Eyebrow>
              <h3 className="mt-1 text-[1.125rem] text-ink">Confirm arrival</h3>
              <p className="mt-1 text-caption text-text-secondary">Confirm you are at the assigned pickup location before viewing contact instructions.</p>
              <div className="mt-4 flex flex-col gap-2">
                <PreviewAction variant="primary" fullWidth>
                  Confirm and continue
                </PreviewAction>
                <PreviewAction variant="tertiary" fullWidth>
                  Report delay, failed collection or exception
                </PreviewAction>
              </div>
            </Card>
            <Card padding="sm">
              <p className="text-caption text-text-secondary">After this pickup</p>
              <p className="font-bold text-ink">{next.after}</p>
              <p className="text-caption text-text-secondary">Details unlock after current handoff</p>
            </Card>
          </div>
        </section>
      </div>
    </>
  );
}


/* ---------------- Customer support ---------------- */

export function SupportOverview() {
  const ticket = SUPPORT_TICKETS.data[0];
  return (
    <>
      <PreviewHeading eyebrow="Customer support" title="Service request workspace" description="Resolve appointment, account and service issues with minimum necessary access." action="New ticket" />
      <PreviewMetrics metrics={SUPPORT_METRICS.data} />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <Card>
          <CardHeader eyebrow="Ticket queue" title="Assigned requests" />
          <div className="mt-4">
            <ActivityList label="Assigned tickets (fictional)">
              {SUPPORT_TICKETS.data.map((row) => (
                <ActivityRow key={row.ref} marker={row.marker} title={row.title} meta={row.meta} trailing={<StatusBadge status={row.status} tone={row.tone} />} />
              ))}
            </ActivityList>
          </div>
        </Card>
        <Card>
          <CardHeader eyebrow={`Ticket ${ticket.ref}`} title={ticket.title} action={<StatusBadge status="Open · High" tone="critical" />} />
          <DescriptionList className="mt-4" columns={3} items={ticket.details} />
          <ol aria-label="Ticket conversation (fictional)" className="mt-5 flex flex-col gap-3">
            {SUPPORT_THREAD.data.map((message) => (
              <li key={message.time} className={message.from === "Support" ? "ml-auto max-w-[85%] rounded-sm bg-green-50 p-3" : "max-w-[85%] rounded-sm bg-surface-soft p-3"}>
                <p className="text-caption text-text-secondary">{`${message.time} · ${message.from}`}</p>
                <p className="text-data text-ink">{message.text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-5">
            <TextArea label="Reply" disabled placeholder="Replies are not available in the preview" />
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            <PreviewAction variant="primary">Send response</PreviewAction>
            <PreviewAction>Use template</PreviewAction>
            <PreviewAction>Escalate to…</PreviewAction>
          </div>
          <div className="mt-4 rounded-sm border-l-4 border-warning bg-warning-soft p-3 text-caption text-ink">
            <strong>Internal note.</strong> Provider joined on time. Route to administration for service recovery; no clinical review required.
          </div>
          <div className="mt-4 flex flex-col gap-4">
            <PreviewAction fullWidth>Resolve with category</PreviewAction>
            <RestrictedNotice>Clinical records, prescriptions, result release and financial adjustments would be unavailable to support.</RestrictedNotice>
          </div>
        </Card>
      </div>
    </>
  );
}


/* ---------------- Financial officer ---------------- */

export function FinanceOverview() {
  const tx = FINANCE_TRANSACTIONS.data[0];
  const columns: DataColumn<Transaction>[] = [
    { id: "tx", header: "Transaction", primary: true, cell: (row) => <span className="flex flex-col"><span className="font-semibold">{row.id}</span><span className="text-text-muted">{row.ref}</span></span> },
    { id: "amount", header: "Amount", cell: (row) => row.amount },
    { id: "status", header: "Status", cell: (row) => <StatusBadge status={row.status} tone={row.tone} /> },
    { id: "type", header: "Type", cell: (row) => row.type },
  ];
  return (
    <>
      <PreviewHeading eyebrow="Financial officer" title="Payments and reconciliation" description="Trace patient payments, marketplace allocations, refunds, disputes and settlements." action="Export report" />
      <Alert tone="warning" title="MedNet does not process payments">
        Payment collection, refunds, payouts and financial approvals are outside MedNet’s scope. Every amount here is fictional.
      </Alert>
      <PreviewMetrics metrics={FINANCE_METRICS.data} />
      <RecordLayout
        list={
          <Card>
            <CardHeader eyebrow="Transaction queue" title="Reconciliation" />
            <div className="mt-4">
              <DataTable caption="Transactions (fictional)" columns={columns} rows={FINANCE_TRANSACTIONS.data} rowKey={(row) => row.id} selectedKey={tx.id} />
            </div>
          </Card>
        }
        record={
          <Card>
            <CardHeader eyebrow="Transaction detail" title={tx.id} action={<StatusBadge status={tx.status} tone={tx.tone} />} titleAs="h3" />
            <DescriptionList
              className="mt-4"
              columns={2}
              items={[
                { term: "Patient payment", detail: tx.amount },
                { term: "Booking", detail: tx.ref },
                { term: "Authorized", detail: "12 Aug · 08:44" },
                { term: "Capture", detail: "Not captured" },
              ]}
            />
            <h4 className="mt-5 font-bold text-ink">Provisional allocation</h4>
            <dl className="mt-2 divide-y divide-line-soft text-caption">
              {[["Doctor", "Defined by transaction rule"], ["Clinic", "Defined by transaction rule"], ["MedNet fee", "Rate not displayed"]].map(([term, detail]) => (
                <div key={term} className="flex justify-between gap-3 py-2">
                  <dt className="text-ink">{term}</dt>
                  <dd className="text-text-secondary">{detail}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 rounded-sm border-l-4 border-info bg-info-soft p-3">
              <p className="font-bold text-info">Refund reason</p>
              <p className="text-caption text-ink-soft">Consultation could not start because of a confirmed platform interruption.</p>
            </div>
            <div className="mt-4 flex flex-col gap-4">
              <PreviewAction variant="destructive" fullWidth>
                Review full refund
              </PreviewAction>
              <RestrictedNotice>Clinical notes and diagnosis would not be available. Financial context is limited to the service and transaction.</RestrictedNotice>
            </div>
          </Card>
        }
      />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader eyebrow="Payout tracking" title="Marketplace recipients" />
          <ul className="mt-4 divide-y divide-line-soft">
            {FINANCE_RECIPIENTS.data.map((recipient) => (
              <li key={recipient.group} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="font-bold text-ink">{recipient.group}</span>
                <span className="flex items-center gap-3 text-caption text-text-secondary">
                  {recipient.count}
                  <StatusBadge status={recipient.status} tone={recipient.tone} />
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader eyebrow="Audit trail" title="Financial actions" />
          <ul aria-label="Financial actions (fictional)" className="mt-4 divide-y divide-line-soft">
            {FINANCE_AUDIT.data.map((event) => (
              <AuditEvent key={event.time} time={event.time} title={event.title} actor={event.actor} />
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}


/* ---------------- Specimen lifecycle ---------------- */

const SUPPORT_LABEL = { supported: "In MedNet", partial: "Partly in MedNet", none: "Not in MedNet" } as const;
const SUPPORT_TONE = { supported: "success", partial: "warning", none: "neutral" } as const;

export function LifecycleWorkflowMap() {
  return (
    <>
      <OperationsPageHeading eyebrow="Cross-role workflow" title="Specimen lifecycle" description="The reference’s shared state model, with what MedNet supports today marked on each stage." />
      <ol aria-label="Reference specimen lifecycle" className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {LIFECYCLE_STAGES.data.map((stage, index) => (
          <li key={stage.title} className="flex min-w-0 flex-col gap-2 rounded-md border border-border bg-surface p-4 shadow-card">
            <span className="flex items-center gap-2">
              <span aria-hidden className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-action text-caption font-bold text-white">
                {index + 1}
              </span>
              <span className="text-eyebrow font-bold tracking-[0.06em] text-action uppercase">{stage.owner}</span>
            </span>
            <span className="text-[0.9375rem] text-ink">{stage.title}</span>
            <span className="text-caption text-text-secondary">{stage.detail}</span>
            <span className="mt-auto flex flex-col gap-1 border-t border-line-soft pt-2">
              <Badge tone={SUPPORT_TONE[stage.mednet]} className="self-start">
                {SUPPORT_LABEL[stage.mednet]}
              </Badge>
              <span className="text-caption text-text-secondary">{stage.mednetNote}</span>
            </span>
          </li>
        ))}
      </ol>
      <LifecycleExceptions />
      <LifecycleDependencies />
    </>
  );
}

function LifecycleExceptions() {
  return (
    <Card>
      <CardHeader eyebrow="Exception paths" title="Recovery and escalation" />
      <p className="mt-1.5 text-data text-text-secondary">From the reference. MedNet implements one: a doctor can return a result and the laboratory submits a corrected one.</p>
      <ul className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {LIFECYCLE_EXCEPTIONS.data.map((exception) => (
          <li key={exception.title} className="rounded-sm border border-border p-4">
            <Badge tone="critical">Exception</Badge>
            <p className="mt-2 text-data text-ink">{exception.title}</p>
            <p className="text-caption text-text-secondary">{exception.path}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function LifecycleDependencies() {
  return (
    <section aria-label="Unresolved dependencies" className="rounded-md bg-warning-soft p-5">
      <h2 className="font-bold text-warning">Unresolved dependencies</h2>
      <p className="mt-1 text-caption text-ink">Policy decisions the reference leaves open. MedNet has not decided them, and this preview does not assume answers.</p>
      <ul className="mt-3 flex list-disc flex-col gap-1 pl-5 text-data text-ink">
        {LIFECYCLE_DEPENDENCIES.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export function LifecycleExceptionPaths() {
  return (
    <>
      <OperationsPageHeading eyebrow="Specimen lifecycle" title="Exception paths" description="Recovery paths proposed by the reference." />
      <LifecycleExceptions />
    </>
  );
}

export function LifecycleDependencyList() {
  return (
    <>
      <OperationsPageHeading eyebrow="Specimen lifecycle" title="Dependencies" description="Open policy questions that block the full lifecycle." />
      <LifecycleDependencies />
    </>
  );
}

/* ---------------- Permissions matrix ---------------- */

const MATRIX_HEAD = ["Role", "View", "Create", "Edit", "Approve / release", "Export"];

export function PermissionsMatrix() {
  return (
    <>
      <OperationsPageHeading
        eyebrow="Access model"
        title="Role-based permissions matrix"
        description="Interface visibility communicates authority; backend authorization must enforce every action independently."
      />
      <Alert tone="warning" title="This matrix is a design proposal">
        It includes roles MedNet does not have. What the API enforces today is listed below it.
      </Alert>
      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Proposed permissions matrix (scrolls sideways)">
          <table className="w-full min-w-[56rem] border-collapse text-left text-caption">
            <caption className="sr-only">Proposed role-based permissions matrix from the design reference</caption>
            <thead className="bg-emphasis text-white">
              <tr>
                {MATRIX_HEAD.map((head) => (
                  <th key={head} scope="col" className="px-4 py-3 font-bold">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PROPOSED_MATRIX.data.map(([role, ...cells]) => (
                <tr key={role} className="border-t border-line-soft">
                  <th scope="row" className="px-4 py-3 font-semibold text-ink">
                    {role}
                  </th>
                  {cells.map((cell, index) => (
                    <td key={index} className="px-4 py-3 text-ink-soft">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <EnforcedToday />
      <Principles />
    </>
  );
}

function EnforcedToday() {
  return (
    <Card>
      <CardHeader eyebrow="Factual" title="What MedNet enforces today" />
      <DescriptionList className="mt-4" items={ENFORCED_TODAY.map(([term, detail]) => ({ term, detail }))} />
    </Card>
  );
}

function Principles() {
  return (
    <ol className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {ACCESS_PRINCIPLES.map((principle, index) => (
        <li key={principle.title} className="rounded-md border border-border bg-surface p-5 shadow-card">
          <p className="text-eyebrow font-bold text-action">{String(index + 1).padStart(2, "0")}</p>
          <p className="mt-2 text-[0.9375rem] text-ink">{principle.title}</p>
          <p className="mt-1 text-caption text-text-secondary">{principle.body}</p>
        </li>
      ))}
    </ol>
  );
}

export function AccessPrinciples() {
  return (
    <>
      <OperationsPageHeading eyebrow="Permissions matrix" title="Access principles" description="The reference’s principles. MedNet follows the fourth: the API checks every request." />
      <Principles />
      <EnforcedToday />
    </>
  );
}

export function AuditRequirements() {
  return (
    <>
      <OperationsPageHeading eyebrow="Permissions matrix" title="Audit requirements" description="Which actions the reference expects to be traceable, and what MedNet records today." />
      <Card>
        <CardHeader eyebrow="Factual" title="Recorded by MedNet today" />
        <ul className="mt-4 flex list-disc flex-col gap-2 pl-5 text-data text-ink-soft">
          <li>Account creation, changes, verification, suspension and deletion, with the acting administrator.</li>
          <li>Provider application decisions.</li>
          <li>Service-request creation, assignment and status changes, including laboratory submissions and doctor review.</li>
          <li>Access to records, vitals, results, consultations and messages.</li>
        </ul>
        <p className="mt-4 text-caption text-text-secondary">
          The reference also expects a reason on every high-impact action and audit exports; MedNet records actor, action, record and time, without a reason field or export.
        </p>
      </Card>
    </>
  );
}
