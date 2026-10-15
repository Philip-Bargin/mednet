import type { Metadata } from "next";
import { PatientProfileForm } from "@/features/patient/profile-form";

export const metadata: Metadata = { title: "Your profile" };

export default function PatientProfilePage() {
  return <PatientProfileForm />;
}
