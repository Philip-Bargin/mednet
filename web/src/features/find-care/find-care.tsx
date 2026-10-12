"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DoctorCard } from "@/components/healthcare/doctor-card";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/inputs";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { StateMessage } from "@/components/ui/state-message";
import { AvailabilityDrawer } from "./availability-drawer";
import { CARE_TIME_ZONE_LABEL, formatNextAvailable } from "./format";
import { DIRECTORY_FILTER_MAX, getProvider, listProviders, type DirectoryProvider } from "./provider-api";

const PAGE_SIZE = 12;

export type FindCareQuery = {
  search: string;
  specialty: string;
  /** 1-based */
  page: number;
  provider?: string;
  slot?: string;
};

type Results =
  | { state: "loading" }
  | { state: "error" }
  | { state: "ready"; providers: DirectoryProvider[]; total: number; totalPages: number };

/** Public discovery path; the patient workspace hosts the same view at `/patient/find-a-doctor`. */
export const FIND_CARE_PATH = "/find-care";

export function findCareHref(
  { search, specialty, page, provider, slot }: Partial<FindCareQuery>,
  basePath: string = FIND_CARE_PATH,
) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (specialty) params.set("specialty", specialty);
  if (page && page > 1) params.set("page", String(page));
  if (provider) params.set("provider", provider);
  if (slot) params.set("slot", slot);
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

/**
 * Public provider discovery over GET /providers. State lives in the URL so results can be shared,
 * survive sign-in (`?redirect=`), and work with the browser's back button.
 */
