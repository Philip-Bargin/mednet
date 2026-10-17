"use client";

import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { FilterBar, type AppliedFilter } from "@/components/ui/filter-bar";
import { SearchInput, SelectField, TextInput } from "@/components/ui/inputs";
import { DescriptionList } from "@/components/ui/lists";
import { Pagination } from "@/components/ui/pagination";
import { PasswordField } from "@/components/ui/password-field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ErrorRow } from "@/features/workspace/states";
import { actionError, useResource } from "@/features/workspace/use-resource";
import {
  ACCOUNT_TYPES,
  ADMIN_LIMITS,
  CREATABLE_ACCOUNT_TYPES,
  adminApi,
  generatePassword,
  type AccountFilters,
  type PlatformAccount,
} from "./admin-api";
import { useAdmin } from "./admin-workspace";
import { ListCard, NoRecordSelected, RecordLayout, SelectedRecord, formatAdminDateTime } from "./frame";
import { ACCOUNT_TYPE_LABELS, accountStatus, accountTypeLabel, canChangeStatusOf } from "./permissions";

const PAGE_SIZES = [25, 50, 100];

const typeOptions = (types: readonly string[]) => types.map((type) => ({ value: type, label: ACCOUNT_TYPE_LABELS[type] ?? type }));

/**
 * Account management (legacy "User management"). Both roles list, search, create non-privileged
 * accounts and suspend or reactivate; SUPER_ADMIN additionally edits, changes verification and
 * deletes. `lockedFilters` fixes filters for focused queues (e.g. unverified email addresses).
 */
