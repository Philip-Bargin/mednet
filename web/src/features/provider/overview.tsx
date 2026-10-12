"use client";

import { ArrowRight, Bell, CalendarClock, CalendarDays, ChevronRight, ClipboardCheck, FileText, FlaskConical, ShieldCheck, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AppointmentStatusBadge } from "@/components/healthcare/status";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader, Eyebrow } from "@/components/ui/card";
import { FictionalDataBadge } from "@/components/ui/fictional-data-badge";
import { ActivityList, ActivityRow } from "@/components/ui/lists";
import { Skeleton } from "@/components/ui/skeleton";
import { StateMessage } from "@/components/ui/state-message";
import { CARE_TIME_ZONE, careDay, consultationModeLabel } from "@/features/find-care/format";
import { formatHeaderDate, formatShortDate, formatWhen, plural } from "@/features/patient/format";
import type { Appointment, Notification } from "@/features/patient/patient-api";
import { ErrorRow } from "@/features/workspace/states";
import { actionError, useResource, type Resource } from "@/features/workspace/use-resource";
import { needsResponse } from "./appointments";
import { loadReviewQueue, patientLabel } from "./clinical-work";
import { FICTIONAL_EARNINGS } from "./fictional";
import { providerApi } from "./provider-api";
import { useApprovedProvider } from "./provider-workspace";

const clock = new Intl.DateTimeFormat("en-US", { timeZone: CARE_TIME_ZONE, hour: "numeric", minute: "2-digit" });

/** Today's appointments in Liberia time (all statuses, earliest first) and the ones still on. */
export function todaysSchedule(appointments: Appointment[], now = new Date()) {
  const today = appointments.filter((a) => careDay(a.startsAt) === careDay(now)).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const active = today.filter((a) => ["CONFIRMED", "RESCHEDULE_REQUESTED", "COMPLETED"].includes(a.status));
  const remaining = active.filter((a) => a.status !== "COMPLETED" && new Date(a.endsAt) > now);
  return { today, active, remaining };
}

