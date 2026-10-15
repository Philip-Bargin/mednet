import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PatientWorkspace } from "@/features/patient/patient-workspace";

export const metadata: Metadata = {
  title: { template: "%s · Patient workspace | MedNet", default: "Patient workspace | MedNet" },
  robots: { index: false, follow: false },
};

/** Every /patient route shares the session guard and WorkspaceShell (Phase 4C). */
export default function PatientLayout({ children }: { children: ReactNode }) {
  return <PatientWorkspace>{children}</PatientWorkspace>;
}
