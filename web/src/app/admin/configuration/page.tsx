import type { Metadata } from "next";
import { ConfigurationPageView } from "@/features/admin/views";

export const metadata: Metadata = { title: "Configuration" };

export default function Page() {
  return <ConfigurationPageView />;
}
