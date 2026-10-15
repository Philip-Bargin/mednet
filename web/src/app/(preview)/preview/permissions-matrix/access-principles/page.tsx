import type { Metadata } from "next";
import { AccessPrinciples } from "@/features/preview/views";

export const metadata: Metadata = { title: "Access principles" };

export default function Page() {
  return <AccessPrinciples />;
}
