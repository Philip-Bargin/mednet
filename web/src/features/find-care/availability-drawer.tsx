"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Drawer } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { StateMessage } from "@/components/ui/state-message";
import { ApiRequestError, getSession, type Session } from "@/lib/api";
import {
  CARE_TIME_ZONE_LABEL,
  consultationModeLabel,
  formatDayHeading,
  formatSlot,
  formatTimeRange,
  groupByDay,
} from "./format";
import {
  listAvailability,
  requestAppointment,
  type AppointmentRequestResult,
  type AvailabilitySlot,
  type Page,
  type DirectoryProvider,
} from "./provider-api";

const PAGE_SIZE = 25;

type Slots =
  | { state: "loading" }
  | { state: "missing" }
  | { state: "error" }
  | { state: "ready"; slots: AvailabilitySlot[]; hasMore: boolean; page: number };

type Outcome =
  | { kind: "idle" }
  | { kind: "sent"; appointment: AppointmentRequestResult }
  | { kind: "profile" }
  | { kind: "taken" }
  | { kind: "signed-out" }
  | { kind: "error"; message: string };

/**
 * Open times for one approved provider, and the appointment request (POST /appointments).
 * Interpretation: the reference shows the doctor card and appointment card but no booking screen
 * (DESIGN_SYSTEM.md §14). Signed-out visitors are sent to sign in and return to the same provider
 * and time; only patient accounts can send a request (the API enforces this too).
 */
