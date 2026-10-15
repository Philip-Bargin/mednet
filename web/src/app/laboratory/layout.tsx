import type { Metadata } from "next";
import type { ReactNode } from "react";
import { LaboratoryWorkspace } from "@/features/laboratory/laboratory-workspace";

export const metadata: Metadata = {
  title: { template: "%s · Laboratory | MedNet", default: "Laboratory | MedNet" },
  robots: { index: false, follow: false },
};

/** Every /laboratory route shares the LABORATORY session guard and WorkspaceShell (Phase 4F). */
export default function LaboratoryLayout({ children }: { children: ReactNode }) {
  return <LaboratoryWorkspace>{children}</LaboratoryWorkspace>;
}
