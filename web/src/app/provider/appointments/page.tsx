import type { Metadata } from "next";
import { PROVIDER_APPOINTMENT_TABS, type ProviderAppointmentTab } from "@/features/provider/tabs";
import { ProviderAppointments } from "@/features/provider/appointments";

export const metadata: Metadata = { title: "Appointments" };

const first = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

export default async function Page({ searchParams }: PageProps<"/provider/appointments">) {
  const params = await searchParams;
  const requested = first(params.tab);
  const tab = PROVIDER_APPOINTMENT_TABS.includes(requested as ProviderAppointmentTab) ? (requested as ProviderAppointmentTab) : "requests";
  return <ProviderAppointments tab={tab} selectedId={first(params.appointment)} />;
}
