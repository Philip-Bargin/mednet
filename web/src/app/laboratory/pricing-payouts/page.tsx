import type { Metadata } from "next";
import { LaboratoryPricing } from "@/features/laboratory/views";

export const metadata: Metadata = { title: "Pricing & payouts" };

export default function Page() {
  return <LaboratoryPricing />;
}
