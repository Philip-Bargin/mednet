import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PREVIEW_SECTION_IDS } from "@/features/preview/fixtures";
import { PreviewSectionPage } from "@/features/preview/views";

export const metadata: Metadata = { title: "Collection provider" };

export default async function Page({ params }: PageProps<"/preview/collection/[section]">) {
  const { section } = await params;
  if (!PREVIEW_SECTION_IDS.collection.includes(section)) notFound();
  return <PreviewSectionPage workspace="collection" id={section} />;
}
