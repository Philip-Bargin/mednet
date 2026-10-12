import type { Metadata } from "next";
import { LaboratoryCatalogue } from "@/features/laboratory/views";

export const metadata: Metadata = { title: "Test catalogue" };

export default function Page() {
  return <LaboratoryCatalogue />;
}
