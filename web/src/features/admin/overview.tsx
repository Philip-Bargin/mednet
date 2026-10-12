"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ActivityList, ActivityRow, AuditEvent } from "@/components/ui/lists";
import { MetricCard, MetricGrid } from "@/components/ui/metric-card";
import { StateMessage } from "@/components/ui/state-message";
import { PermissionBoundary } from "@/components/workspace/workspace-sections";
import { ErrorRow, LoadingRows } from "@/features/workspace/states";
import { useResource } from "@/features/workspace/use-resource";
import { adminApi, type AdminOverview } from "./admin-api";
import { useAdmin } from "./admin-workspace";
import { AdminPageHeading, formatAdminDateTime, formatAdminTime } from "./frame";
import { useOverview } from "./operations";
import { auditActionLabel, providerStatus, shortReference } from "./permissions";

export function AdminOverviewPage() {
  const { role } = useAdmin();
  return role === "SUPER_ADMIN" ? <SuperAdministratorOverview /> : <AdministratorOverview />;
}

function apiMetric(overview: AdminOverview) {
  const up = overview.apiStatus === "UP";
  return (
    <MetricCard
      tone={up ? "info" : "critical"}
      value={up ? "Up" : overview.apiStatus}
      label="API status"
      hint={`Checked ${formatAdminTime(overview.checkedAt)} (Liberia time)`}
    />
  );
}

function CountsUnavailable() {
  return (
    <StateMessage
      kind="empty"
      layout="inline"
      title="Counts are unavailable because the API reports that its database is not configured."
    />
  );
}

/** Pending provider applications, newest first (no audit side effect). */
function PendingApplications({ limit, href }: { limit: number; href: string }) {
  const { resource, reload } = useResource(
    (signal) => adminApi.providersPage({ status: "PENDING" }, 0, limit, signal).then((page) => page.content),
    "pending",
  );
  if (resource.state === "loading") return <LoadingRows label="Loading applications awaiting review" rows={2} />;
  if (resource.state === "error") return <ErrorRow title="Applications could not be loaded" status={resource.status} onRetry={reload} />;
  if (resource.data.length === 0) {
    return <StateMessage kind="empty" layout="inline" title="No provider applications are waiting for review." />;
  }
  return (
    <ActivityList label="Provider applications awaiting review">
      {resource.data.slice(0, limit).map((application) => (
        <ActivityRow
          key={application.id}
          marker="DOC"
          title={`Provider application: ${application.displayName}`}
          meta={`${application.specialty} · Submitted ${formatAdminDateTime(application.createdAt)}`}
          trailing={<Badge tone={providerStatus(application.status).tone}>{providerStatus(application.status).label}</Badge>}
          href={href}
        />
      ))}
    </ActivityList>
  );
}

