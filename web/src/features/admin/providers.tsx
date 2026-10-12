"use client";

import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { SearchInput, SelectField, TextInput } from "@/components/ui/inputs";
import { DescriptionList } from "@/components/ui/lists";
import { Pagination } from "@/components/ui/pagination";
import { StateMessage } from "@/components/ui/state-message";
import { LIST_PAGE_SIZE, useDebouncedValue, usePageFor } from "@/features/workspace/paging";
import { ErrorRow, LoadingRows } from "@/features/workspace/states";
import { actionError, useResource } from "@/features/workspace/use-resource";
import { ADMIN_LIMITS, adminApi, type AdminProviderApplication } from "./admin-api";
import {
  ListCard,
  NoRecordSelected,
  RecordLayout,
  SelectableList,
  SelectableRow,
  SelectedRecord,
  formatAdminDateTime,
} from "./frame";
import { PROVIDER_STATUS, providerStatus } from "./permissions";

type Decision = "APPROVED" | "REJECTED" | "SUSPENDED";

/**
 * Provider applications (both administrative roles). The backend records an administrative
 * decision; it does not check credentials, so the screen never says "verified". Actions match the
 * legacy console: approve or decline a pending application, suspend an approved provider.
 */
export function ProviderApplicationsPanel({ initialStatus = "PENDING" }: { initialStatus?: string }) {
  const [status, setStatus] = useState(initialStatus);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "critical"; text: string } | null>(null);
  const needle = useDebouncedValue(query.trim());
  const [page, setPage] = usePageFor(JSON.stringify([status, needle]));
  // Search, status and paging run on the server across every application (Phase 5D; was the latest 100).
  const { resource, reload, replace } = useResource(
    (signal) => adminApi.providersPage({ status, search: needle }, page, LIST_PAGE_SIZE, signal),
    JSON.stringify([status, needle, page]),
  );

  const rows = resource.state === "ready" ? resource.data.content : [];
  const selected = rows.find((application) => application.id === selectedId) ?? null;

  function decided(saved: AdminProviderApplication, text: string) {
    if (resource.state === "ready") {
      // Keep the row visible after the decision even if it no longer matches the status filter.
      replace({ ...resource.data, content: resource.data.content.map((row) => (row.id === saved.id ? saved : row)) });
    }
    setNotice({ tone: "success", text });
  }

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
            eyebrow="Provider applications"
            title="Applications"
            action={
              <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
                Add application
              </Button>
            }
          >
            <div role="search" aria-label="Application filters" className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <SearchInput
                label="Search applications"
                placeholder="Name, email, specialty or reference"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <SelectField
                label="Application status"
                hideLabel
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setSelectedId(null);
                }}
                options={[
                  { value: "", label: "Status: all" },
                  ...Object.entries(PROVIDER_STATUS).map(([value, { label }]) => ({ value, label })),
                ]}
              />
            </div>
            <p aria-live="polite" className="text-caption text-text-secondary">
              {resource.state === "ready" ? `${resource.data.totalElements} ${resource.data.totalElements === 1 ? "application" : "applications"}` : ""}
            </p>
            {resource.state === "loading" ? (
              <LoadingRows label="Loading provider applications" />
            ) : resource.state === "error" ? (
              <ErrorRow title="Provider applications could not be loaded" status={resource.status} onRetry={reload} />
            ) : rows.length === 0 ? (
              <StateMessage
                kind="empty"
                title={status === "PENDING" && !needle ? "No applications are waiting for review" : "No applications match"}
              />
            ) : (
              <SelectableList label="Provider applications">
                {rows.map((application) => {
                  const badge = providerStatus(application.status);
                  return (
                    <SelectableRow
                      key={application.id}
                      selected={application.id === selectedId}
                      onSelect={() => setSelectedId(application.id)}
                      marker="DOC"
                      title={application.displayName}
                      meta={`${application.specialty} · Submitted ${formatAdminDateTime(application.createdAt)}`}
                      trailing={<Badge tone={badge.tone}>{badge.label}</Badge>}
                    />
                  );
                })}
              </SelectableList>
            )}
            {resource.state === "ready" ? (
              <Pagination
                page={resource.data.number + 1}
                totalPages={resource.data.totalPages}
                onPageChange={(next) => setPage(next - 1)}
                label="Application pages"
              />
            ) : null}
          </ListCard>
        }
        record={
          selected ? (
            <ApplicationRecord key={selected.id} application={selected} onDecided={decided} onFailed={(text) => setNotice({ tone: "critical", text })} />
          ) : (
            <NoRecordSelected>Open an application to review the details the applicant submitted.</NoRecordSelected>
          )
        }
      />
      <AddApplicationDialog
        open={adding}
        onClose={() => setAdding(false)}
        onAdded={(application) => {
          setAdding(false);
          setNotice({ tone: "success", text: `Application added for ${application.displayName}. It is waiting for review.` });
          if (status === "" || status === "PENDING") reload();
          else setStatus("PENDING");
          setSelectedId(application.id);
        }}
      />
    </>
  );
}

const DECISIONS: Record<Decision, { verb: string; title: (name: string) => string; description: string; destructive: boolean; done: (name: string) => string }> = {
  APPROVED: {
    verb: "Approve",
    title: (name) => `Approve ${name}?`,
    description:
      "The provider is listed in the directory and can publish open times after their next sign-in. Approval records your decision; MedNet does not independently verify credentials.",
    destructive: false,
    done: (name) => `${name} is approved.`,
  },
  REJECTED: {
    verb: "Decline",
    title: (name) => `Decline ${name}'s application?`,
    description: "The applicant is told the application was not approved and can apply again with updated details.",
    destructive: true,
    done: (name) => `${name}'s application was not approved.`,
  },
  SUSPENDED: {
    verb: "Suspend",
    title: (name) => `Suspend ${name}?`,
    description: "The provider is removed from the directory and loses the doctor workspace at their next sign-in. Existing records are kept.",
    destructive: true,
    done: (name) => `${name} is suspended.`,
  },
};

