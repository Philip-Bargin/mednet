import type { Metadata } from "next";
import { ProviderMessages } from "@/features/provider/messages";

export const metadata: Metadata = { title: "Messages" };

const first = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

export default async function Page({ searchParams }: PageProps<"/provider/messages">) {
  const params = await searchParams;
  return <ProviderMessages conversationId={first(params.conversation)} />;
}
