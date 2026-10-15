"use client";

import { CalendarClock, Lock } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { RadioGroup, SelectField, TextInput } from "@/components/ui/inputs";
import { StateMessage } from "@/components/ui/state-message";
import {
  CARE_TIME_ZONE_LABEL,
  careDay,
  consultationModeLabel,
  formatDayHeading,
  formatSlot,
  formatTimeRange,
  groupByDay,
} from "@/features/find-care/format";
import type { AvailabilitySlot } from "@/features/find-care/provider-api";
import { CountBadge, ViewBand, ViewColumns, PrivacyCard } from "@/features/patient/view-frame";
import { ErrorRow, LoadingRows } from "@/features/workspace/states";
import { actionError, useResource } from "@/features/workspace/use-resource";
import { providerApi } from "./provider-api";
import { useApprovedProvider } from "./provider-workspace";

const DURATIONS = [15, 20, 30, 45, 60, 90];

/**
 * Liberia keeps GMT all year (no daylight saving), so a Liberia wall-clock time is the same instant in
 * UTC. Returns null for an invalid date or time.
 */
export function liberiaInstant(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const value = new Date(`${date}T${time}:00Z`);
  return Number.isNaN(value.getTime()) ? null : value;
}

/**
 * Open times (`ProviderAvailabilityController`): publish single future slots and close open ones.
 * The backend rejects past times and overlaps (409) and refuses to close a slot a patient has already
 * requested (409). There is no edit or recurrence: change a time by closing it and publishing another.
 */
