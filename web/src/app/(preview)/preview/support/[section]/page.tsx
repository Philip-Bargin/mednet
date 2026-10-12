import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PREVIEW_SECTION_IDS } from "@/features/preview/fixtures";
import { PreviewSectionPage } from "@/features/preview/views";

export const metadata: Metadata = { title: "Customer support" };

export default async function Page({ params }: PageProps<"/preview/support/[section]">) {
  const { section } = await params;
  if (!PREVIEW_SECTION_IDS.support.includes(section)) notFound();
  return <PreviewSectionPage workspace="support" id={section} />;
}
