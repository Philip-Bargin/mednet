import type { Metadata } from "next";
import { LaboratoryResults } from "@/features/laboratory/views";

export const metadata: Metadata = { title: "Results" };

export default function Page() {
  return <LaboratoryResults />;
}
