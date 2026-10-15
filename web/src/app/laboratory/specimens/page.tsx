import type { Metadata } from "next";
import { LaboratorySpecimens } from "@/features/laboratory/views";

export const metadata: Metadata = { title: "Specimens" };

export default function Page() {
  return <LaboratorySpecimens />;
}
