import type { Metadata } from "next";
import { FinanceOverview } from "@/features/preview/views";

export const metadata: Metadata = { title: "Financial officer" };

export default function Page() {
  return <FinanceOverview />;
}
