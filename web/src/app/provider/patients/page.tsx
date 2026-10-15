import type { Metadata } from "next";
import { ProviderPatients } from "@/features/provider/patients";

export const metadata: Metadata = { title: "Patients" };

export default function Page() {
  return <ProviderPatients />;
}
