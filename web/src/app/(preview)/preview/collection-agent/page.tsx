import type { Metadata } from "next";
import { AgentToday } from "@/features/preview/views";

export const metadata: Metadata = { title: "Collection agent" };

export default function Page() {
  return <AgentToday />;
}
