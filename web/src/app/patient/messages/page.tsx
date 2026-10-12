import type { Metadata } from "next";
import { PatientMessages } from "@/features/patient/messages";

export const metadata: Metadata = { title: "Messages" };

const first = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

export default async function PatientMessagesPage({ searchParams }: PageProps<"/patient/messages">) {
  const params = await searchParams;
  return <PatientMessages conversationId={first(params.conversation)} />;
}