export function ProviderOverview() {
  const provider = useApprovedProvider();
  const [now] = useState(() => new Date());
  const appointments = useResource((signal) => providerApi.appointments(0, 100, signal));
  const openSlots = useResource((signal) => providerApi.openSlots(provider.id, 0, 1, signal), provider.id);
  const review = useResource((signal) => loadReviewQueue(signal, 0, 4), "review-overview");
  const notifications = useResource((signal) => providerApi.notifications(0, 5, signal));

  const list = appointments.resource.state === "ready" ? appointments.resource.data.content : [];
  const { today, active, remaining } = todaysSchedule(list, now);
  const requests = list.filter(needsResponse).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const resultsToReview =
    review.resource.state === "ready" ? review.resource.data.totalPendingResults : null;
  const unread = notifications.resource.state === "ready" ? notifications.resource.data.content.filter((n) => !n.readAt).length : null;
  const first = remaining[0];

  return (
    <>
      <section className="flex flex-col gap-4 rounded-md bg-emphasis px-5 py-6 text-white [&_:focus-visible]:outline-green-100 md:flex-row md:items-center md:justify-between md:px-7.5 md:py-8">
        <div className="min-w-0">
          <Eyebrow tone="inverse">Today’s practice</Eyebrow>
          <h2 className="mt-2 text-[1.75rem] leading-9 font-normal text-white md:text-[1.875rem]">
            {appointments.resource.state !== "ready" ? "Your practice today" : `${plural(active.length, "appointment")} scheduled`}
          </h2>
          <p className="mt-2 text-body text-white/90">
            {appointments.resource.state !== "ready"
              ? "Loading your appointments…"
              : first
                ? `Your next consultation begins at ${clock.format(new Date(first.startsAt))} (Liberia time).`
                : "No more consultations today."}
          </p>
        </div>
        <Link
          href="/provider/schedule"
          className="flex min-h-14 items-center gap-3 rounded-md border border-white/25 bg-white/10 px-4 py-2.5 text-white hover:bg-white/15"
        >
          <span className="min-w-0">
            <span className="block text-caption text-green-100">Open times</span>
            <span className="block font-bold">
              {openSlots.resource.state === "ready" ? `${plural(openSlots.resource.data.totalElements, "time")} published` : "Checking…"}
            </span>
          </span>
          <ChevronRight aria-hidden size={18} />
        </Link>
      </section>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={CalendarDays} tone="success" value={appointments.resource.state === "ready" ? active.length : null} label="Appointments today" hint={`${remaining.length} remaining`} href="/provider/appointments?tab=upcoming" />
        <StatTile icon={ClipboardCheck} tone="warning" value={appointments.resource.state === "ready" ? requests.length : null} label="Requests to answer" hint="Waiting for you" href="/provider/appointments" />
        <StatTile icon={FlaskConical} tone="info" value={resultsToReview} label="Results to review" hint="Awaiting your release" href="/provider/clinical-work" />
        <StatTile icon={Bell} tone="neutral" value={unread} label="Unread notifications" hint="Latest five" href="#notifications" />
      </div>

      {/* Two independent columns from 1200px; below that one column in reading priority. */}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1.95fr)_minmax(0,1fr)] lg:items-start">
        <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-6">
          <div className="order-1 min-w-0 lg:order-none">
            <Card>
              <CardHeader
                eyebrow="Today’s schedule"
                title={formatHeaderDate(now)}
                action={
                  <Link href="/provider/appointments?tab=upcoming" className="inline-flex min-h-11 items-center gap-2 rounded-sm font-bold text-green-800 hover:text-action">
                    All appointments <ArrowRight aria-hidden size={18} />
                  </Link>
                }
              />
              <div className="mt-4 border-t border-border">
                {appointments.resource.state === "loading" ? (
                  <RowsSkeleton label="Loading today’s schedule" />
                ) : appointments.resource.state === "error" ? (
                  <ErrorRow title="Your appointments could not be loaded." onRetry={appointments.reload} status={appointments.resource.status} />
                ) : today.length ? (
                  <ul aria-label="Today’s schedule" className="divide-y divide-line-soft">
                    {today.map((appointment) => (
                      <li key={appointment.id}>
                        <Link
                          href={`/provider/appointments?tab=${needsResponse(appointment) ? "requests" : new Date(appointment.endsAt) > now && ["CONFIRMED", "RESCHEDULE_REQUESTED"].includes(appointment.status) ? "upcoming" : "history"}&appointment=${encodeURIComponent(appointment.id)}`}
                          className="flex min-h-16 flex-wrap items-center gap-x-3 gap-y-2 rounded-sm py-3 hover:bg-surface-soft"
                        >
                          <span className="w-16 shrink-0 text-data font-bold text-ink tabular-nums">{clock.format(new Date(appointment.startsAt))}</span>
                          <Avatar name={appointment.patientName} />
                          <span className="min-w-[7rem] flex-1">
                            <span className="block font-bold text-ink [overflow-wrap:anywhere]">{appointment.patientName}</span>
                            <span className="block text-caption text-text-secondary">{consultationModeLabel(appointment.consultationMode)}</span>
                          </span>
                          <span className="ml-auto flex shrink-0 items-center gap-3">
                            <AppointmentStatusBadge status={appointment.status} />
                            <ChevronRight aria-hidden size={20} strokeWidth={1.8} className="shrink-0 text-ink-soft" />
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <StateMessage kind="empty" layout="inline" className="mt-4" title="No appointments today." />
                )}
              </div>
            </Card>
          </div>
          <div className="order-3 min-w-0 lg:order-none">
            <Card>
              <CardHeader eyebrow="Appointment requests" title={appointments.resource.state === "ready" ? `${plural(requests.length, "request")} to answer` : "Requests"} action={requests.length ? <Badge tone="warning">Pending</Badge> : undefined} />
              <div className="mt-4 border-t border-border">
                {appointments.resource.state !== "ready" ? (
                  <RowsSkeleton label="Loading requests" rows={2} />
                ) : requests.length ? (
                  <ActivityList label="Requests to answer">
                    {requests.slice(0, 4).map((appointment) => (
                      <ActivityRow
                        key={appointment.id}
                        marker={initials(appointment.patientName)}
                        title={appointment.status === "PENDING" ? appointment.patientName : `${appointment.patientName} asked for a new time`}
                        meta={`${consultationModeLabel(appointment.consultationMode)} · ${formatWhen(appointment.startsAt)}`}
                        href={`/provider/appointments?appointment=${encodeURIComponent(appointment.id)}`}
                      />
                    ))}
                  </ActivityList>
                ) : (
                  <StateMessage kind="empty" layout="inline" className="mt-4" title="No requests are waiting." />
                )}
                <p className="mt-4 rounded-sm bg-surface-soft p-3 text-caption text-text-secondary">
                  Patient records stay closed until you confirm the request and the patient allows you access.
                </p>
              </div>
            </Card>
          </div>
          <div className="order-5 min-w-0 lg:order-none">
            <NotificationsCard resource={notifications.resource} onRetry={notifications.reload} onRead={(updated) => {
              if (notifications.resource.state === "ready") {
                notifications.replace({
                  ...notifications.resource.data,
                  content: notifications.resource.data.content.map((item) => (item.id === updated.id ? updated : item)),
                });
              }
            }} />

          </div>
        </div>
        <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-6">
          <div className="order-2 min-w-0 lg:order-none">
            <ClinicalAttention review={review.resource} requests={requests} onRetry={review.reload} />
          </div>
          <div className="order-4 min-w-0 lg:order-none">
            <Card>
              <CardHeader eyebrow="Authorized actions" title="Clinical tools" />
              <ul className="mt-4 grid gap-3 md:grid-cols-3 lg:grid-cols-1">
                <ToolTile icon={FileText} title="Document consultation" meta="From a patient’s page" href="/provider/patients" />
                <ToolTile icon={FlaskConical} title="Review results" meta="Release or return" href="/provider/clinical-work" />
                <ToolTile icon={CalendarClock} title="Publish open times" meta="Text or in person" href="/provider/schedule" />
              </ul>
              <p className="mt-4 text-caption text-text-secondary">Electronic prescribing and laboratory orders are not available on MedNet.</p>
            </Card>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader
          eyebrow="Earnings and payouts"
          title="Provider financial summary"
          action={<FictionalDataBadge />}
        />
        <dl className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {FICTIONAL_EARNINGS.data.map((item) => (
            <div key={item.label} className="rounded-sm border border-border p-3">
              <dt className="text-caption text-text-muted">{item.label}</dt>
              <dd className="mt-0.5 text-[1.0625rem] font-bold text-green-950">{item.value}</dd>
              <dd className="text-caption text-text-secondary">{item.note}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-caption text-text-secondary">MedNet does not take payments or make payouts. These are example values from the design.</p>
      </Card>

      <Alert tone="success" icon={ShieldCheck} title="Clinical and administrative work are separated.">
        Patient records open only within a confirmed care relationship and with the patient’s permission.
      </Alert>
    </>
  );
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "P";
}

const toneTiles = {
  success: "bg-green-50 text-action",
  warning: "bg-warning-soft text-warning",
  info: "bg-info-soft text-info",
  neutral: "bg-surface-soft text-green-800",
} as const;

function StatTile({
  icon: Icon,
  tone,
  value,
  label,
  hint,
  href,
}: {
  icon: LucideIcon;
  tone: keyof typeof toneTiles;
  value: number | null;
  label: string;
  hint: string;
  href: string;
}) {
  return (
    <Link href={href} className="flex min-h-20 items-center gap-4 rounded-md border border-border bg-surface p-4 shadow-card hover:border-action">
      <span aria-hidden className={`inline-flex size-11 shrink-0 items-center justify-center rounded-sm ${toneTiles[tone]}`}>
        <Icon size={22} strokeWidth={1.8} />
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-[1.5625rem] leading-8 font-bold text-green-950 tabular-nums">{value ?? "–"}</span>
          <span className="text-data font-semibold text-ink">{label}</span>
        </span>
        <span className="block text-caption text-text-secondary">{value === null ? "Loading…" : hint}</span>
      </span>
    </Link>
  );
}

function ToolTile({ icon: Icon, title, meta, href }: { icon: LucideIcon; title: string; meta: string; href: string }) {
  return (
    <li>
      <Link href={href} className="flex h-full min-h-16 items-start gap-3 rounded-sm border border-border p-3 hover:border-action hover:bg-surface-soft md:flex-col lg:flex-row">
        <Icon aria-hidden size={20} strokeWidth={1.8} className="mt-0.5 shrink-0 text-green-800" />
        <span className="min-w-0">
          <span className="block text-data font-bold text-ink">{title}</span>
          <span className="block text-caption text-text-secondary">{meta}</span>
        </span>
      </Link>
    </li>
  );
}

function ClinicalAttention({
  review,
  requests,
  onRetry,
}: {
  review: Resource<Awaited<ReturnType<typeof loadReviewQueue>>>;
  requests: Appointment[];
  onRetry: () => void;
}) {
  const patients = review.state === "ready" ? review.data.content.filter((entry) => entry.recordAccess && entry.pendingResults > 0) : [];
  const reschedules = requests.filter((a) => a.status === "RESCHEDULE_REQUESTED");
  const count = (review.state === "ready" ? review.data.totalPendingResults : 0) + reschedules.length;
  return (
    <Card>
      <CardHeader eyebrow="Clinical attention" title="Review needed" action={review.state === "ready" ? <Badge tone={count ? "warning" : "success"}>{count}</Badge> : undefined} />
      <div className="mt-4 border-t border-border">
        {review.state === "loading" ? (
          <RowsSkeleton label="Loading items that need review" rows={2} />
        ) : review.state === "error" ? (
          <ErrorRow title="Items to review could not be loaded." onRetry={onRetry} status={review.status} />
        ) : count ? (
          <ActivityList label="Items that need review">
            {patients.slice(0, 4).map((entry) => (
              <ActivityRow
                key={entry.patientAccountId}
                icon={FlaskConical}
                tileTone="warning"
                title={entry.pendingResults === 1 ? "Laboratory result" : `${entry.pendingResults} laboratory results`}
                meta={`${patientLabel(entry)}${entry.oldestPendingAt ? ` · ${formatShortDate(entry.oldestPendingAt)}` : ""}`}
                href={`/provider/patients/${encodeURIComponent(entry.patientAccountId)}?tab=results`}
              />
            ))}
            {reschedules.slice(0, 2).map((appointment) => (
              <ActivityRow
                key={appointment.id}
                icon={CalendarClock}
                tileTone="info"
                title="New time requested"
                meta={appointment.patientName}
                href={`/provider/appointments?appointment=${encodeURIComponent(appointment.id)}`}
              />
            ))}
          </ActivityList>
        ) : (
          <StateMessage kind="empty" layout="inline" className="mt-4" title="Nothing needs your review." />
        )}
        <ButtonLink href="/provider/clinical-work" variant="secondary" fullWidth className="mt-4">
          Open clinical work
        </ButtonLink>
      </div>
    </Card>
  );
}

function NotificationsCard({
  resource,
  onRetry,
  onRead,
}: {
  resource: Resource<{ content: Notification[] }>;
  onRetry: () => void;
  onRead: (notification: Notification) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  async function markRead(id: string) {
    setBusyId(id);
    setError("");
    try {
      onRead(await providerApi.markNotificationRead(id));
    } catch (failure) {
      setError(actionError(failure, "The notification could not be marked as read."));
    } finally {
      setBusyId(null);
    }
  }
  return (
    <Card id="notifications">
      <CardHeader eyebrow="Updates" title="Notifications" />
      <div className="mt-4 border-t border-border">
        {error ? <StateMessage kind="error" layout="inline" className="mt-4" title={error} /> : null}
        {resource.state === "loading" ? (
          <RowsSkeleton label="Loading notifications" rows={2} />
        ) : resource.state === "error" ? (
          <ErrorRow title="Notifications could not be loaded." onRetry={onRetry} status={resource.status} />
        ) : resource.data.content.length ? (
          <ActivityList label="Latest notifications">
            {resource.data.content.map((item) => (
              <ActivityRow
                key={item.id}
                icon={Bell}
                tileTone={item.readAt ? "neutral" : "info"}
                title={
                  providerNotificationHref(item) ? (
                    <Link href={providerNotificationHref(item)!} className="inline-flex min-h-10 items-center rounded-sm underline decoration-1 underline-offset-2 hover:text-action">
                      {item.title}
                    </Link>
                  ) : (
                    item.title
                  )
                }
                meta={`${formatShortDate(item.createdAt)}${item.readAt ? " · Read" : " · Unread"}`}
                trailing={
                  item.readAt ? undefined : (
                    <Button variant="tertiary" size="sm" loading={busyId === item.id} onClick={() => void markRead(item.id)}>
                      Mark as read
                    </Button>
                  )
                }
              />
            ))}
          </ActivityList>
        ) : (
          <StateMessage kind="empty" layout="inline" className="mt-4" title="No notifications yet." />
        )}
      </div>
    </Card>
  );
}

export function providerNotificationHref(notification: Notification): string | undefined {
  const id = encodeURIComponent(notification.resourceId);
  if (notification.resourceType === "appointment") return `/provider/appointments?tab=upcoming&appointment=${id}`;
  if (notification.resourceType === "consultation") return `/provider/appointments/consultation?consultation=${id}`;
  return undefined;
}

function RowsSkeleton({ label, rows = 3 }: { label: string; rows?: number }) {
  return (
    <div aria-busy className="flex flex-col gap-3 py-4">
      <span role="status" className="sr-only">
        {label}
      </span>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  );
}