function ApplicationRecord({
  application,
  onDecided,
  onFailed,
}: {
  application: AdminProviderApplication;
  onDecided: (application: AdminProviderApplication, text: string) => void;
  onFailed: (text: string) => void;
}) {
  const [pending, setPending] = useState<Decision | null>(null);
  const [busy, setBusy] = useState(false);
  const decisions: Decision[] =
    application.status === "PENDING" ? ["APPROVED", "REJECTED"] : application.status === "APPROVED" ? ["SUSPENDED"] : [];

  async function decide() {
    if (!pending) return;
    setBusy(true);
    try {
      const saved = await adminApi.reviewProvider(application.id, pending);
      onDecided(saved, DECISIONS[pending].done(saved.displayName));
    } catch (error) {
      onFailed(actionError(error, "The decision could not be saved."));
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  return (
    <>
      <SelectedRecord
        focusKey={application.id}
        reference={application.displayName}
        title={application.specialty}
        actions={decisions.map((decision) => (
          <Button
            key={decision}
            size="sm"
            variant={decision === "APPROVED" ? "primary" : "destructive"}
            onClick={() => setPending(decision)}
          >
            {DECISIONS[decision].verb}
          </Button>
        ))}
        restricted="Approval is an administrative decision based on the details below. MedNet does not independently check licences or credentials."
      >
        <DescriptionList
          items={[
            { term: "Status", detail: providerStatus(application.status).label },
            { term: "Email", detail: application.email },
            { term: "Credential reference (as submitted)", detail: application.credentialReference },
            { term: "Submitted", detail: formatAdminDateTime(application.createdAt) },
            {
              term: "Last decision",
              detail: application.reviewedAt
                ? `${formatAdminDateTime(application.reviewedAt)}${application.reviewedBy ? ` by ${application.reviewedBy}` : ""}`
                : "Not yet reviewed",
            },
          ]}
        />
        {decisions.length === 0 ? (
          <p className="text-caption text-text-secondary">
            {application.status === "REJECTED"
              ? "The applicant can submit a new application from their account."
              : "No further action is available for this status."}
          </p>
        ) : null}
      </SelectedRecord>
      {pending ? (
        <ConfirmDialog
          open
          onClose={() => setPending(null)}
          onConfirm={() => void decide()}
          title={DECISIONS[pending].title(application.displayName)}
          description={DECISIONS[pending].description}
          confirmLabel={DECISIONS[pending].verb}
          tone={DECISIONS[pending].destructive ? "destructive" : "default"}
          loading={busy}
        />
      ) : null}
    </>
  );
}

function AddApplicationDialog({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: (application: AdminProviderApplication) => void;
}) {
  const empty = { displayName: "", email: "", specialty: "", credentialReference: "" };
  const [values, setValues] = useState(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof typeof empty, string>>>({});
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof empty) => (event: { target: { value: string } }) => setValues({ ...values, [key]: event.target.value });

  function close() {
    setValues(empty);
    setErrors({});
    setFailure("");
    onClose();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = {
      displayName: values.displayName.trim() ? undefined : "Enter the provider's name.",
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()) ? undefined : "Enter a valid email address.",
      specialty: values.specialty.trim() ? undefined : "Enter the specialty.",
      credentialReference: values.credentialReference.trim() ? undefined : "Enter the licence or registration reference.",
    };
    setErrors(next);
    setFailure("");
    if (Object.values(next).some(Boolean)) {
      const form = event.currentTarget;
      requestAnimationFrame(() => form.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
      return;
    }
    setBusy(true);
    try {
      const saved = await adminApi.createProvider({
        displayName: values.displayName.trim(),
        email: values.email.trim(),
        specialty: values.specialty.trim(),
        credentialReference: values.credentialReference.trim(),
      });
      setValues(empty);
      onAdded(saved);
    } catch (error) {
      setFailure(actionError(error, "The application could not be added."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      dismissible={!busy}
      title="Add a provider application"
      description="Manual intake for an application received outside MedNet. Enter references only: no clinical information and no documents."
      footer={
        <>
          <Button variant="tertiary" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="add-provider-application" loading={busy}>
            Add application
          </Button>
        </>
      }
    >
      <form id="add-provider-application" noValidate onSubmit={submit} className="flex flex-col gap-4">
        <TextInput label="Name" required maxLength={ADMIN_LIMITS.displayName} value={values.displayName} error={errors.displayName} onChange={set("displayName")} />
        <TextInput label="Email" type="email" autoComplete="off" required maxLength={ADMIN_LIMITS.email} value={values.email} error={errors.email} onChange={set("email")} />
        <TextInput label="Specialty" required maxLength={ADMIN_LIMITS.specialty} value={values.specialty} error={errors.specialty} onChange={set("specialty")} />
        <TextInput
          label="Licence or registration reference"
          required
          maxLength={ADMIN_LIMITS.credentialReference}
          value={values.credentialReference}
          error={errors.credentialReference}
          onChange={set("credentialReference")}
        />
        {failure ? <Alert tone="critical" live="assertive" title={failure} /> : null}
      </form>
    </Dialog>
  );
}
