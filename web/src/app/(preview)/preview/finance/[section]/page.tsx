import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PREVIEW_SECTION_IDS } from "@/features/preview/fixtures";
import { PreviewSectionPage } from "@/features/preview/views";

export const metadata: Metadata = { title: "Financial officer" };

export default async function Page({ params }: PageProps<"/preview/finance/[section]">) {
  const { section } = await params;
  if (!PREVIEW_SECTION_IDS.finance.includes(section)) notFound();
  return <PreviewSectionPage workspace="finance" id={section} />;
}
