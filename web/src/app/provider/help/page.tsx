import type { Metadata } from "next";
import { ProviderHelp } from "@/features/provider/presentation-views";

export const metadata: Metadata = { title: "Help & support" };

export default function Page() {
  return <ProviderHelp />;
}
