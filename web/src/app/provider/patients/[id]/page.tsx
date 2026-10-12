import type { Metadata } from "next";
import { PATIENT_TABS, type PatientTab } from "@/features/provider/tabs";
import { ProviderPatientDetail } from "@/features/provider/patients";

export const metadata: Metadata = { title: "Patient" };

const first = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

export default async function Page({ params, searchParams }: PageProps<"/provider/patients/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const requested = first(query.tab);
  const tab = PATIENT_TABS.includes(requested as PatientTab) ? (requested as PatientTab) : "records";
  return <ProviderPatientDetail patientAccountId={id} tab={tab} />;
}
