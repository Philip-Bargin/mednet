import type { Metadata } from "next";
import { CollectionOverview } from "@/features/preview/views";

export const metadata: Metadata = { title: "Collection provider" };

export default function Page() {
  return <CollectionOverview />;
}
