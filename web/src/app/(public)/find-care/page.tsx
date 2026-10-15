import type { Metadata } from "next";
import { PageIntro } from "@/components/layout/page-intro";
import { FindCare } from "@/features/find-care/find-care";

export const metadata: Metadata = {
  title: "Find a doctor",
  description: "Search MedNet's approved providers by name or specialty and request an open appointment time.",
};

const first = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");

/**
 * Doctor discovery and appointment requests. The reference has component previews (doctor card,
 * appointment card) but no discovery page, so this layout is an interpretation (DESIGN_SYSTEM.md §14).
 */
export default async function FindCarePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const page = Number.parseInt(first(params.page), 10);
  const query = {
    search: first(params.search).slice(0, 120),
    specialty: first(params.specialty).slice(0, 120),
    page: Number.isFinite(page) && page > 0 ? page : 1,
    provider: first(params.provider) || undefined,
    slot: first(params.slot) || undefined,
  };

  return (
    <main id="main-content">
      <PageIntro eyebrow="Find care" title="Find a doctor">
        Search approved providers by name or specialty, then request one of their open appointment times. The doctor
        confirms each request.
      </PageIntro>
      <div className="mx-auto max-w-page px-4 py-10 md:px-6 md:py-14 lg:px-8">
        <FindCare query={query} />
      </div>
    </main>
  );
}
