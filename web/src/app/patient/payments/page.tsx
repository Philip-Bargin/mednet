import type { Metadata } from "next";
import { PatientPayments } from "@/features/patient/presentation-views";

export const metadata: Metadata = { title: "Payments" };

export default function PatientPaymentsPage() {
  return <PatientPayments />;
}
