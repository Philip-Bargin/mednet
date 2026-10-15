"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardHeader } from "@/components/ui/card";
import { StateMessage } from "@/components/ui/state-message";
import { formatShortDate } from "@/features/patient/format";
import type { Conversation } from "@/features/patient/patient-api";
import { CountBadge, PrivacyCard, ViewBand } from "@/features/patient/view-frame";
import { MessageThread } from "@/features/workspace/message-thread";
import { ErrorRow, LoadingRows } from "@/features/workspace/states";
import { useResource } from "@/features/workspace/use-resource";
import { cn } from "@/lib/cn";
import { providerApi } from "./provider-api";

/**
 * Secure messages with patients (`MessageController`). Only patients can start a conversation; the
 * provider replies. Patient names come from the provider's own appointments (the conversation record
 * carries only the patient's opaque id).
 */
export function ProviderMessages({ conversationId }: { conversationId?: string }) {
  const { resource, reload } = useResource(async (signal) => {
    const [conversations, appointments] = await Promise.all([providerApi.conversations(signal), providerApi.appointments(0, 100, signal)]);
    const names = new Map(appointments.content.map((a) => [a.patientAccountId, a.patientName]));
    return conversations.map((conversation) => ({ conversation, name: names.get(conversation.patientAccountId) ?? "Patient" }));
  });
  const items = resource.state === "ready" ? resource.data : [];
  const selected = items.find((item) => item.conversation.id === conversationId);

  return (
    <>
      <ViewBand eyebrow="Doctor workspace" title="Messages" description="Patients with a confirmed or completed appointment can write to you here. Replies are not instant." />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <Card>
          <CardHeader eyebrow="Current view" title="Conversations" action={resource.state === "ready" ? <CountBadge count={items.length} noun="conversation" /> : undefined} />
          <div className="mt-4 border-t border-border">
            {resource.state === "loading" ? (
              <LoadingRows label="Loading conversations" rows={2} />
            ) : resource.state === "error" ? (
              <ErrorRow title="Your conversations could not be loaded." onRetry={reload} status={resource.status} />
            ) : items.length ? (
              <ul aria-label="Conversations" className="divide-y divide-line-soft">
                {items.map(({ conversation, name }) => (
                  <li key={conversation.id}>
                    <Link
                      href={`/provider/messages?conversation=${encodeURIComponent(conversation.id)}`}
                      scroll={false}
                      aria-current={conversation.id === conversationId ? "page" : undefined}
                      className={cn("flex min-h-16 items-center gap-3 rounded-sm px-2 py-3 hover:bg-surface-soft", conversation.id === conversationId && "bg-green-50")}
                    >
                      <Avatar name={name} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold text-ink [overflow-wrap:anywhere]">{name}</span>
                        <span className="block text-caption text-text-secondary">Updated {formatShortDate(conversation.updatedAt)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <StateMessage kind="empty" layout="inline" className="mt-4" title="No conversations yet. Patients start conversations from their workspace." />
            )}
          </div>
        </Card>
        <div className={cn("flex min-w-0 flex-col gap-6", selected && "order-first lg:order-none")}>
          {selected ? (
            <ProviderThread key={selected.conversation.id} conversation={selected.conversation} name={selected.name} />
          ) : (
            <Card>
              <StateMessage
                kind="empty"
                title={conversationId && resource.state === "ready" ? "Conversation not found" : "Choose a conversation"}
                description="Select a patient on the left."
              />
            </Card>
          )}
          <PrivacyCard>
            Only you and the patient in each conversation can read it, and only while you have a confirmed or completed
            appointment together.
          </PrivacyCard>
        </div>
      </div>
    </>
  );
}

function ProviderThread({ conversation, name }: { conversation: Conversation; name: string }) {
  return (
    <MessageThread
      threadKey={conversation.id}
      eyebrow="Conversation"
      title={name}
      listLabel={`Messages with ${name}`}
      loadPage={(page, size, signal) => providerApi.messages(conversation.id, page, size, signal)}
      send={(body) => providerApi.sendMessage(conversation.id, body)}
      isMine={(message) => message.senderAccountId !== conversation.patientAccountId}
      otherLabel={name}
      forbiddenTitle="This conversation is closed because there is no current care relationship."
      composerDescription="Use the patient’s record for clinical documentation."
    />
  );
}
