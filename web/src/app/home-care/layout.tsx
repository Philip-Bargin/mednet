import type { Metadata } from "next";
import type { ReactNode } from "react";
import { HomeCareWorkspace } from "@/features/home-care/home-care-workspace";

export const metadata: Metadata = {
  title: { template: "%s · Home care | MedNet", default: "Home care | MedNet" },
  robots: { index: false, follow: false },
};

/** Every /home-care route shares the HOME_CARE session guard and WorkspaceShell (Phase 5C). */
export default function HomeCareLayout({ children }: { children: ReactNode }) {
  return <HomeCareWorkspace>{children}</HomeCareWorkspace>;
}
