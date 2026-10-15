import type { Metadata } from "next";
import { ProviderClinicalWork } from "@/features/provider/clinical-work";

export const metadata: Metadata = { title: "Clinical work" };

export default function Page() {
  return <ProviderClinicalWork />;
}
