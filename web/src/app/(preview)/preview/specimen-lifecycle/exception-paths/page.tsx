import type { Metadata } from "next";
import { LifecycleExceptionPaths } from "@/features/preview/views";

export const metadata: Metadata = { title: "Exception paths" };

export default function Page() {
  return <LifecycleExceptionPaths />;
}
