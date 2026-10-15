import type { Metadata } from "next";
import { PatientHelp } from "@/features/patient/presentation-views";

export const metadata: Metadata = { title: "Help & support" };

export default function PatientHelpPage() {
  return <PatientHelp />;
}
