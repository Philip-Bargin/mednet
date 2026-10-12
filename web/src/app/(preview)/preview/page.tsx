import type { Metadata } from "next";
import { PreviewIndex } from "@/features/preview/views";

export const metadata: Metadata = { title: "Operations previews" };

export default function Page() {
  return <PreviewIndex />;
}
