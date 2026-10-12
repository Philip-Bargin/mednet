import type { Metadata } from "next";
import { RECORD_TABS, type RecordTab } from "@/features/patient/format";
import { MedicalInformation } from "@/features/patient/records";

export const metadata: Metadata = { title: "Medical information" };

const first = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

export default async function PatientRecordsPage({ searchParams }: PageProps<"/patient/records">) {
  const params = await searchParams;
  const requested = first(params.tab);
  const tab: RecordTab = RECORD_TABS.includes(requested as RecordTab) ? (requested as RecordTab) : "records";
  return <MedicalInformation tab={tab} recordId={first(params.record)} />;
}
