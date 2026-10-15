import type { Metadata } from "next";
import { LaboratoryOrders } from "@/features/laboratory/views";

export const metadata: Metadata = { title: "Orders" };

export default function Page() {
  return <LaboratoryOrders />;
}
