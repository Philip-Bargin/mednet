"use client";

import { ArrowLeft, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppointmentStatusBadge } from "@/components/healthcare/status";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { DescriptionList } from "@/components/ui/lists";
import { StateMessage } from "@/components/ui/state-message";
import { CARE_TIME_ZONE_LABEL, consultationModeLabel, formatSlot } from "@/features/find-care/format";
import type { Appointment, Consultation } from "@/features/patient/patient-api";
import { PrivacyCard, ViewBand, ViewColumns } from "@/features/patient/view-frame";
import { MessageThread } from "@/features/workspace/message-thread";
import { ErrorRow, LoadingRows } from "@/features/workspace/states";
import { actionError, useResource } from "@/features/workspace/use-resource";
import { providerApi } from "./provider-api";

type Loaded = { appointment: Appointment; consultation: Consultation | null };

/**
 * Provider side of a text consultation (`ConsultationController`). Only a CONFIRMED text appointment
 * can be opened; opening notifies the patient, so it happens on an explicit button press. Only the
 * provider can end it. Other providers' consultations answer 404.
 */
export function ProviderConsultation({ appointmentId, consultationId }: { appointmentId?: string; consultationId?: string }) {
  const router = useRouter();
  const { resource, reload, replace } = useResource(async (signal): Promise<Loaded> => {
    if (consultationId) {
      const consultation = await providerApi.consultation(consultationId, signal);
      return { consultation, appointment: await providerApi.appointment(consultation.appointmentId, signal) };
    }
    if (!appointmentId) throw new Error("No appointment was chosen.");
    return { appointment: await providerApi.appointment(appointmentId, signal), consultation: null };
  }, `${appointmentId}|${consultationId}`);
  const [busy, setBusy] = useState<"open" | "end" | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [error, setError] = useState("");

  async function open(appointment: Appointment) {
    setBusy("open");
    setError("");
    try {
      const consultation = await providerApi.openConsultation(appointment.id);
      replace({ appointment, consultation });
      router.replace(`/provider/appointments/consultation?consultation=${encodeURIComponent(consultation.id)}`, { scroll: false });
    } catch (failure) {
      setError(actionError(failure, "The consultation could not be opened."));
    } finally {
      setBusy(null);
    }
  }

  async function end(loaded: Loaded) {
    if (!loaded.consultation) return;
    setBusy("end");
    setError("");
    try {
      replace({ ...loaded, consultation: await providerApi.endConsultation(loaded.consultation.id) });
    } catch (failure) {
      setError(actionError(failure, "The consultation could not be ended."));
    } finally {
      setBusy(null);
      setConfirmEnd(false);
    }
  }

  return (
    <>
      <ViewBand eyebrow="Doctor workspace" title="Text consultation" description="Write with your patient during a confirmed text appointment. Messages are not instant." />
      <Link href="/provider/appointments?tab=upcoming" className="inline-flex min-h-11 items-center gap-2 self-start rounded-sm font-bold text-green-800 hover:text-action">
        <ArrowLeft aria-hidden size={18} /> Back to appointments
      </Link>
      <ViewColumns
        aside={
          <PrivacyCard>
            Only you and this patient can read the consultation. Use the patient’s record for clinical documentation; MedNet
            does not support video or voice calls.
          </PrivacyCard>
        }
      >
        {error ? <Alert tone="critical" live="assertive" title={error} /> : null}
        {resource.state === "loading" ? (
          <Card>
            <LoadingRows label="Loading the consultation" />
          </Card>
        ) : resource.state === "error" ? (
          <Card>
            {resource.status === 404 ? (
              <StateMessage kind="empty" title="Consultation not found" description="It may belong to another provider, or the link is incomplete." />
            ) : (
              <ErrorRow title="The consultation could not be loaded." onRetry={reload} status={resource.status} />
            )}
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader eyebrow="Appointment" title={resource.data.appointment.patientName} action={<AppointmentStatusBadge status={resource.data.appointment.status} />} />
              <DescriptionList
                columns={2}
                className="mt-4"
                items={[
                  { term: "When", detail: `${formatSlot(resource.data.appointment.startsAt, resource.data.appointment.endsAt)} (${CARE_TIME_ZONE_LABEL})` },
                  { term: "Consultation", detail: consultationModeLabel(resource.data.appointment.consultationMode) },
                ]}
              />
            </Card>
            {resource.data.consultation ? (
              <MessageThread
                threadKey={resource.data.consultation.id}
                eyebrow="Consultation"
                title={resource.data.consultation.status === "OPEN" ? "In progress" : "Ended"}
                headerExtra={
                  <>
                    <Badge tone={resource.data.consultation.status === "OPEN" ? "success" : "neutral"}>
                      {resource.data.consultation.status === "OPEN" ? "Open" : "Ended"}
                    </Badge>
                    {resource.data.consultation.status === "OPEN" ? (
                      <Button variant="secondary" size="sm" onClick={() => setConfirmEnd(true)}>
                        End consultation
                      </Button>
                    ) : null}
                  </>
                }
                listLabel="Consultation messages"
                loadPage={(page, size, signal) => providerApi.consultationMessages(resource.data.consultation!.id, page, size, signal)}
                send={(body) => providerApi.sendConsultationMessage(resource.data.consultation!.id, body)}
                isMine={(message) => message.senderAccountId !== resource.data.appointment.patientAccountId}
                otherLabel={resource.data.appointment.patientName}
                canSend={resource.data.consultation.status === "OPEN" && resource.data.appointment.status === "CONFIRMED"}
                closedText="This consultation has ended and can no longer receive messages."
                composerDescription=""
              />
            ) : (
              <OpenCard appointment={resource.data.appointment} busy={busy === "open"} onOpen={() => void open(resource.data.appointment)} />
            )}
            <ConfirmDialog
              open={confirmEnd}
              onClose={() => busy !== "end" && setConfirmEnd(false)}
              onConfirm={() => void end(resource.data)}
              loading={busy === "end"}
              tone="destructive"
              title="End this consultation?"
              description="Neither you nor the patient can send more messages. The conversation stays readable."
              confirmLabel="End consultation"
            />
          </>
        )}
      </ViewColumns>
    </>
  );
}

function OpenCard({ appointment, busy, onOpen }: { appointment: Appointment; busy: boolean; onOpen: () => void }) {
  const available = appointment.status === "CONFIRMED" && appointment.consultationMode === "TEXT";
  return (
    <Card>
      <CardHeader title={available ? "Open the text consultation" : "Text consultation not available"} titleAs="h3" />
      <p className="mt-1.5 text-data text-text-secondary">
        {available
          ? "Opening it lets the patient know the consultation is ready. If the patient already opened it, you join the same one."
          : appointment.consultationMode !== "TEXT"
            ? "This appointment is in person."
            : "A text consultation is available while the appointment is confirmed."}
      </p>
      {available ? (
        <Button className="mt-5" loading={busy} leadingIcon={<MessageSquareText aria-hidden size={18} />} onClick={onOpen}>
          Open text consultation
        </Button>
      ) : null}
    </Card>
  );
}
