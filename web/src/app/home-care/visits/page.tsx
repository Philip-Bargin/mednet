import type { Metadata } from "next";
import { HomeCareVisits } from "@/features/home-care/views";

export const metadata: Metadata = { title: "Visits" };

export default function Page() {
  return <HomeCareVisits />;
}
