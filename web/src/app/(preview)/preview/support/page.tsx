import type { Metadata } from "next";
import { SupportOverview } from "@/features/preview/views";

export const metadata: Metadata = { title: "Customer support" };

export default function Page() {
  return <SupportOverview />;
}
