"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { PUBLIC_HEADER_LINKS, routedLinks } from "./public-nav";
import { Wordmark } from "./wordmark";

const navLinks = routedLinks(PUBLIC_HEADER_LINKS);

/**
 * Reference: Navigation/Public header. At compact widths the reference hides the links
 * without a replacement; the menu toggle below is a documented interpretation so that
 * navigation and sign-in remain reachable on phones.
 */
export function PublicHeader() {
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);
  // Closing on navigation: the menu is only open for the path it was opened on.
  const menuOpen = openPath === pathname;

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex h-16 max-w-page items-center gap-8 px-4 md:h-[4.5rem] md:px-6 lg:px-8">
        <Wordmark />

        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex items-center gap-6">
            {navLinks.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  aria-current={pathname === link.href ? "page" : undefined}
                  className="rounded-sm text-data font-semibold text-text-secondary hover:text-action aria-[current=page]:text-action"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-3 md:gap-6">
          <Link
            href="/sign-in"
            className="hidden rounded-sm text-button font-bold text-green-900 hover:text-action md:inline"
          >
            Sign in
          </Link>
          <Link
            href="/find-care"
            className="inline-flex min-h-10 items-center rounded-sm bg-action px-4 text-button font-bold text-white hover:bg-action-hover md:min-h-11 md:px-5"
          >
            Book an appointment
          </Link>
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-sm border border-border text-ink md:hidden"
            aria-expanded={menuOpen}
            aria-controls="public-mobile-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setOpenPath(menuOpen ? null : pathname)}
          >
            {menuOpen ? <X size={20} strokeWidth={1.8} aria-hidden /> : <Menu size={20} strokeWidth={1.8} aria-hidden />}
          </button>
        </div>
      </div>

      <nav
        id="public-mobile-menu"
        aria-label="Main"
        hidden={!menuOpen}
        className={cn("border-t border-border px-4 pb-4 md:hidden")}
      >
        <ul className="flex flex-col">
          {[...navLinks, { label: "Sign in", href: "/sign-in" }].map((link) => (
            <li key={link.label}>
              <Link
                href={link.href}
                className="flex min-h-11 items-center border-b border-line-soft text-body font-semibold text-ink"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
