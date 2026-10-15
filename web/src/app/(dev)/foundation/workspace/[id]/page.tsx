import { notFound } from "next/navigation";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { FictionalDataBadge } from "@/components/ui/fictional-data-badge";
import {
  WORKSPACES,
  isWorkspaceId,
  type BackendSupport,
} from "@/features/workspace/workspaces";

const supportLabel: Record<BackendSupport, string> = {
  supported: "API available",
  partial: "Partial API",
  none: "Presentation only",
};

export default async function WorkspacePreviewPage({
  params,
}: PageProps<"/foundation/workspace/[id]">) {
  const { id } = await params;
  if (!isWorkspaceId(id)) notFound();
  const workspace = WORKSPACES[id];

  return (
    <WorkspaceShell
      workspaceId={id}
      user={{ name: "James Brown", description: `${workspace.name} account` }}
      eyebrow="Current workspace"
      title={workspace.name}
      actions={<FictionalDataBadge />}
    >
      <section className="rounded-md border border-border bg-surface p-6 shadow-card">
        <p className="text-eyebrow font-semibold tracking-[0.1em] text-action uppercase">
          Shell preview
        </p>
        <h2 className="mt-1 text-h2 font-semibold">{workspace.label}</h2>
        <p className="mt-2 text-text-secondary">
          Backend role: {workspace.backendRole ?? "not available in the backend yet"}
        </p>
        <ul className="mt-6 divide-y divide-line-soft">
          {workspace.items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <span className="font-semibold">{item.label}</span>
              <span className="text-caption text-text-secondary">
                {item.href} · {supportLabel[item.backend]}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </WorkspaceShell>
  );
}
