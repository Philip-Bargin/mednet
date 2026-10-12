"use client";

import { Eye } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { FictionalDataBadge } from "@/components/ui/fictional-data-badge";
import { WORKSPACES, type WorkspaceId } from "@/features/workspace/workspaces";

/**
 * Frame for every preview workspace: the shared WorkspaceShell with a persistent "Preview only —
 * Fictional data" banner. No session is read and no API is called anywhere under /preview.
 */
export function PreviewWorkspace({ workspaceId, children }: { workspaceId: WorkspaceId; children: ReactNode }) {
  const workspace = WORKSPACES[workspaceId];
  return (
    <WorkspaceShell
      workspaceId={workspaceId}
      user={{ name: "Preview", description: "Fictional preview" }}
      eyebrow="Current workspace"
      title={workspace.name}
      actions={<FictionalDataBadge />}
      banner={<PreviewBanner />}
    >
      <div className="mx-auto flex max-w-[80rem] flex-col gap-6">{children}</div>
    </WorkspaceShell>
  );
}

export function PreviewBanner() {
  return (
    <div role="note" aria-label="Preview notice" className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-warning-soft px-4 py-2 text-caption text-ink md:px-6 lg:px-8">
      <Eye aria-hidden size={16} strokeWidth={1.8} className="shrink-0 text-warning" />
      <strong className="font-bold text-warning">Preview only — Fictional data</strong>
      <span>This role does not exist in MedNet. Nothing here reads or changes real records.</span>
      <Link href="/preview" className="font-semibold text-green-900 underline underline-offset-2">
        All previews
      </Link>
    </div>
  );
}
