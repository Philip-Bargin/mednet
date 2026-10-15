"use client";

import { MessageThread } from "@/features/workspace/message-thread";
import { ArrowLeft, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppointmentStatusBadge } from "@/components/healthcare/status";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DescriptionList } from "@/components/ui/lists";
import { StateMessage } from "@/components/ui/state-message";
import { CARE_TIME_ZONE_LABEL, consultationModeLabel, formatSlot } from "@/features/find-care/format";
import { patientApi, type Appointment, type Consultation } from "./patient-api";
import { ErrorRow, LoadingRows } from "@/features/workspace/states";
import { actionError, useResource } from "@/features/workspace/use-resource";
import { PrivacyCard, ViewBand, ViewColumns } from "./view-frame";

type Loaded = { appointment: Appointment; consultation: Consultation | null };

/**
 * Text consultation for one appointment (`ConsultationController`). Either participant may open it
 * once the appointment is CONFIRMED and booked as a text consultation; the doctor ends it. Opening
 * notifies the doctor, so it happens only when the patient presses "Join". Not real time.
 */
export function PatientConsultation({ appointmentId, consultationId }: { appointmentId?: string; consultationId?: string }) {
  const router = useRouter();
  const { resource, reload, replace } = useResource(async (signal): Promise<Loaded> => {
    if (consultationId) {
      const consultation = await patientApi.consultation(consultationId, signal);
      return { consultation, appointment: await patientApi.appointment(consultation.appointmentId, signal) };
    }
    if (!appointmentId) throw new Error("No appointment was chosen.");
    return { appointment: await patientApi.appointment(appointmentId, signal), consultation: null };
  }, `${appointmentId}|${consultationId}`);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");

  async function join(appointment: Appointment) {
    setJoining(true);
    setJoinError("");
    try {
      const consultation = await patientApi.openConsultation(appointment.id);
      replace({ appointment, consultation });
      router.replace(`/patient/appointments/consultation?consultation=${encodeURIComponent(consultation.id)}`, { scroll: false });
    } catch (error) {
      setJoinError(actionError(error, "The consultation could not be opened."));
    } finally {
      setJoining(false);
    }
  }

  return (
    <>
      <ViewBand title="Text consultation" description="Write with your doctor during a confirmed text appointment. Replies are not instant." />
      <Link href="/patient/appointments" className="inline-flex min-h-11 items-center gap-2 self-start rounded-sm font-bold text-green-800 hover:text-action">
        <ArrowLeft aria-hidden size={18} /> Back to appointments
      </Link>
      <ViewColumns
        aside={
          <PrivacyCard>
            Only you and the doctor on this appointment can read the consultation. Do not use it for emergencies: MedNet does
            not replace emergency services.
          </PrivacyCard>
        }
      >
        {resource.state === "loading" ? (
          <Card>
            <LoadingRows label="Loading the consultation" />
          </Card>
        ) : resource.state === "error" ? (
          <Card>
            {resource.status === 404 ? (
              <StateMessage kind="empty" title="Consultation not found" description="It may belong to another account, or the link is incomplete." />
            ) : (
              <ErrorRow title="The consultation could not be loaded." onRetry={reload} status={resource.status} />
            )}
          </Card>
        ) : (
          <>
            <AppointmentContext appointment={resource.data.appointment} />
            {resource.data.consultation ? (
              <Thread consultation={resource.data.consultation} patientAccountId={resource.data.appointment.patientAccountId} />
            ) : (
              <JoinCard appointment={resource.data.appointment} joining={joining} error={joinError} onJoin={() => void join(resource.data.appointment)} />
            )}
          </>
        )}
      </ViewColumns>
    </>
  );
}

function AppointmentContext({ appointment }: { appointment: Appointment }) {
  return (
    <Card>
      <CardHeader eyebrow="Appointment" title={appointment.providerName} action={<AppointmentStatusBadge status={appointment.status} />} />
      <DescriptionList
        columns={2}
        className="mt-4"
        items={[
          { term: "When", detail: `${formatSlot(appointment.startsAt, appointment.endsAt)} (${CARE_TIME_ZONE_LABEL})` },
          { term: "Consultation", detail: consultationModeLabel(appointment.consultationMode) },
        ]}
      />
    </Card>
  );
}

function JoinCard({ appointment, joining, error, onJoin }: { appointment: Appointment; joining: boolean; error: string; onJoin: () => void }) {
  const available = appointment.status === "CONFIRMED" && appointment.consultationMode === "TEXT";
  return (
    <Card>
      <CardHeader title={available ? "Join the text consultation" : "Text consultation not available"} titleAs="h3" />
      <p className="mt-1.5 text-data text-text-secondary">
        {available
          ? "Joining opens the consultation if your doctor has not opened it yet, and lets them know you are there."
          : appointment.consultationMode !== "TEXT"
            ? "This appointment is in person."
            : "A text consultation is available once the doctor has confirmed the appointment, and until it is completed."}
      </p>
      {error ? <Alert tone="critical" live="assertive" title={error} className="mt-4" /> : null}
      {available ? (
        <Button className="mt-5" loading={joining} leadingIcon={<MessageSquareText aria-hidden size={18} />} onClick={onJoin}>
          Join text consultation
        </Button>
      ) : null}
    </Card>
  );
}

function Thread({ consultation, patientAccountId }: { consultation: Consultation; patientAccountId: string }) {
  const open = consultation.status === "OPEN";
  return (
    <MessageThread
      threadKey={consultation.id}
      eyebrow="Consultation"
      title={open ? "In progress" : "Ended"}
      headerExtra={<Badge tone={open ? "success" : "neutral"}>{open ? "Open" : "Ended"}</Badge>}
      listLabel="Consultation messages"
      loadPage={(page, size, signal) => patientApi.consultationMessages(consultation.id, page, size, signal)}
      send={(body) => patientApi.sendConsultationMessage(consultation.id, body)}
      isMine={(message) => message.senderAccountId === patientAccountId}
      otherLabel="Doctor"
      canSend={open}
      closedText="The doctor ended this consultation. It can no longer receive messages."
      composerDescription=""
    />
  );
}
