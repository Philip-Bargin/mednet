import type { Metadata } from "next";
import { VerificationView } from "@/features/admin/views";

export const metadata: Metadata = { title: "Verification" };

export default function Page() {
  return <VerificationView />;
}
