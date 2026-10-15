import type { Metadata } from "next";
import { ProviderOverview } from "@/features/provider/overview";

export const metadata: Metadata = { title: "Overview" };

export default function Page() {
  return <ProviderOverview />;
}
