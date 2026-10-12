import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { previewsEnabled } from "@/features/preview/access";

export const metadata: Metadata = {
  title: { template: "%s · Preview | MedNet", default: "Operations previews | MedNet" },
  robots: { index: false, follow: false },
};

/** Evaluated per request, so production stays closed unless MEDNET_PREVIEW_WORKSPACES=enabled is set. */
export const dynamic = "force-dynamic";

/**
 * Presentation-only operations workspaces (Phase 4G). Fictional data only: no session is read and no
 * API is called. Not served in production unless a deployment explicitly enables them.
 */
export default function PreviewLayout({ children }: { children: ReactNode }) {
  if (!previewsEnabled()) notFound();
  return children;
}
