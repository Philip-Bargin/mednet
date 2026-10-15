import { ArrowLeft, Clock, ShieldCheck, Stethoscope } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/layout/wordmark";
import { Card, Eyebrow } from "@/components/ui/card";

/**
 * Account-access layout. The reference has no sign-in design; this is an interpretation built
 * only from its tokens and the homepage hero pattern: brand-50 canvas, action-green eyebrow,
 * semibold H1 (DESIGN_SYSTEM.md §12, deviation 4), the hero's three trust markers, and a white
 * form card whose titles use the rendered 400 weight.
 * Stacks to one column below 1200px; the intro is shortened on phones.
 */
export function AuthShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-sm bg-surface px-4 py-3 text-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-16 max-w-page items-center justify-between gap-4 px-4 md:h-[4.5rem] md:px-6 lg:px-8">
          <Wordmark />
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-sm text-data font-semibold text-green-800 hover:text-action"
          >
            <ArrowLeft aria-hidden size={18} strokeWidth={1.8} />
            Public website
          </Link>
        </div>
      </header>

      <main
        id="main-content"
        className="mx-auto grid w-full max-w-page flex-1 gap-8 px-4 py-8 md:px-6 md:py-12 lg:grid-cols-[1fr_minmax(0,30rem)] lg:items-start lg:gap-16 lg:px-8 lg:py-16"
      >
        <section aria-labelledby="auth-title" className="min-w-0 lg:pt-6">
          <Eyebrow tone="action">{eyebrow}</Eyebrow>
          <h1
            id="auth-title"
            className="mt-3 text-[2.25rem] leading-[2.75rem] font-semibold tracking-[-0.02em] text-green-950 md:text-h1"
          >
            {title}
          </h1>
          <div className="mt-4 max-w-xl text-body text-text-secondary">{description}</div>
          <ul className="mt-6 hidden flex-wrap gap-x-6 gap-y-2 text-caption text-text-secondary md:flex">
            <li className="inline-flex items-center gap-2">
              <ShieldCheck aria-hidden size={16} strokeWidth={1.8} className="text-action" />
              Privacy-minded care
            </li>
            <li className="inline-flex items-center gap-2">
              <Stethoscope aria-hidden size={16} strokeWidth={1.8} className="text-action" />
              Approved providers
            </li>
            <li className="inline-flex items-center gap-2">
              <Clock aria-hidden size={16} strokeWidth={1.8} className="text-action" />
              Clear appointment times
            </li>
          </ul>
        </section>
        <Card as="div" className="min-w-0">
          {children}
        </Card>
      </main>

      <footer className="border-t border-border bg-surface">
        <p className="mx-auto max-w-page px-4 py-5 text-caption text-text-muted md:px-6 lg:px-8">
          MedNet does not replace emergency services.
        </p>
      </footer>
    </div>
  );
}
