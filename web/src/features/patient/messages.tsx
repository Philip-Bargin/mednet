"use client";

import { MessageThread } from "@/features/workspace/message-thread";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { SelectField } from "@/components/ui/inputs";
import { StateMessage } from "@/components/ui/state-message";
import { cn } from "@/lib/cn";
import { loadCareTeam } from "./care-team";
import { formatShortDate } from "./format";
import { patientApi, type Conversation } from "./patient-api";
import { ErrorRow, LoadingRows } from "@/features/workspace/states";
import { actionError, useResource } from "@/features/workspace/use-resource";
import { CountBadge, PrivacyCard, ViewBand } from "./view-frame";


/**
 * Secure messages with doctors the patient has a care relationship with (`MessageController`).
 * Not real time: new replies appear on refresh. Not for emergencies.
 */
export function PatientMessages({ conversationId }: { conversationId?: string }) {
  const router = useRouter();
  const { resource, reload, replace } = useResource((signal) => loadCareTeam(signal));
  const conversations = resource.state === "ready" ? resource.data.conversations : [];
  const selected = conversations.find((conversation) => conversation.id === conversationId);

  const open = (id: string) => router.push(`/patient/messages?conversation=${encodeURIComponent(id)}`, { scroll: false });

  return (
    <>
      <ViewBand
        title="Messages"
        description="Write to doctors you have a confirmed appointment with. Replies are not instant."
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader
              eyebrow="Current view"
              title="Conversations"
              action={resource.state === "ready" ? <CountBadge count={conversations.length} noun="conversation" /> : undefined}
            />
            <div className="mt-4 border-t border-border">
              {resource.state === "loading" ? (
                <LoadingRows label="Loading conversations" rows={2} />
              ) : resource.state === "error" ? (
                <ErrorRow title="Your conversations could not be loaded." onRetry={reload} status={resource.status} />
              ) : conversations.length ? (
                <ul aria-label="Conversations" className="divide-y divide-line-soft">
                  {conversations.map((conversation) => (
                    <li key={conversation.id}>
                      <Link
                        href={`/patient/messages?conversation=${encodeURIComponent(conversation.id)}`}
                        scroll={false}
                        aria-current={conversation.id === conversationId ? "page" : undefined}
                        className={cn(
                          "flex min-h-16 items-center gap-3 rounded-sm px-2 py-3 hover:bg-surface-soft",
                          conversation.id === conversationId && "bg-green-50",
                        )}
                      >
                        <Avatar name={conversation.providerDisplayName} />
                        <span className="min-w-0 flex-1">
                          <span className="block font-bold text-ink [overflow-wrap:anywhere]">{conversation.providerDisplayName}</span>
                          <span className="block text-caption text-text-secondary">Updated {formatShortDate(conversation.updatedAt)}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <StateMessage kind="empty" layout="inline" className="mt-4" title="No conversations yet." />
              )}
            </div>
          </Card>
          {resource.state === "ready" ? (
            <NewConversation
              candidates={resource.data.team.filter(
                (member) => !conversations.some((conversation) => conversation.providerId === member.providerId),
              )}
              onOpened={(conversation) => {
                replace({ ...resource.data, conversations: [conversation, ...conversations] });
                open(conversation.id);
              }}
            />
          ) : null}
        </div>

        {/* On phones an open conversation comes before the list. */}
        <div className={cn("flex min-w-0 flex-col gap-6", selected && "order-first lg:order-none")}>
          {selected ? (
            <Thread key={selected.id} conversation={selected} />
          ) : (
            <Card>
              <StateMessage
                kind="empty"
                title={conversationId && resource.state === "ready" ? "Conversation not found" : "Choose a conversation"}
                description="Select a doctor on the left, or start a conversation with a doctor from your care team."
              />
            </Card>
          )}
          <PrivacyCard>
            Only you and the doctor in each conversation can read it, and only while you have a confirmed or completed
            appointment together.
          </PrivacyCard>
        </div>
      </div>
    </>
  );
}

function NewConversation({
  candidates,
  onOpened,
}: {
  candidates: Array<{ providerId: string; name: string; specialty: string }>;
  onOpened: (conversation: Conversation) => void;
}) {
  const [providerId, setProviderId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!candidates.length) return null;

  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!providerId) return setError("Choose a doctor.");
    setBusy(true);
    setError("");
    try {
      onOpened(await patientApi.openConversation(providerId));
      setProviderId("");
    } catch (failure) {
      setError(actionError(failure, "The conversation could not be started."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Start a conversation" titleAs="h3" />
      <form noValidate onSubmit={start} className="mt-4 flex flex-col gap-4">
        <SelectField
          label="Doctor"
          value={providerId}
          error={error || undefined}
          onChange={(event) => setProviderId(event.target.value)}
          placeholder="Choose a doctor"
          options={candidates.map((member) => ({
            value: member.providerId,
            label: member.specialty ? `${member.name} · ${member.specialty}` : member.name,
          }))}
        />
        <div>
          <Button type="submit" variant="secondary" loading={busy}>
            Start conversation
          </Button>
        </div>
      </form>
    </Card>
  );
}

function Thread({ conversation }: { conversation: Conversation }) {
  return (
    <MessageThread
      threadKey={conversation.id}
      eyebrow="Conversation"
      title={conversation.providerDisplayName}
      listLabel={`Messages with ${conversation.providerDisplayName}`}
      loadPage={(page, size, signal) => patientApi.messages(conversation.id, page, size, signal)}
      send={(body) => patientApi.sendMessage(conversation.id, body)}
      isMine={(message) => message.senderAccountId === conversation.patientAccountId}
      otherLabel={conversation.providerDisplayName}
      forbiddenTitle="This conversation is closed because there is no current care relationship."
    />
  );
}
