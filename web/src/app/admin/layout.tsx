import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminWorkspace } from "@/features/admin/admin-workspace";

export const metadata: Metadata = {
  title: { template: "%s · Administration | MedNet", default: "Administration | MedNet" },
  robots: { index: false, follow: false },
};

/**
 * Every /admin route shares one session guard and WorkspaceShell (Phase 4E). The session role picks
 * the super-administrator or administrator menu; the API authorises every request.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminWorkspace>{children}</AdminWorkspace>;
}