export function FindCare({ query, basePath = FIND_CARE_PATH }: { query: FindCareQuery; basePath?: string }) {
  const router = useRouter();
  const [loaded, setLoaded] = useState<{ key: string; results: Results } | null>(null);
  const [fallbackProvider, setFallbackProvider] = useState<DirectoryProvider | null>(null);
  const [attempt, setAttempt] = useState(0);
  const { search, specialty, page, provider: providerId, slot } = query;
  // Results belong to the query that produced them; a new query reads as loading until it answers.
  const requestKey = JSON.stringify([search, specialty, page, attempt]);
  const results: Results = loaded?.key === requestKey ? loaded.results : { state: "loading" };

  useEffect(() => {
    const controller = new AbortController();
    const setResults = (next: Results) => setLoaded({ key: requestKey, results: next });
    listProviders({ search, specialty, page: page - 1, size: PAGE_SIZE }, controller.signal)
      .then((result) => {
        setResults({
          state: "ready",
          providers: result.content,
          total: result.totalElements,
          totalPages: result.totalPages,
        });
        // nextAvailableAt arrives with each entry (Phase 5D): no availability call per provider.
      })
      .catch(() => {
        if (!controller.signal.aborted) setResults({ state: "error" });
      });
    return () => controller.abort();
  }, [search, specialty, page, requestKey]);

  const listed = results.state === "ready" ? results.providers.find((p) => p.id === providerId) : undefined;

  // A provider opened from a link (homepage, sign-in return) may not be on this results page.
  useEffect(() => {
    if (!providerId || listed || results.state !== "ready") return;
    const controller = new AbortController();
    getProvider(providerId, controller.signal)
      .then(setFallbackProvider)
      .catch(() => {
        if (!controller.signal.aborted) setFallbackProvider(null);
      });
    return () => controller.abort();
  }, [providerId, listed, results.state]);

  const selectedProvider = listed ?? (fallbackProvider?.id === providerId ? fallbackProvider : null);
  const go = (next: Partial<FindCareQuery>) =>
    router.push(findCareHref({ search, specialty, page, ...next }, basePath), { scroll: false });

  return (
    <div className="flex flex-col gap-8">
      <form action={basePath} method="get" role="search" aria-label="Search providers" className="flex flex-col gap-3 md:flex-row md:items-end">
        <SearchInput
          key={search}
          name="search"
          label="Doctor name or specialty"
          hideLabel={false}
          defaultValue={search}
          maxLength={DIRECTORY_FILTER_MAX}
          fieldClassName="flex-1"
        />
        {specialty ? <input type="hidden" name="specialty" value={specialty} /> : null}
        <Button type="submit" className="md:w-40">
          Search
        </Button>
      </form>

      {specialty || search ? (
        <div className="flex flex-wrap items-center gap-2 text-data text-text-secondary">
          <span>Filtered by</span>
          {specialty ? (
            <Link
              href={findCareHref({ search }, basePath)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border bg-surface px-3 font-semibold text-ink hover:border-action"
              aria-label={`Remove specialty filter: ${specialty}`}
            >
              Specialty: {specialty}
              <X aria-hidden size={14} strokeWidth={2} />
            </Link>
          ) : null}
          {search ? (
            <Link
              href={findCareHref({ specialty }, basePath)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border bg-surface px-3 font-semibold text-ink hover:border-action"
              aria-label={`Remove search: ${search}`}
            >
              “{search}”
              <X aria-hidden size={14} strokeWidth={2} />
            </Link>
          ) : null}
        </div>
      ) : null}

      <section aria-labelledby="results-title" className="flex flex-col gap-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="results-title" className="text-title text-ink">
            Approved providers
          </h2>
          <p role="status" className="text-data text-text-secondary">
            {results.state === "ready"
              ? `${results.total} ${results.total === 1 ? "provider" : "providers"} found`
              : results.state === "loading"
                ? "Searching…"
                : ""}
          </p>
        </div>

        {results.state === "error" ? (
          <StateMessage
            kind="error"
            title="Providers could not be loaded"
            description="The provider directory is unavailable right now."
            action={
              <Button variant="secondary" size="sm" onClick={() => setAttempt((count) => count + 1)}>
                Try again
              </Button>
            }
          />
        ) : results.state === "ready" && results.providers.length === 0 ? (
          <StateMessage
            kind="empty"
            title={search || specialty ? "No providers match your search" : "No providers are listed yet"}
            description={
              search || specialty
                ? "Try a different name or specialty, or clear the filters."
                : "Approved providers appear here once a MedNet administrator has reviewed their application."
            }
            action={
              search || specialty ? (
                <Link href={basePath} className="text-data font-bold text-green-800 underline">
                  Clear filters
                </Link>
              ) : undefined
            }
          />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy={results.state === "loading"}>
            {results.state === "loading"
              ? Array.from({ length: 6 }, (_, index) => (
                  <li key={index} className="rounded-md border border-border bg-surface p-5">
                    <Skeleton className="size-14 rounded-full" />
                    <Skeleton className="mt-5 h-5 w-2/3" />
                    <Skeleton className="mt-3 h-4 w-1/2" />
                    <Skeleton className="mt-8 h-11 w-full" />
                  </li>
                ))
              : results.providers.map((provider) => (
                  <li key={provider.id}>
                    <DoctorCard
                      name={provider.displayName}
                      specialty={provider.specialty}
                      nextAvailable={
                        provider.nextAvailableAt ? formatNextAvailable(provider.nextAvailableAt) : undefined
                      }
                      approved
                      href={findCareHref({ search, specialty, page, provider: provider.id }, basePath)}
                      actionLabel="See open times"
                      current={provider.id === providerId}
                    />
                  </li>
                ))}
          </ul>
        )}

        {results.state === "ready" ? (
          <Pagination
            page={page}
            totalPages={results.totalPages}
            onPageChange={(next) => go({ page: next, provider: undefined })}
            label="Provider results pages"
          />
        ) : null}
        <p className="text-caption text-text-muted">Appointment times are shown in {CARE_TIME_ZONE_LABEL}.</p>
      </section>

      {providerId ? (
        <AvailabilityDrawer
          key={providerId}
          provider={selectedProvider}
          providerId={providerId}
          initialSlotId={slot}
          basePath={basePath}
          onClose={() => go({ provider: undefined, slot: undefined })}
        />
      ) : null}
    </div>
  );
}