function SuperAdministratorOverview() {
  const { resource, reload } = useOverview();
  const unverified = useResource((signal) => adminApi.accounts(0, 1, { emailVerified: "false" }, signal), "unverified");
  // Only the four newest events are shown, so only four are requested (Phase 5D; was the latest 100).
  const audit = useResource((signal) => adminApi.auditPage(0, 4, {}, signal).then((page) => page.content), "audit-recent");

  return (
    <>
      <AdminPageHeading
        title="Platform control centre"
        description="Platform-wide account administration, provider decisions and an auditable record of changes."
        action={
          <ButtonLink href="/admin/security" variant="secondary">
            Audit trail
          </ButtonLink>
        }
      />
      {resource.state === "loading" ? (
        <LoadingRows label="Loading platform counts" rows={2} />
      ) : resource.state === "error" ? (
        <ErrorRow title="Platform counts could not be loaded" status={resource.status} onRetry={reload} />
      ) : resource.data.counts ? (
        <MetricGrid>
          <MetricCard tone="success" value={resource.data.counts.activeAccounts} label="Active accounts" hint="Across all account types" />
          <MetricCard tone="warning" value={resource.data.counts.pendingProviders} label="Provider applications" hint="Awaiting review" />
          {apiMetric(resource.data)}
          <MetricCard
            tone="critical"
            value={resource.data.counts.openRequests}
            label="Open requests"
            hint={`${resource.data.counts.openHomeCareRequests} home care · ${resource.data.counts.openLaboratoryRequests} laboratory`}
          />
        </MetricGrid>
      ) : (
        <CountsUnavailable />
      )}

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader eyebrow="Governance queue" title="Decisions and access" />
          <div className="mt-4">
            <PendingApplications limit={3} href="/admin/providers" />
            {unverified.resource.state === "ready" && unverified.resource.data.totalElements > 0 ? (
              <ActivityList label="Email verification">
                <ActivityRow
                  marker="ACC"
                  tileTone="warning"
                  title={`${unverified.resource.data.totalElements} ${unverified.resource.data.totalElements === 1 ? "account has" : "accounts have"} an unverified email`}
                  meta="These accounts cannot sign in yet"
                  href="/admin/verification"
                />
              </ActivityList>
            ) : null}
          </div>
        </Card>
        <Card>
          <CardHeader
            eyebrow="Security"
            title="Recent administrative events"
            action={
              <ButtonLink href="/admin/security" variant="secondary" size="sm">
                Audit trail
              </ButtonLink>
            }
          />
          <div className="mt-4">
            {audit.resource.state === "loading" ? (
              <LoadingRows label="Loading recent events" rows={3} />
            ) : audit.resource.state === "error" ? (
              <ErrorRow title="Recent events could not be loaded" status={audit.resource.status} onRetry={audit.reload} />
            ) : audit.resource.data.length === 0 ? (
              <StateMessage kind="empty" layout="inline" title="No audit events yet." />
            ) : (
              <ul aria-label="Recent administrative events" className="divide-y divide-line-soft">
                {audit.resource.data.slice(0, 4).map((event) => (
                  <AuditEvent
                    key={event.id}
                    time={formatAdminTime(event.createdAt)}
                    title={auditActionLabel(event.action)}
                    actor={`${event.actorEmail} · ${event.resourceType.replaceAll("_", " ")} ${shortReference(event.resourceId)}`}
                  />
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader eyebrow="Platform management" title="Organizations and access" />
        <ul className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {[
            ["Users and roles", "/admin/users", "Accounts, types, status and verification"],
            ["Doctors", "/admin/providers", "Provider applications and decisions"],
            ["Laboratory staff", "/admin/users?type=LABORATORY", "Laboratory partner accounts"],
            ["Home-care staff", "/admin/users?type=HOME_CARE", "Home-care partner accounts"],
            ["Platform status", "/admin/configuration", "Module availability and API health"],
            ["Task queue", "/admin/tasks", "Home-care and laboratory requests"],
          ].map(([label, href, hint], index) => (
            <li key={href}>
              <Link href={href} className="flex h-full min-h-24 flex-col rounded-sm border border-border p-4 hover:border-action hover:bg-surface-soft">
                <span aria-hidden className="text-eyebrow font-semibold text-text-muted tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="mt-2 font-bold text-ink">{label}</span>
                <span className="text-caption text-text-secondary">{hint}</span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex flex-col gap-3 rounded-sm border border-critical-border bg-critical-soft/50 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-bold text-ink">High-impact actions</p>
            <p className="text-caption text-ink-soft">
              Suspending accounts, changing account types and deleting accounts ask for confirmation and are recorded in the
              audit trail.
            </p>
          </div>
          <ButtonLink href="/admin/users?status=ACTIVE" variant="secondary" size="sm">
            Manage accounts
          </ButtonLink>
        </div>
      </Card>
    </>
  );
}

function AdministratorOverview() {
  const { resource, reload } = useOverview();
  const counts = resource.state === "ready" ? resource.data.counts : null;

  return (
    <>
      <AdminPageHeading
        title="Daily operations"
        description="Review provider applications, coordinate service requests and support accounts without technical configuration or clinical access."
      />
      {resource.state === "loading" ? (
        <LoadingRows label="Loading operational counts" rows={2} />
      ) : resource.state === "error" ? (
        <ErrorRow title="Operational counts could not be loaded" status={resource.status} onRetry={reload} />
      ) : counts ? (
        <MetricGrid>
          <MetricCard
            tone="warning"
            value={counts.openRequests}
            label="Open requests"
            hint={`${counts.openHomeCareRequests} home care · ${counts.openLaboratoryRequests} laboratory`}
          />
          <MetricCard tone="info" value={counts.pendingProviders} label="Onboarding reviews" hint="Provider applications awaiting review" />
          <MetricCard tone="success" value={counts.activeAccounts} label="Active accounts" hint="Across all account types" />
          {apiMetric(resource.data as AdminOverview)}
        </MetricGrid>
      ) : (
        <CountsUnavailable />
      )}

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader eyebrow="Operations queue" title="Priority work" />
          <div className="mt-4">
            {counts ? (
              <ActivityList label="Queues">
                <ActivityRow
                  marker="HC"
                  title="Home-care requests"
                  meta="Assign staff or update status"
                  trailing={<Badge tone={counts.openHomeCareRequests ? "warning" : "neutral"}>{`${counts.openHomeCareRequests} open`}</Badge>}
                  href="/admin/tasks"
                />
                <ActivityRow
                  marker="LAB"
                  title="Laboratory requests"
                  meta="Assign staff or update status"
                  trailing={<Badge tone={counts.openLaboratoryRequests ? "warning" : "neutral"}>{`${counts.openLaboratoryRequests} open`}</Badge>}
                  href="/admin/tasks"
                />
              </ActivityList>
            ) : null}
            <PendingApplications limit={3} href="/admin/onboarding" />
          </div>
        </Card>
        <PermissionBoundary
          approvalRequiredLabel="Super administrator only"
          allowed="Provider application decisions, creating patient, provider and partner accounts, suspending and reactivating those accounts, coordinating service requests, the appointment list and the audit trail."
          approvalRequired="Suspending or reactivating administrator accounts, editing account details or account types, changing email verification, deleting accounts, and the platform status page."
          notAvailable="Clinical records and consultation content, releasing results, technical configuration and administrator account creation."
        />
      </div>
    </>
  );
}