export function AvailabilityDrawer({
  provider,
  providerId,
  initialSlotId,
  basePath = "/find-care",
  onClose,
}: {
  provider: DirectoryProvider | null;
  providerId: string;
  initialSlotId?: string;
  /** Page that hosts discovery, so sign-in returns to the same place. */
  basePath?: string;
  onClose: () => void;
}) {
  const [slots, setSlots] = useState<Slots>({ state: "loading" });
  const [selectedId, setSelectedId] = useState<string | undefined>(initialSlotId);
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });

  const applyPage = useCallback((result: Page<AvailabilitySlot>) => {
    setSlots((current) => ({
      state: "ready",
      slots: result.number > 0 && current.state === "ready" ? [...current.slots, ...result.content] : result.content,
      hasMore: result.number + 1 < result.totalPages,
      page: result.number,
    }));
  }, []);

  const applyError = useCallback((error: unknown) => {
    setSlots({ state: error instanceof ApiRequestError && error.status === 404 ? "missing" : "error" });
  }, []);

  /** Event-driven reloads ("Show more times", retry, after a taken slot). */
  function load(page: number) {
    listAvailability(providerId, { page, size: PAGE_SIZE }).then(applyPage).catch(applyError);
  }

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    listAvailability(providerId, { page: 0, size: PAGE_SIZE }, signal)
      .then(applyPage)
      .catch((error) => !signal.aborted && applyError(error));
    getSession(signal)
      .then((current) => !signal.aborted && setSession(current))
      .catch(() => !signal.aborted && setSession(null));
    return () => controller.abort();
  }, [providerId, applyPage, applyError]);

  const selected = slots.state === "ready" ? slots.slots.find((slot) => slot.id === selectedId) : undefined;
  const name = provider?.displayName ?? "this provider";
  const returnTo = `${basePath}?provider=${encodeURIComponent(providerId)}${selected ? `&slot=${encodeURIComponent(selected.id)}` : ""}`;

  async function send() {
    if (!selected) return;
    setSending(true);
    setOutcome({ kind: "idle" });
    try {
      const appointment = await requestAppointment(selected.id);
      setOutcome({ kind: "sent", appointment });
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 409 && /profile/i.test(error.message)) {
        setOutcome({ kind: "profile" });
      } else if (error instanceof ApiRequestError && error.status === 409) {
        setOutcome({ kind: "taken" });
        setSelectedId(undefined);
        setSlots({ state: "loading" });
        load(0);
      } else if (error instanceof ApiRequestError && error.status === 401) {
        setSession(null);
        setOutcome({ kind: "signed-out" });
      } else {
        setOutcome({ kind: "error", message: error instanceof Error ? error.message : "The request could not be sent." });
      }
    } finally {
      setSending(false);
    }
  }

  const sent = outcome.kind === "sent";

  let footer: React.ReactNode = null;
  if (!sent && slots.state === "ready" && slots.slots.length > 0) {
    if (session === undefined) {
      footer = <p className="text-caption text-text-secondary">Checking your account…</p>;
    } else if (session === null) {
      footer = (
        <div className="flex w-full flex-col gap-2">
          <ButtonLink href={`/sign-in?redirect=${encodeURIComponent(returnTo)}`} fullWidth>
            Sign in to request {selected ? "this time" : "a time"}
          </ButtonLink>
          <p className="text-caption text-text-secondary">
            New to MedNet? Choose “Create account” on the sign-in page. Your selected time is kept.
          </p>
        </div>
      );
    } else if (session.role === "PATIENT") {
      footer = (
        <div className="flex w-full flex-col gap-2">
          <Button fullWidth loading={sending} disabled={!selected} onClick={() => void send()}>
            Send appointment request
          </Button>
          {!selected ? <p className="text-caption text-text-secondary">Choose an open time first.</p> : null}
        </div>
      );
    } else {
      footer = (
        <Alert tone="info" title="Requests are made from a patient account">
          You are signed in with a {session.role === "PROVIDER" ? "provider" : "staff"} account, which cannot request
          appointments.
        </Alert>
      );
    }
  }

  return (
    <Drawer open onClose={onClose} title={provider ? `Open times · ${provider.displayName}` : "Open times"} footer={footer}>
      <div className="flex flex-col gap-5">
        {provider ? (
          <div>
            <Badge tone="success">Approved provider</Badge>
            <p className="mt-2 text-data text-text-secondary">{provider.specialty}</p>
          </div>
        ) : null}

        {sent ? (
          <StateMessage
            kind="success"
            title="Request sent"
            description={`${outcome.appointment.providerName || name} will confirm the time or suggest another. ${formatSlot(
              outcome.appointment.startsAt,
              outcome.appointment.endsAt,
            )} · ${consultationModeLabel(outcome.appointment.consultationMode)}.`}
            action={
              <ButtonLink href="/patient/appointments" variant="secondary">
                View my appointments
              </ButtonLink>
            }
          />
        ) : (
          <>
            {outcome.kind === "profile" ? (
              <Alert
                tone="warning"
                live="assertive"
                title="Complete your patient profile before booking"
                action={<Link href="/patient/profile" className="text-data font-bold text-green-800 underline">Open my profile</Link>}
              >
                Your selected time is not reserved until the request is sent.
              </Alert>
            ) : null}
            {outcome.kind === "taken" ? (
              <Alert tone="warning" live="assertive" title="That time is no longer available">
                The open times have been refreshed. Choose another time.
              </Alert>
            ) : null}
            {outcome.kind === "signed-out" ? (
              <Alert tone="warning" live="assertive" title="Your session has ended">
                Sign in again to send the request.
              </Alert>
            ) : null}
            {outcome.kind === "error" ? <Alert tone="critical" live="assertive" title={outcome.message} /> : null}

            {slots.state === "loading" ? (
              <div aria-busy className="flex flex-col gap-3">
                <span className="sr-only" role="status">Loading open times…</span>
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : slots.state === "missing" ? (
              <StateMessage
                kind="empty"
                title="This provider is not available"
                description="They may no longer be listed in the directory."
              />
            ) : slots.state === "error" ? (
              <StateMessage
                kind="error"
                title="Open times could not be loaded"
                description="Try again shortly."
                action={
                  <Button variant="secondary" size="sm" onClick={() => { setSlots({ state: "loading" }); load(0); }}>
                    Try again
                  </Button>
                }
              />
            ) : slots.slots.length === 0 ? (
              <StateMessage
                kind="empty"
                title="No open times"
                description={`${name} has no open appointment times right now. Check again later or choose another provider.`}
              />
            ) : (
              <fieldset className="min-w-0">
                <legend className="text-data font-semibold text-ink">Choose an open time</legend>
                <p className="text-caption text-text-secondary">Times are in {CARE_TIME_ZONE_LABEL}.</p>
                <div className="mt-4 flex flex-col gap-5">
                  {groupByDay(slots.slots).map((group) => (
                    <div key={group.day}>
                      <p className="mb-2 text-caption font-semibold text-text-secondary">
                        {formatDayHeading(group.slots[0].startsAt)}
                      </p>
                      <ul className="flex flex-col gap-2">
                        {group.slots.map((slot) => (
                          <li key={slot.id}>
                            <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-sm border border-border px-3 py-2 has-checked:border-action has-checked:bg-action-subtle has-focus-visible:outline-3 has-focus-visible:outline-offset-1 has-focus-visible:outline-action">
                              <input
                                type="radio"
                                name="slot"
                                value={slot.id}
                                checked={selectedId === slot.id}
                                onChange={() => setSelectedId(slot.id)}
                                className="size-[1.125rem] accent-[var(--color-action)]"
                              />
                              <span className="flex-1 text-data font-semibold text-ink tabular-nums">
                                {formatTimeRange(slot.startsAt, slot.endsAt)}
                              </span>
                              <span className="text-caption text-text-secondary">
                                {consultationModeLabel(slot.consultationMode)}
                              </span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                {slots.hasMore ? (
                  <Button variant="tertiary" size="sm" className="mt-4" onClick={() => load(slots.page + 1)}>
                    Show more times
                  </Button>
                ) : null}
              </fieldset>
            )}

            {selected ? (
              <p className="rounded-sm bg-surface-soft px-3 py-2 text-data text-ink" role="status">
                Selected: {formatSlot(selected.startsAt, selected.endsAt)} · {consultationModeLabel(selected.consultationMode)}
              </p>
            ) : null}
          </>
        )}
      </div>
    </Drawer>
  );
}
