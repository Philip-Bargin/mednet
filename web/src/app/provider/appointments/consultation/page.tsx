import type { Metadata } from "next";
import { ProviderConsultation } from "@/features/provider/consultation";

export const metadata: Metadata = { title: "Text consultation" };

const first = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

export default async function Page({ searchParams }: PageProps<"/provider/appointments/consultation">) {
  const params = await searchParams;
  return <ProviderConsultation appointmentId={first(params.appointment)} consultationId={first(params.consultation)} />;
}
