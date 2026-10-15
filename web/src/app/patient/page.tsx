import type { Metadata } from "next";
import { PatientOverview } from "@/features/patient/overview";

export const metadata: Metadata = { title: "Overview" };

export default function PatientPage() {
  return <PatientOverview />;
}
