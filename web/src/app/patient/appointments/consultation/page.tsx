import type { Metadata } from "next";
import { PatientConsultation } from "@/features/patient/consultation";

export const metadata: Metadata = { title: "Text consultation" };

const first = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

export default async function PatientConsultationPage({ searchParams }: PageProps<"/patient/appointments/consultation">) {
  const params = await searchParams;
  return <PatientConsultation appointmentId={first(params.appointment)} consultationId={first(params.consultation)} />;
}
