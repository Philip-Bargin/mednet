import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PREVIEW_SECTION_IDS } from "@/features/preview/fixtures";
import { PreviewSectionPage } from "@/features/preview/views";

export const metadata: Metadata = { title: "Collection agent" };

export default async function Page({ params }: PageProps<"/preview/collection-agent/[section]">) {
  const { section } = await params;
  if (!PREVIEW_SECTION_IDS.agent.includes(section)) notFound();
  return <PreviewSectionPage workspace="agent" id={section} />;
}
