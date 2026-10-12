"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { StateMessage } from "@/components/ui/state-message";
import { loadCareTeam, type CareTeamMember } from "./care-team";
import { formatDate } from "./format";
import { patientApi, type RecordConsent } from "./patient-api";
import { ErrorRow, LoadingRows } from "@/features/workspace/states";
import { actionError, useResource } from "@/features/workspace/use-resource";

type Pending = { member: CareTeamMember; grant: boolean };

/**
 * Per-provider record consent (OQ-07, `PatientRecordController` /me/record-consents). Consent lets a
 * doctor with a confirmed appointment read and add to the patient's records, see their vital
 * readings and review their laboratory results. Both conditions are enforced by the API.
 */
export function RecordSharingPanel() {
  const { resource, reload, replace } = useResource((signal) => loadCareTeam(signal));
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "critical"; text: string } | null>(null);

  const consentFor = (providerId: string): RecordConsent | undefined =>
    resource.state === "ready" ? resource.data.consents.find((consent) => consent.providerId === providerId) : undefined;

  async function confirm() {
    if (!pending || resource.state !== "ready") return;
    setBusy(true);
    try {
      const updated = pending.grant
        ? await patientApi.grantConsent(pending.member.providerId)
        : await patientApi.revokeConsent(pending.member.providerId);
      const others = resource.data.consents.filter((consent) => consent.providerId !== updated.providerId);
      replace({ ...resource.data, consents: [updated, ...others] });
      setNotice({
        tone: "success",
        text: pending.grant ? `${pending.member.name} can now see your records.` : `${pending.member.name} can no longer see your records.`,
      });
    } catch (error) {
      setNotice({ tone: "critical", text: actionError(error, "Your sharing choice could not be saved.") });
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  return (
    <Card>
      <CardHeader eyebrow="Sharing" title="Who can see your records" />
      <p className="mt-1.5 text-data text-text-secondary">
        A doctor can read and add to your records, see your vital readings and review your laboratory results only while
        both are true: you have a confirmed or completed appointment with them, and you have allowed access here.
      </p>
      {notice ? (
        <Alert tone={notice.tone} live={notice.tone === "critical" ? "assertive" : "polite"} title={notice.text} className="mt-4" />
      ) : null}
      <div className="mt-4 border-t border-border">
        {resource.state === "loading" ? (
          <LoadingRows label="Loading your care team" rows={2} />
        ) : resource.state === "error" ? (
          <ErrorRow title="Your sharing settings could not be loaded." onRetry={reload} status={resource.status} />
        ) : resource.data.team.length ? (
          <ul aria-label="Your doctors" className="divide-y divide-line-soft">
            {resource.data.team.map((member) => {
              const consent = consentFor(member.providerId);
              const granted = consent?.status === "GRANTED";
              return (
                <li key={member.providerId} className="flex flex-wrap items-center gap-3 py-4">
                  <Avatar name={member.name} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink [overflow-wrap:anywhere]">{member.name}</p>
                    <p className="text-caption text-text-secondary">
                      {[
                        member.specialty,
                        granted && consent?.grantedAt
                          ? `Allowed since ${formatDate(consent.grantedAt)}`
                          : consent?.revokedAt
                            ? `Withdrawn ${formatDate(consent.revokedAt)}`
                            : "Not allowed",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <Badge tone={granted ? "success" : "neutral"}>{granted ? "Can see records" : "No access"}</Badge>
                  <Button
                    size="sm"
                    variant={granted ? "tertiary" : "secondary"}
                    aria-label={granted ? `Withdraw access for ${member.name}` : `Allow ${member.name} to see your records`}
                    onClick={() => {
                      setNotice(null);
                      setPending({ member, grant: !granted });
                    }}
                  >
                    {granted ? "Withdraw" : "Allow access"}
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : (
          <StateMessage
            kind="empty"
            className="mt-4"
            title="No doctors to share with yet"
            description="Doctors appear here after they confirm an appointment with you."
            action={<ButtonLink href="/patient/find-a-doctor" variant="secondary">Find a doctor</ButtonLink>}
          />
        )}
      </div>

      <ConfirmDialog
        open={pending !== null}
        onClose={() => !busy && setPending(null)}
        onConfirm={() => void confirm()}
        loading={busy}
        tone={pending?.grant ? "default" : "destructive"}
        title={pending?.grant ? `Allow ${pending.member.name} to see your records?` : `Withdraw access for ${pending?.member.name ?? "this doctor"}?`}
        description={
          pending?.grant
            ? "They will be able to read and add to your records, see your vital readings and review your laboratory results while you have a confirmed or completed appointment with them. You can withdraw this at any time."
            : "They will no longer be able to read your records, vital readings or laboratory results. Records they already added stay in your file."
        }
        confirmLabel={pending?.grant ? "Allow access" : "Withdraw access"}
      />
    </Card>
  );
}
