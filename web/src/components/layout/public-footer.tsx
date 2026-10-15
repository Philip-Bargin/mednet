import Link from "next/link";
import { PUBLIC_FOOTER_COLUMNS, routedLinks } from "./public-nav";
import { Wordmark } from "./wordmark";

const columns = PUBLIC_FOOTER_COLUMNS.map((column) => ({
  ...column,
  links: routedLinks(column.links),
})).filter((column) => column.links.length > 0);

/** Reference: public footer (brand column, link columns, bottom bar). */
export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto grid max-w-page gap-10 px-4 py-12 md:grid-cols-[1.4fr_repeat(3,1fr)] md:px-6 lg:px-8">
        <div className="space-y-3">
          <Wordmark />
          <p className="text-body text-text-secondary">
            Professional healthcare access for Liberia.
          </p>
          <p className="text-caption text-text-muted">
            MedNet does not replace emergency services.
          </p>
        </div>
        {columns.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h2 className="mb-3 text-caption font-semibold text-ink">
              {column.title}
            </h2>
            <ul className="space-y-2">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="rounded-sm text-caption text-text-secondary hover:text-action"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="mx-auto flex max-w-page flex-wrap justify-between gap-2 border-t border-border px-4 py-5 text-caption text-text-muted md:px-6 lg:px-8">
        <span>&copy; {new Date().getFullYear()} MedNet.</span>
        <span>English &middot; Liberia</span>
      </div>
    </footer>
  );
}
