import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ProviderWorkspace } from "@/features/provider/provider-workspace";

export const metadata: Metadata = {
  title: { template: "%s · Doctor workspace | MedNet", default: "Doctor workspace | MedNet" },
  robots: { index: false, follow: false },
};

/** Every /provider route shares the session guard, the approval gate and WorkspaceShell (Phase 4D). */
export default function ProviderLayout({ children }: { children: ReactNode }) {
  return <ProviderWorkspace>{children}</ProviderWorkspace>;
}
