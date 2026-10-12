import type { ReactNode } from "react";
import { PreviewWorkspace } from "@/features/preview/preview-shell";

export default function Layout({ children }: { children: ReactNode }) {
  return <PreviewWorkspace workspaceId="finance">{children}</PreviewWorkspace>;
}
