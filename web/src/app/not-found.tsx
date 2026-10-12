import type { Metadata } from "next";
import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";
import { ButtonLink } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/card";

export const metadata: Metadata = { title: "Page not found", robots: { index: false, follow: false } };

/**
 * 404 for unknown addresses and for `notFound()` (disabled preview and development routes). No reference
 * design exists; built from the public shell and existing components (Phase 5E, replaces Next's default).
 */
export default function NotFound() {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only z-50 rounded-sm bg-surface px-4 py-3 text-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <PublicHeader />
      <main id="main-content" className="mx-auto flex max-w-page flex-col items-start gap-5 px-4 py-20 md:px-6 lg:px-8 lg:py-28">
        <Eyebrow tone="action">Error 404</Eyebrow>
        <h1 className="text-h1 text-green-950">Page not found</h1>
        <p className="max-w-xl text-body text-ink-soft">
          The address may be mistyped, or the page may have moved. If you followed a link inside MedNet, sign in again
          and open it from your workspace.
        </p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/">Go to the homepage</ButtonLink>
          <ButtonLink href="/find-care" variant="secondary">
            Find care
          </ButtonLink>
        </div>
      </main>
      <PublicFooter />
    </>
  );
}
