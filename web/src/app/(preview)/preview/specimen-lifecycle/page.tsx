import type { Metadata } from "next";
import { LifecycleWorkflowMap } from "@/features/preview/views";

export const metadata: Metadata = { title: "Specimen lifecycle" };

export default function Page() {
  return <LifecycleWorkflowMap />;
}
