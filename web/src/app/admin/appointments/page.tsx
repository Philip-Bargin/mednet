import type { Metadata } from "next";
import { AppointmentsView } from "@/features/admin/views";

export const metadata: Metadata = { title: "Appointments" };

export default function Page() {
  return <AppointmentsView />;
}
