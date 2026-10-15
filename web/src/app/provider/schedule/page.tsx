import type { Metadata } from "next";
import { ProviderSchedule } from "@/features/provider/schedule";

export const metadata: Metadata = { title: "Schedule" };

export default function Page() {
  return <ProviderSchedule />;
}
