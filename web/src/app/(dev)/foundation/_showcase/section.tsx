import type { ReactNode } from "react";

/** One showcase section with its traceability note back to the Figma reference. */
export function ShowcaseSection({
  id,
  title,
  reference,
  children,
}: {
  id: string;
  title: string;
  /** Where the component appears in the reference, or "Interpretation" when it is not drawn. */
  reference: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-6 space-y-5 border-t border-border pt-10">
      <div>
        <h2 id={`${id}-title`} className="text-h2 font-semibold text-ink">
          {title}
        </h2>
        <p className="mt-1 text-caption text-text-muted">Reference: {reference}</p>
      </div>
      {children}
    </section>
  );
}

export function Specimen({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-3">
      <p className="text-caption font-semibold text-text-secondary">{label}</p>
      {children}
    </div>
  );
}
