import type { Metadata } from "next";
import { PatientAppointments } from "@/features/patient/appointments";

export const metadata: Metadata = { title: "Appointments" };

const first = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

export default async function PatientAppointmentsPage({ searchParams }: PageProps<"/patient/appointments">) {
  const params = await searchParams;
  return <PatientAppointments tab={first(params.tab) ?? "appointments"} selectedId={first(params.appointment)} />;
}
