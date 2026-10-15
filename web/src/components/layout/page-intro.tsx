import type { ReactNode } from "react";
import { Eyebrow } from "@/components/ui/card";

/**
 * Intro band for public information pages without a reference layout (About, Services, Find care).
 * Built from the homepage hero: the same brand gradient, action-green eyebrow and semibold heading,
 * at H1 size instead of display size. Interpretation logged in DESIGN_SYSTEM.md §14.
 */
export function PageIntro({
  eyebrow,
  title,
  children,
  actions,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="bg-[linear-gradient(105deg,#f9faf8_0%,#f2f6f3_56%,#e7f2ed_100%)]">
      <div className="mx-auto max-w-page px-4 py-12 md:px-6 md:py-16 lg:px-8 lg:py-20">
        <Eyebrow tone="action">{eyebrow}</Eyebrow>
        <h1 className="mt-3 max-w-3xl text-[2.25rem] leading-[2.75rem] font-semibold tracking-[-0.03em] text-green-950 md:text-[3rem] md:leading-[3.5rem]">
          {title}
        </h1>
        <div className="mt-4 max-w-2xl text-[1.125rem] leading-[1.65] text-text-secondary">{children}</div>
        {actions ? <div className="mt-8 flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </div>
  );
}
