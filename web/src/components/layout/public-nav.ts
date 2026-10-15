/**
 * Public navigation from the reference header and footer. Entries without a route are
 * kept here (href: null) so the design inventory stays visible, but are not rendered
 * until their pages exist — the frontend must not link to pages that do not exist.
 */
export type PublicLink = { label: string; href: string | null };

export const PUBLIC_HEADER_LINKS: PublicLink[] = [
  { label: "Find care", href: "/find-care" },
  { label: "How it works", href: "/about" },
  { label: "For providers", href: null },
  { label: "Help", href: null },
];

export const PUBLIC_FOOTER_COLUMNS: Array<{ title: string; links: PublicLink[] }> = [
  {
    title: "Get care",
    links: [
      { label: "Find a doctor", href: "/find-care" },
      { label: "How it works", href: "/about" },
      { label: "Laboratory services", href: "/services#laboratory" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "For providers", href: null },
      { label: "About MedNet", href: "/about" },
      { label: "Contact", href: null },
    ],
  },
  {
    title: "Support and policies",
    links: [
      { label: "Help center", href: null },
      { label: "Privacy", href: null },
      { label: "Accessibility", href: null },
      { label: "Terms of service", href: null },
    ],
  },
];

export function routedLinks(links: PublicLink[]) {
  return links.filter(
    (link): link is { label: string; href: string } => link.href !== null,
  );
}