export function AccountsPanel({
  initialFilters = {},
  lockedFilters = {},
  allowCreate = true,
  listTitle = "Accounts",
  emptyTitle = "No accounts match these filters",
}: {
  initialFilters?: AccountFilters;
  lockedFilters?: AccountFilters;
  allowCreate?: boolean;
  listTitle?: string;
  emptyTitle?: string;
}) {
  const { session, can } = useAdmin();
  const [draft, setDraft] = useState<AccountFilters>({ search: "", status: "", accountType: "", emailVerified: "", ...initialFilters });
  const [filters, setFilters] = useState<AccountFilters>(draft);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(25);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "critical"; text: string; password?: string } | null>(null);

  const effective = { ...filters, ...lockedFilters };
  const key = JSON.stringify([effective, page, size]);
  const { resource, reload, replace } = useResource((signal) => adminApi.accounts(page, size, effective, signal), key);

  const rows = resource.state === "ready" ? resource.data.content : [];
  const selected = rows.find((account) => account.id === selectedId) ?? null;

  function apply(next: AccountFilters) {
    setFilters(next);
    setPage(0);
  }

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Searching again with the same filters refreshes the list.
    if (JSON.stringify(draft) === JSON.stringify(filters) && page === 0) reload();
    else apply(draft);
  }

  const applied: AppliedFilter[] = [
    filters.search ? { id: "search", label: `Search: ${filters.search}` } : null,
    filters.status && !lockedFilters.status ? { id: "status", label: accountStatus(filters.status).label } : null,
    filters.accountType && !lockedFilters.accountType ? { id: "accountType", label: accountTypeLabel(filters.accountType) } : null,
    filters.emailVerified && !lockedFilters.emailVerified
      ? { id: "emailVerified", label: filters.emailVerified === "true" ? "Email verified" : "Email not verified" }
      : null,
  ].filter((value): value is AppliedFilter => value !== null);

  function removeFilter(id: string) {
    const next = { ...filters, [id]: "" };
    setDraft(next);
    apply(next);
  }

  function updated(account: PlatformAccount, text: string) {
    if (resource.state === "ready") {
      replace({ ...resource.data, content: resource.data.content.map((row) => (row.id === account.id ? account : row)) });
    }
    setNotice({ tone: "success", text });
  }

  const columns: DataColumn<PlatformAccount>[] = [
    {
      id: "account",
      header: "Account",
      primary: true,
      cell: (account) => (
        <span className="flex min-w-0 flex-col">
          <span className="font-semibold">{account.displayName || "No name"}</span>
          <span className="text-text-secondary [overflow-wrap:anywhere]">{account.email}</span>
          <code className="font-mono text-text-muted">{account.publicId}</code>
        </span>
      ),
    },
    { id: "type", header: "Type", cell: (account) => accountTypeLabel(account.accountType) },
    {
      id: "state",
      header: "Status",
      cell: (account) => (
        <span className="flex flex-col items-start gap-1.5 md:items-start">
          <Badge tone={accountStatus(account.status).tone} className="whitespace-nowrap">
            {accountStatus(account.status).label}
          </Badge>
          {account.emailVerified ? null : (
            <Badge tone="warning" className="whitespace-nowrap">
              Email not verified
            </Badge>
          )}
        </span>
      ),
    },
    {
      id: "open",
      header: "Details",
      align: "end",
      cell: (account) => (
        <Button
          size="sm"
          className="whitespace-nowrap"
          variant={account.id === selectedId ? "primary" : "secondary"}
          aria-pressed={account.id === selectedId}
          aria-label={`Open ${account.displayName || account.email}`}
          onClick={() => setSelectedId(account.id)}
        >
          Open
        </Button>
      ),
    },
  ];

  const pageData = resource.state === "ready" ? resource.data : null;
  const from = pageData && pageData.totalElements > 0 ? pageData.number * size + 1 : 0;
  const to = pageData ? Math.min((pageData.number + 1) * size, pageData.totalElements) : 0;

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
        >
          {notice.password ? <GeneratedPassword password={notice.password} /> : null}
        </Alert>
      ) : null}
      <RecordLayout
        list={
          <ListCard
            eyebrow="Account management"
            title={listTitle}
            action={
              allowCreate ? (
                <Button size="sm" onClick={() => setCreating(true)}>
                  Create account
                </Button>
              ) : undefined
            }
          >
            <form onSubmit={submitFilters} noValidate>
              <FilterBar
                label="Account filters"
                search={
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <SearchInput
                      label="Search by name, email or public ID"
                      placeholder="Name, email or public ID (PT-…)"
                      fieldClassName="md:col-span-2 xl:col-span-4"
                      maxLength={ADMIN_LIMITS.email}
                      value={draft.search ?? ""}
                      onChange={(event) => setDraft({ ...draft, search: event.target.value })}
                    />
                    {lockedFilters.status === undefined ? (
                      <SelectField
                        label="Status"
                        hideLabel
                        value={draft.status ?? ""}
                        onChange={(event) => setDraft({ ...draft, status: event.target.value })}
                        options={[
                          { value: "", label: "Status: all" },
                          { value: "ACTIVE", label: "Active" },
                          { value: "SUSPENDED", label: "Suspended" },
                        ]}
                      />
                    ) : null}
                    {lockedFilters.accountType === undefined ? (
                      <SelectField
                        label="Account type"
                        hideLabel
                        value={draft.accountType ?? ""}
                        onChange={(event) => setDraft({ ...draft, accountType: event.target.value })}
                        options={[{ value: "", label: "Type: all" }, ...typeOptions(ACCOUNT_TYPES)]}
                      />
                    ) : null}
                    {lockedFilters.emailVerified === undefined ? (
                      <SelectField
                        label="Email verification"
                        hideLabel
                        value={draft.emailVerified ?? ""}
                        onChange={(event) => setDraft({ ...draft, emailVerified: event.target.value as AccountFilters["emailVerified"] })}
                        options={[
                          { value: "", label: "Email: all" },
                          { value: "true", label: "Email verified" },
                          { value: "false", label: "Email not verified" },
                        ]}
                      />
                    ) : null}
                    <Button type="submit" variant="secondary">
                      Search
                    </Button>
                  </div>
                }
                applied={applied}
                onRemove={removeFilter}
                onClearAll={() => {
                  const cleared = { search: "", status: "", accountType: "", emailVerified: "" as const };
                  setDraft(cleared);
                  apply(cleared);
                }}
                resultCount={pageData ? (pageData.totalElements === 0 ? "No accounts" : `${from}–${to} of ${pageData.totalElements} accounts`) : null}
              />
            </form>
            {resource.state === "error" ? (
              <ErrorRow title="Accounts could not be loaded" status={resource.status} onRetry={reload} />
            ) : (
              <DataTable
                caption={listTitle}
                columns={columns}
                rows={rows}
                rowKey={(account) => account.id}
                selectedKey={selectedId ?? undefined}
                loading={resource.state === "loading"}
                empty={{ title: emptyTitle }}
              />
            )}
            {pageData ? (
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <Pagination page={pageData.number + 1} totalPages={pageData.totalPages} onPageChange={(next) => setPage(next - 1)} label="Account pages" />
                <SelectField
                  label="Rows per page"
                  fieldClassName="md:w-44"
                  value={String(size)}
                  onChange={(event) => {
                    setSize(Number(event.target.value));
                    setPage(0);
                  }}
                  options={PAGE_SIZES.map((value) => ({ value: String(value), label: String(value) }))}
                />
              </div>
            ) : null}
          </ListCard>
        }
        record={
          selected ? (
            <AccountRecord
              key={selected.id}
              account={selected}
              ownAccount={selected.email.toLowerCase() === session.email.toLowerCase()}
              onUpdated={updated}
              onDeleted={(account) => {
                setSelectedId(null);
                setNotice({ tone: "success", text: `${account.email} was deleted.` });
                reload();
              }}
              onFailed={(text) => setNotice({ tone: "critical", text })}
            />
          ) : (
            <NoRecordSelected>
              Open an account to see its details and the actions your role allows.
              {can.editAccounts ? null : " Editing, verification and deletion are for super administrators."}
            </NoRecordSelected>
          )
        }
      />
      {allowCreate ? (
        <CreateAccountDialog
          open={creating}
          onClose={() => setCreating(false)}
          onCreated={(account, password) => {
            setCreating(false);
            setNotice({
              tone: "success",
              text: `Account created for ${account.email}. It can sign in after the email address is verified.`,
              password,
            });
            setSelectedId(account.id);
            reload();
          }}
        />
      ) : null}
    </>
  );
}

