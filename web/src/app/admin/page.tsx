import type { Metadata } from "next";
import { AdminOverviewPage } from "@/features/admin/overview";

export const metadata: Metadata = { title: "Overview" };

export default function Page() {
  return <AdminOverviewPage />;
}
