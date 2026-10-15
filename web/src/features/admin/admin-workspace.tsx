"use client";

import { UserRound } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Menu } from "@/components/ui/menu";
import { StateMessage } from "@/components/ui/state-message";
import { getSession, signOut, type Session } from "@/lib/api";
import { WorkspaceAccessState, type WorkspaceAccess } from "@/features/workspace/access-state";
import { SESSION_EXPIRED_EVENT } from "@/features/workspace/use-resource";
import { WORKSPACES, homePathForRole } from "@/features/workspace/workspaces";
import { adminCapabilities, isAdminRole, routeBelongsToWorkspace, workspaceIdForRole, type AdminCapabilities, type AdminRole } from "./permissions";

/**
 * Administration frame for both administrative roles. One URL tree (`/admin/*`) and one guard; the
 * session role picks the workspace: SUPER_ADMIN gets the super-administrator menu, ADMIN the
 * administrator menu. Spring Security admits only these two roles to `/api/v1/admin/**` and checks
 * SUPER_ADMIN again on the high-impact account endpoints, so this guard is navigation, not security.
 */
type AdminContextValue = {
  session: Session;
  role: AdminRole;
  can: AdminCapabilities;
};

const AdminContext = createContext<AdminContextValue | null>(null);

export function useAdmin(): AdminContextValue {
  const value = useContext(AdminContext);
  if (!value) throw new Error("useAdmin must be used inside AdminWorkspace");
  return value;
}

export function AdminWorkspace({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [access, setAccess] = useState<WorkspaceAccess | { state: "ready"; session: Session; role: AdminRole }>({
    state: "checking",
  });
  const [attempt, setAttempt] = useState(0);
  const [signOutFailed, setSignOutFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    getSession(signal)
      .then((session) => {
        if (signal.aborted) return;
        if (!session) return setAccess({ state: "signed-out" });
        if (!isAdminRole(session.role)) {
          setAccess({ state: "redirecting" });
          router.replace(homePathForRole(session.role));
          return;
        }
        setAccess({ state: "ready", session, role: session.role });
      })
      .catch(() => !signal.aborted && setAccess({ state: "error" }));
    return () => controller.abort();
  }, [router, attempt]);

  useEffect(() => {
    const expire = () => setAccess({ state: "expired" });
    window.addEventListener(SESSION_EXPIRED_EVENT, expire);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, expire);
  }, []);

  async function endSession() {
    setSignOutFailed(false);
    try {
      await signOut();
      router.replace("/sign-in");
    } catch {
      setSignOutFailed(true);
    }
  }

  if (access.state !== "ready") {
    return (
      <WorkspaceAccessState
        access={access}
        pathname={pathname}
        workspaceLabel="Administration"
        onRetry={() => setAttempt((count) => count + 1)}
      />
    );
  }

  const workspaceId = workspaceIdForRole(access.role);
  const workspace = WORKSPACES[workspaceId];
  const inWorkspace = routeBelongsToWorkspace(access.role, pathname);

  return (
    <AdminContext.Provider value={{ session: access.session, role: access.role, can: adminCapabilities(access.role) }}>
      <WorkspaceShell
        workspaceId={workspaceId}
        user={{ name: access.session.email, description: workspace.name }}
        eyebrow="Current workspace"
        title={workspace.name}
        actions={
          <Menu
            label={
              <>
                <UserRound aria-hidden size={18} strokeWidth={1.8} className="md:hidden" />
                <span className="sr-only md:not-sr-only">Account</span>
              </>
            }
            align="end"
            items={[
              { id: "account", label: "Account settings", onSelect: () => router.push("/account") },
              { id: "sign-out", label: "Sign out", onSelect: () => void endSession() },
            ]}
          />
        }
      >
        <div className="mx-auto flex max-w-[80rem] flex-col gap-6">
          {signOutFailed ? (
            <Alert tone="critical" live="assertive" title="Sign-out failed">
              Close this browser session and try again.
            </Alert>
          ) : null}
          {inWorkspace ? (
            children
          ) : (
            <StateMessage
              kind="denied"
              title={`This page is not part of the ${workspace.name.toLowerCase()} workspace`}
              description={
                access.role === "ADMIN"
                  ? "Account editing, verification, security and configuration belong to super administrators. Account creation and suspension are under Onboarding."
                  : "Use the menu to open the matching super-administrator page."
              }
              action={<ButtonLink href="/admin">Go to the overview</ButtonLink>}
            />
          )}
        </div>
      </WorkspaceShell>
    </AdminContext.Provider>
  );
}
