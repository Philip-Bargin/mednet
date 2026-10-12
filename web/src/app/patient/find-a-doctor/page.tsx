import type { Metadata } from "next";
import { FindCare } from "@/features/find-care/find-care";
import { ViewBand } from "@/features/patient/view-frame";

export const metadata: Metadata = { title: "Find a doctor" };

const first = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");

/** The public discovery view (Phase 4B) inside the workspace; booking returns here after sign-in. */
export default async function PatientFindDoctorPage({ searchParams }: PageProps<"/patient/find-a-doctor">) {
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
    <>
      <ViewBand
        title="Find a doctor"
        description="Search approved providers by name or specialty, then request one of their open times. The doctor confirms each request."
      />
      <FindCare query={query} basePath="/patient/find-a-doctor" />
    </>
  );
}
