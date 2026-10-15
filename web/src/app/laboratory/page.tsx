import type { Metadata } from "next";
import { LaboratoryOverview } from "@/features/laboratory/views";

export const metadata: Metadata = { title: "Overview" };

export default function Page() {
  return <LaboratoryOverview />;
}
