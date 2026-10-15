import type { Metadata } from "next";
import { EscalationsView } from "@/features/admin/views";

export const metadata: Metadata = { title: "Escalations" };

export default function Page() {
  return <EscalationsView />;
}
