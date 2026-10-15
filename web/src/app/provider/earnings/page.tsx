import type { Metadata } from "next";
import { ProviderEarnings } from "@/features/provider/presentation-views";

export const metadata: Metadata = { title: "Earnings & payouts" };

export default function Page() {
  return <ProviderEarnings />;
}
