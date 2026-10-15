import type { Metadata } from "next";
import { OnboardingView } from "@/features/admin/views";

export const metadata: Metadata = { title: "Onboarding" };

export default async function Page({ searchParams }: PageProps<"/admin/onboarding">) {
  const { tab } = await searchParams;
  return <OnboardingView tab={typeof tab === "string" ? tab : undefined} />;
}
