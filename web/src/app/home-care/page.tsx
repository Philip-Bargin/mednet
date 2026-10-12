import type { Metadata } from "next";
import { HomeCareOverview } from "@/features/home-care/views";

export const metadata: Metadata = { title: "Overview" };

export default function Page() {
  return <HomeCareOverview />;
}
