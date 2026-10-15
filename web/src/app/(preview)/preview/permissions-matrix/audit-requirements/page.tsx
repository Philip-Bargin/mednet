import type { Metadata } from "next";
import { AuditRequirements } from "@/features/preview/views";

export const metadata: Metadata = { title: "Audit requirements" };

export default function Page() {
  return <AuditRequirements />;
}
