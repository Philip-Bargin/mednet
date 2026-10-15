import type { Metadata } from "next";
import { LifecycleDependencyList } from "@/features/preview/views";

export const metadata: Metadata = { title: "Dependencies" };

export default function Page() {
  return <LifecycleDependencyList />;
}