function GeneratedPassword({ password }: { password: string }) {
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <div className="mt-2 flex flex-col gap-2">
      <p>Save this generated password now. It is shown only once.</p>
      <code className="rounded-sm bg-surface px-3 py-2 font-mono text-data break-all text-ink">{password}</code>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            navigator.clipboard.writeText(password).then(
              () => setCopied("copied"),
              () => setCopied("failed"),
            )
          }
        >
          Copy password
        </Button>
        <span role="status" className="text-caption">
          {copied === "copied" ? "Copied" : copied === "failed" ? "Copy failed. Select the password and copy it." : ""}
        </span>
      </div>
    </div>
  );
}

type PendingAction = "suspend" | "reactivate" | "verify" | "unverify" | "delete" | null;

function AccountRecord({
  account,
  ownAccount,
  onUpdated,
  onDeleted,
  onFailed,
}: {
  account: PlatformAccount;
  ownAccount: boolean;
  onUpdated: (account: PlatformAccount, text: string) => void;
  onDeleted: (account: PlatformAccount) => void;
  onFailed: (text: string) => void;
}) {
  const { can, role } = useAdmin();
  const statusAllowed = can.manageAccountStatus && canChangeStatusOf(role, account.accountType);
  const [pending, setPending] = useState<PendingAction>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const name = account.displayName || account.email;
  const active = account.status === "ACTIVE";

  async function run() {
    if (!pending) return;
    setBusy(true);
    try {
      if (pending === "delete") {
        await adminApi.deleteAccount(account.id);
        onDeleted(account);
      } else if (pending === "suspend" || pending === "reactivate") {
        const saved = await adminApi.changeAccountStatus(account.id, pending === "suspend" ? "SUSPENDED" : "ACTIVE");
        onUpdated(saved, pending === "suspend" ? `${name} is suspended and cannot sign in.` : `${name} is active again.`);
      } else {
        const saved = await adminApi.changeAccountVerification(account.id, pending === "verify");
        onUpdated(saved, pending === "verify" ? `${name}'s email address is marked verified.` : `${name}'s email address is marked not verified.`);
      }
    } catch (error) {
      onFailed(actionError(error, "The change could not be saved."));
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  const confirm: Record<Exclude<PendingAction, null>, { title: string; description: string; label: string; destructive: boolean }> = {
    suspend: {
      title: `Suspend ${name}?`,
      description: "The account cannot sign in while it is suspended. Its records are kept. The change is recorded in the audit trail.",
      label: "Suspend account",
      destructive: true,
    },
    reactivate: {
      title: `Reactivate ${name}?`,
      description: "The account can sign in again. The change is recorded in the audit trail.",
      label: "Reactivate account",
      destructive: false,
    },
    verify: {
      title: `Mark ${name}'s email as verified?`,
      description: "Use this only when the person has confirmed this address another way. Verified accounts can sign in.",
      label: "Mark verified",
      destructive: false,
    },
    unverify: {
      title: `Mark ${name}'s email as not verified?`,
      description: "The account cannot sign in until the address is verified again.",
      label: "Mark not verified",
      destructive: true,
    },
    delete: {
      title: `Permanently delete ${name}?`,
      description:
        "This cannot be undone. Accounts linked to profiles, care, provider applications or clinical records cannot be deleted; suspend them instead.",
      label: "Delete account",
      destructive: true,
    },
  };

  return (
    <>
      <SelectedRecord
        focusKey={account.id}
        reference={account.publicId}
        title={name}
        actions={
          ownAccount ? null : (
            <>
              {statusAllowed ? (
                <Button size="sm" variant={active ? "destructive" : "primary"} onClick={() => setPending(active ? "suspend" : "reactivate")}>
                  {active ? "Suspend account" : "Reactivate account"}
                </Button>
              ) : null}
              {can.editAccounts ? (
                <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                  Edit details
                </Button>
              ) : null}
              {can.changeVerification ? (
                <Button size="sm" variant="secondary" onClick={() => setPending(account.emailVerified ? "unverify" : "verify")}>
                  {account.emailVerified ? "Mark email not verified" : "Mark email verified"}
                </Button>
              ) : null}
              {can.deleteAccounts ? (
                <Button size="sm" variant="tertiary" onClick={() => setPending("delete")}>
                  Delete account
                </Button>
              ) : null}
            </>
          )
        }
        restricted={
          ownAccount
            ? "This is your own account. Another administrator must change it."
            : !statusAllowed
              ? "Only a super administrator can suspend, reactivate or change administrator accounts."
              : can.editAccounts
              ? "The environment-configured administrator is changed through deployment settings. Accounts linked to care or clinical records keep their account type."
              : "Editing details, verification and deletion are for super administrators."
        }
      >
        <DescriptionList
          items={[
            { term: "Email", detail: account.email },
            { term: "Account type", detail: accountTypeLabel(account.accountType) },
            { term: "Status", detail: accountStatus(account.status).label },
            { term: "Email address", detail: account.emailVerified ? "Verified" : "Not verified (cannot sign in)" },
            { term: "Created", detail: formatAdminDateTime(account.createdAt) },
            { term: "Last updated", detail: formatAdminDateTime(account.updatedAt) },
          ]}
        />
      </SelectedRecord>
      {pending ? (
        <ConfirmDialog
          open
          onClose={() => setPending(null)}
          onConfirm={() => void run()}
          title={confirm[pending].title}
          description={confirm[pending].description}
          confirmLabel={confirm[pending].label}
          tone={confirm[pending].destructive ? "destructive" : "default"}
          loading={busy}
        />
      ) : null}
      {can.editAccounts ? (
        <EditAccountDialog
          open={editing}
          account={account}
          onClose={() => setEditing(false)}
          onSaved={(saved) => {
            setEditing(false);
            onUpdated(saved, `${saved.displayName || saved.email} was updated.`);
          }}
        />
      ) : null}
    </>
  );
}

type AccountForm = { displayName: string; email: string; accountType: string; password: string };
type AccountErrors = Partial<Record<keyof AccountForm, string>>;

function validateAccount(values: AccountForm, passwordRequired: boolean): AccountErrors {
  const errors: AccountErrors = {};
  if (!values.displayName.trim()) errors.displayName = "Enter the person's name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = "Enter a valid email address.";
  const bytes = new TextEncoder().encode(values.password).length;
  if (passwordRequired || values.password) {
    if (values.password.length < ADMIN_LIMITS.passwordMin || values.password.length > ADMIN_LIMITS.passwordMax || bytes > ADMIN_LIMITS.passwordMax) {
      errors.password = "Use 12 to 72 characters.";
    }
  }
  return errors;
}

function focusFirstError(form: HTMLFormElement) {
  requestAnimationFrame(() => form.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
}

function CreateAccountDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (account: PlatformAccount, generatedPassword?: string) => void;
}) {
  const [values, setValues] = useState<AccountForm>({ displayName: "", email: "", accountType: "PATIENT", password: "" });
  const [mode, setMode] = useState<"manual" | "generated">("generated");
  const [errors, setErrors] = useState<AccountErrors>({});
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  const formId = "create-account-form";

  function reset() {
    setValues({ displayName: "", email: "", accountType: "PATIENT", password: "" });
    setErrors({});
    setFailure("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = mode === "generated" ? generatePassword() : values.password;
    const next = validateAccount({ ...values, password }, true);
    setErrors(next);
    setFailure("");
    if (Object.keys(next).length) return focusFirstError(event.currentTarget);
    setBusy(true);
    try {
      const account = await adminApi.createAccount({
        displayName: values.displayName.trim(),
        email: values.email.trim(),
        accountType: values.accountType,
        password,
      });
      reset();
      onCreated(account, mode === "generated" ? password : undefined);
    } catch (error) {
      setFailure(actionError(error, "The account could not be created."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      dismissible={!busy}
      title="Create an account"
      description="New accounts start with an unverified email address and cannot sign in until it is verified. Administrator accounts cannot be created here."
      footer={
        <>
          <Button variant="tertiary" onClick={() => { reset(); onClose(); }} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={busy}>
            Create account
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={submit} className="flex flex-col gap-4">
        <TextInput label="Name" required maxLength={ADMIN_LIMITS.displayName} value={values.displayName} error={errors.displayName} onChange={(event) => setValues({ ...values, displayName: event.target.value })} />
        <TextInput label="Email" type="email" autoComplete="off" required maxLength={ADMIN_LIMITS.email} value={values.email} error={errors.email} onChange={(event) => setValues({ ...values, email: event.target.value })} />
        <SelectField label="Account type" value={values.accountType} options={typeOptions(CREATABLE_ACCOUNT_TYPES)} onChange={(event) => setValues({ ...values, accountType: event.target.value })} />
        <p aria-hidden className="-mb-2 text-data font-semibold text-ink">Initial password</p>
        <SegmentedControl
          legend="Initial password"
          value={mode}
          onChange={(value) => setMode(value as "manual" | "generated")}
          options={[
            { value: "generated", label: "Generate securely" },
            { value: "manual", label: "Enter manually" },
          ]}
        />
        {mode === "manual" ? (
          <PasswordField
            label="Password"
            description="12 to 72 characters."
            required
            autoComplete="new-password"
            maxLength={ADMIN_LIMITS.passwordMax}
            value={values.password}
            error={errors.password}
            onChange={(event) => setValues({ ...values, password: event.target.value })}
          />
        ) : (
          <p className="text-caption text-text-secondary">A 32-character password is generated in this browser and shown once after the account is created.</p>
        )}
        {failure ? <Alert tone="critical" live="assertive" title={failure} /> : null}
      </form>
    </Dialog>
  );
}

function EditAccountDialog({
  open,
  account,
  onClose,
  onSaved,
}: {
  open: boolean;
  account: PlatformAccount;
  onClose: () => void;
  onSaved: (account: PlatformAccount) => void;
}) {
  const initial = { displayName: account.displayName ?? "", email: account.email, accountType: account.accountType, password: "" };
  const [values, setValues] = useState<AccountForm>(initial);
  const [errors, setErrors] = useState<AccountErrors>({});
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  const formId = `edit-account-${account.id}`;

  function close() {
    setValues(initial);
    setErrors({});
    setFailure("");
    onClose();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = validateAccount(values, false);
    setErrors(next);
    setFailure("");
    if (Object.keys(next).length) return focusFirstError(event.currentTarget);
    setBusy(true);
    try {
      const saved = await adminApi.updateAccount(account.id, {
        displayName: values.displayName.trim(),
        email: values.email.trim(),
        accountType: values.accountType,
        ...(values.password ? { password: values.password } : {}),
      });
      setValues({ ...values, password: "" });
      onSaved(saved);
    } catch (error) {
      setFailure(actionError(error, "The account could not be updated."));
    } finally {
      setBusy(false);
    }
  }

  const privileged = values.accountType === "ADMIN" || values.accountType === "SUPER_ADMIN";
  return (
    <Dialog
      open={open}
      onClose={close}
      dismissible={!busy}
      title={`Edit ${account.publicId}`}
      description="Changes are recorded in the audit trail. Changing an account email requires the address to be verified again."
      footer={
        <>
          <Button variant="tertiary" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={busy}>
            Save changes
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={submit} className="flex flex-col gap-4">
        <TextInput label="Name" required maxLength={ADMIN_LIMITS.displayName} value={values.displayName} error={errors.displayName} onChange={(event) => setValues({ ...values, displayName: event.target.value })} />
        <TextInput label="Email" type="email" autoComplete="off" required maxLength={ADMIN_LIMITS.email} value={values.email} error={errors.email} onChange={(event) => setValues({ ...values, email: event.target.value })} />
        <SelectField
          label="Account type"
          description="Accounts linked to care or clinical records cannot change type."
          value={values.accountType}
          options={typeOptions(ACCOUNT_TYPES)}
          onChange={(event) => setValues({ ...values, accountType: event.target.value })}
        />
        {privileged && account.accountType !== values.accountType ? (
          <Alert tone="warning" title="This grants administrative access">
            {values.accountType === "SUPER_ADMIN"
              ? "Super administrators can edit, verify and delete every other account."
              : "Administrators can review providers, create accounts and suspend accounts."}
          </Alert>
        ) : null}
        <PasswordField
          label="Replace password (optional)"
          description="Leave empty to keep the current password."
          autoComplete="new-password"
          maxLength={ADMIN_LIMITS.passwordMax}
          value={values.password}
          error={errors.password}
          onChange={(event) => setValues({ ...values, password: event.target.value })}
        />
        {failure ? <Alert tone="critical" live="assertive" title={failure} /> : null}
      </form>
    </Dialog>
  );
}
