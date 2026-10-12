import type { Metadata } from "next";
import { LaboratoryProfile } from "@/features/laboratory/views";

export const metadata: Metadata = { title: "Your account" };

export default function Page() {
  return <LaboratoryProfile />;
}