export function ProviderSchedule() {
  const provider = useApprovedProvider();
  const slots = useResource((signal) => providerApi.openSlots(provider.id, 0, 100, signal), provider.id);
  const booked = useResource((signal) => providerApi.appointments(0, 100, signal));
  const [closing, setClosing] = useState<AvailabilitySlot | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "critical"; text: string } | null>(null);

  async function close() {
    if (!closing) return;
    setBusy(true);
    try {
      await providerApi.closeSlot(closing.id);
      setNotice({ tone: "success", text: `Closed ${formatSlot(closing.startsAt, closing.endsAt)}.` });
    } catch (error) {
      setNotice({ tone: "critical", text: actionError(error, "The time could not be closed.") });
      booked.reload();
    } finally {
      setBusy(false);
      setClosing(null);
      slots.reload();
    }
  }

  const open = slots.resource.state === "ready" ? slots.resource.data.content : [];
  const reserved =
    booked.resource.state === "ready"
      ? booked.resource.data.content
          .filter((a) => ["PENDING", "CONFIRMED", "RESCHEDULE_REQUESTED"].includes(a.status) && new Date(a.endsAt) > new Date())
          .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      : [];

  return (
    <>
      <ViewBand
        eyebrow="Doctor workspace"
        title="Schedule"
        description={`Publish the times patients can request, in ${CARE_TIME_ZONE_LABEL}. Requested times stay reserved until you answer.`}
      />
      <ViewColumns
        aside={
          <PrivacyCard>
            Patients see your open times, name and specialty in the public directory. They never see who requested your
            other times.
          </PrivacyCard>
        }
      >
        {notice ? <Alert tone={notice.tone} live={notice.tone === "critical" ? "assertive" : "polite"} title={notice.text} /> : null}
        <Card>
          <CardHeader
            eyebrow="Current view"
            title="Open times"
            action={slots.resource.state === "ready" ? <CountBadge count={slots.resource.data.totalElements} noun="open time" /> : undefined}
          />
          <div className="mt-4 border-t border-border">
            {slots.resource.state === "loading" ? (
              <LoadingRows label="Loading open times" />
            ) : slots.resource.state === "error" ? (
              <ErrorRow title="Your open times could not be loaded." onRetry={slots.reload} status={slots.resource.status} />
            ) : open.length ? (
              <div className="flex flex-col gap-5 pt-4">
                {groupByDay(open).map((group) => (
                  <section key={group.day} aria-label={formatDayHeading(group.slots[0].startsAt)}>
                    <h3 className="text-data font-semibold text-ink">{formatDayHeading(group.slots[0].startsAt)}</h3>
                    <ul className="mt-2 divide-y divide-line-soft rounded-sm border border-border">
                      {group.slots.map((slot) => (
                        <li key={slot.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                          <CalendarClock aria-hidden size={18} strokeWidth={1.8} className="text-green-800" />
                          <span className="min-w-0 flex-1 text-data text-ink">
                            {formatTimeRange(slot.startsAt, slot.endsAt)} · {consultationModeLabel(slot.consultationMode)}
                          </span>
                          <Button
                            variant="tertiary"
                            size="sm"
                            aria-label={`Close ${formatSlot(slot.startsAt, slot.endsAt)}`}
                            onClick={() => {
                              setNotice(null);
                              setClosing(slot);
                            }}
                          >
                            Close
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
                {slots.resource.data.totalElements > open.length ? (
                  <p className="text-caption text-text-secondary">Showing your next {open.length} open times.</p>
                ) : null}
              </div>
            ) : (
              <StateMessage kind="empty" layout="inline" className="mt-4" title="No open times. Patients cannot request an appointment until you publish one." />
            )}
          </div>
        </Card>

        <PublishForm
          onCreated={(slot) => {
            setNotice({ tone: "success", text: `Published ${formatSlot(slot.startsAt, slot.endsAt)}.` });
            slots.reload();
          }}
        />

        <Card>
          <CardHeader eyebrow="Reserved" title="Requested and booked times" action={booked.resource.state === "ready" ? <CountBadge count={reserved.length} /> : undefined} />
          <p className="mt-1.5 text-data text-text-secondary">These times are held by a patient request or appointment and cannot be closed here.</p>
          <div className="mt-4 border-t border-border">
            {booked.resource.state === "loading" ? (
              <LoadingRows label="Loading reserved times" rows={2} />
            ) : booked.resource.state === "error" ? (
              <ErrorRow title="Reserved times could not be loaded." onRetry={booked.reload} status={booked.resource.status} />
            ) : reserved.length ? (
              <ul aria-label="Reserved times" className="divide-y divide-line-soft">
                {reserved.map((appointment) => (
                  <li key={appointment.id} className="flex flex-wrap items-center gap-3 py-3">
                    <Lock aria-hidden size={18} strokeWidth={1.8} className="text-text-secondary" />
                    <span className="min-w-0 flex-1 text-data text-ink">
                      {formatSlot(appointment.startsAt, appointment.endsAt)} · {consultationModeLabel(appointment.consultationMode)}
                    </span>
                    <Badge tone={appointment.status === "PENDING" ? "warning" : "success"}>
                      {appointment.status === "PENDING" ? "Requested" : "Booked"}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <StateMessage kind="empty" layout="inline" className="mt-4" title="No reserved times." />
            )}
          </div>
        </Card>
      </ViewColumns>

      <ConfirmDialog
        open={closing !== null}
        onClose={() => !busy && setClosing(null)}
        onConfirm={() => void close()}
        loading={busy}
        tone="destructive"
        title="Close this open time?"
        description={closing ? `${formatSlot(closing.startsAt, closing.endsAt)} (${CARE_TIME_ZONE_LABEL}). Patients will no longer be able to request it.` : ""}
        confirmLabel="Close time"
      />
    </>
  );
}

function PublishForm({ onCreated }: { onCreated: (slot: AvailabilitySlot) => void }) {
  const today = careDay(new Date());
  const [values, setValues] = useState({ date: today, time: "", duration: "30", mode: "TEXT" });
  const [errors, setErrors] = useState<{ date?: string; time?: string }>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const startsAt = liberiaInstant(values.date, values.time);
    const next = {
      date: values.date ? undefined : "Choose a date.",
      time: !values.time ? "Choose a start time." : !startsAt || startsAt <= new Date() ? "Choose a time in the future." : undefined,
    };
    setErrors(next);
    setFailure("");
    if (next.date || next.time || !startsAt) {
      const form = event.currentTarget;
      requestAnimationFrame(() => form.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
      return;
    }
    const endsAt = new Date(startsAt.getTime() + Number(values.duration) * 60_000);
    setBusy(true);
    try {
      const created = await providerApi.createSlot({
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        consultationMode: values.mode,
      });
      setValues({ ...values, time: "" });
      onCreated(created);
    } catch (error) {
      // 409 "Availability slots may not overlap" and 400 messages come straight from the API.
      setFailure(actionError(error, "The time could not be published."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Publish an open time" titleAs="h3" />
      <p className="mt-1.5 text-data text-text-secondary">Each time is published on its own. Times may not overlap.</p>
      <form noValidate onSubmit={submit} className="mt-5 grid gap-4 md:grid-cols-3">
        <TextInput
          label="Date"
          type="date"
          required
          min={today}
          value={values.date}
          error={errors.date}
          onChange={(event) => setValues({ ...values, date: event.target.value })}
        />
        <TextInput
          label="Start time"
          type="time"
          required
          value={values.time}
          error={errors.time}
          description={CARE_TIME_ZONE_LABEL}
          onChange={(event) => setValues({ ...values, time: event.target.value })}
        />
        <SelectField
          label="Length"
          value={values.duration}
          onChange={(event) => setValues({ ...values, duration: event.target.value })}
          options={DURATIONS.map((minutes) => ({ value: String(minutes), label: `${minutes} minutes` }))}
        />
        <RadioGroup
          legend="Consultation"
          name="slot-mode"
          value={values.mode}
          onChange={(mode) => setValues({ ...values, mode })}
          options={[
            { value: "TEXT", label: "Text consultation" },
            { value: "IN_PERSON", label: "In person" },
          ]}
          className="md:col-span-3"
        />
        {failure ? <Alert tone="critical" live="assertive" title={failure} className="md:col-span-3" /> : null}
        <div className="md:col-span-3">
          <Button type="submit" loading={busy}>
            Publish time
          </Button>
        </div>
      </form>
    </Card>
  );
}
