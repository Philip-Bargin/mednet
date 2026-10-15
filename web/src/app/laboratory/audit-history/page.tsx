import type { Metadata } from "next";
import { LaboratoryAudit } from "@/features/laboratory/views";

export const metadata: Metadata = { title: "Audit history" };

export default function Page() {
  return <LaboratoryAudit />;
}
