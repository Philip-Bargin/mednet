import type { Metadata } from "next";
import { ProvidersView } from "@/features/admin/views";

export const metadata: Metadata = { title: "Providers" };

export default function Page() {
  return <ProvidersView />;
}
