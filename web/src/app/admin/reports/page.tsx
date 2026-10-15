import type { Metadata } from "next";
import { ReportsPageView } from "@/features/admin/views";

export const metadata: Metadata = { title: "Reports" };

export default function Page() {
  return <ReportsPageView />;
}
