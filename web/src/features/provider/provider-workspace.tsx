"use client";

import { UserRound } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { Alert } from "@/components/ui/alert";
import { Menu } from "@/components/ui/menu";
import { ApiRequestError, getSession, signOut, type Session } from "@/lib/api";
import { formatHeaderDate } from "@/features/patient/format";
import { WorkspaceAccessState, type WorkspaceAccess } from "@/features/workspace/access-state";
import { SESSION_EXPIRED_EVENT } from "@/features/workspace/use-resource";
import { WORKSPACES, activeNavItemId, homePathForRole } from "@/features/workspace/workspaces";
import { ApplicantStatus, ApplicationGate } from "./application";
import { providerApi, type ProviderApplication } from "./provider-api";

/**
 * Doctor workspace frame: session guard (PROVIDER only), the provider's application status and the
 * shared WorkspaceShell. Clinical and scheduling views appear only for an APPROVED application; the
 * API refuses them otherwise, so the gate is UX, not the security boundary.
 */
export type ApplicationState =
  | { state: "loading" }
  | { state: "ready"; application: ProviderApplication }
  /** 404: this account has never applied. */
  | { state: "none" }
  | { state: "error" };

type ProviderContextValue = {
  session: Session;
  application: ApplicationState;
  /** The approved application (only set inside approved views). */
  provider: ProviderApplication | null;
  reloadApplication: () => void;
};

const ProviderContext = createContext<ProviderContextValue | null>(null);

export function useProvider(): ProviderContextValue {
  const value = useContext(ProviderContext);
  if (!value) throw new Error("useProvider must be used inside ProviderWorkspace");
  return value;
}

/** For views that only render once the application is APPROVED. */
export function useApprovedProvider(): ProviderApplication {
  const { provider } = useProvider();
  if (!provider) throw new Error("useApprovedProvider used before approval");
  return provider;
}

const workspace = WORKSPACES.doctor;

const extraTitles: Array<[prefix: string, title: string]> = [
  ["/provider/profile", "Your profile"],
  ["/provider/appointments/consultation", "Text consultation"],
];

function pageTitle(pathname: string): string {
  const extra = extraTitles.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (extra) return extra[1];
  if (pathname.startsWith("/provider/patients/")) return "Patient";
  const id = activeNavItemId(workspace, pathname);
  return [...workspace.items, ...(workspace.footerItems ?? [])].find((item) => item.id === id)?.label ?? "Doctor workspace";
}

/** "Good morning, Dr. Cole" — the last word of the display name, prefixed with "Dr." unless it already is. */
export function doctorGreeting(displayName: string | null | undefined, now = new Date()): string {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Monrovia", hour: "numeric", hourCycle: "h23" }).format(now));
  const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const words = displayName?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (!words.length) return part;
  const titled = /^dr\.?$/i.test(words[0]);
  const surname = words.length > (titled ? 1 : 0) ? words[words.length - 1] : "";
  return surname ? `${part}, Dr. ${surname}` : part;
}

export function ProviderWorkspace({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [access, setAccess] = useState<
    | WorkspaceAccess
    | { state: "ready"; session: Session }
    /** A PATIENT-role session with a provider application (the backend grants PROVIDER only once approved). */
    | { state: "applicant"; application: ProviderApplication }
  >({ state: "checking" });
  const [application, setApplication] = useState<ApplicationState>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [applicationAttempt, setApplicationAttempt] = useState(0);
  const [signOutFailed, setSignOutFailed] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    getSession(signal)
      .then((session) => {
        if (signal.aborted) return;
        if (!session) return setAccess({ state: "signed-out" });
        if (session.role === "PATIENT") {
          // Applicants sign in with the PATIENT role until approved (SecurityConfig). Show their
          // application status here; patients who never applied go to their own workspace.
          providerApi
            .application(signal)
            .then((application) => !signal.aborted && setAccess({ state: "applicant", application }))
            .catch(() => {
              if (signal.aborted) return;
              setAccess({ state: "redirecting" });
              router.replace(homePathForRole(session.role));
            });
          return;
        }
        if (session.role !== "PROVIDER") {
          setAccess({ state: "redirecting" });
          router.replace(homePathForRole(session.role));
          return;
        }
        setAccess({ state: "ready", session });
      })
      .catch(() => !signal.aborted && setAccess({ state: "error" }));
    return () => controller.abort();
  }, [router, attempt]);

  const ready = access.state === "ready";
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    providerApi
      .application(controller.signal)
      .then((saved) => setApplication({ state: "ready", application: saved }))
      .catch((error) => {
        if (controller.signal.aborted) return;
        setApplication(error instanceof ApiRequestError && error.status === 404 ? { state: "none" } : { state: "error" });
      });
    return () => controller.abort();
  }, [ready, applicationAttempt]);

  useEffect(() => {
    const expire = () => setAccess({ state: "expired" });
    window.addEventListener(SESSION_EXPIRED_EVENT, expire);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, expire);
  }, []);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const timer = window.setInterval(tick, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const reloadApplication = useCallback(() => setApplicationAttempt((count) => count + 1), []);

  async function endSession() {
    setSignOutFailed(false);
    try {
      await signOut();
      router.replace("/sign-in");
    } catch {
      setSignOutFailed(true);
    }
  }

  if (access.state === "applicant") {
    return (
      <WorkspaceAccessState access={{ state: "checking" }} pathname={pathname} workspaceLabel="Doctor workspace" onRetry={() => undefined}>
        <ApplicantStatus application={access.application} onSignOut={() => void endSession()} signOutFailed={signOutFailed} />
      </WorkspaceAccessState>
    );
  }

  if (access.state !== "ready") {
    return (
      <WorkspaceAccessState
        access={access}
        pathname={pathname}
        workspaceLabel="Doctor workspace"
        onRetry={() => setAttempt((count) => count + 1)}
      />
    );
  }

  const approved = application.state === "ready" && application.application.status === "APPROVED" ? application.application : null;
  const displayName = application.state === "ready" ? application.application.displayName : null;
  const overview = pathname === "/provider";
  // Unapproved accounts see their application status everywhere except their profile.
  const gated = !approved && pathname !== "/provider/profile";

  return (
    <ProviderContext.Provider value={{ session: access.session, application, provider: approved, reloadApplication }}>
      <WorkspaceShell
        workspaceId="doctor"
        user={{ name: displayName || access.session.email, description: approved ? "Approved provider" : "Provider account" }}
        eyebrow={overview ? (now ? formatHeaderDate(now) : " ") : "Doctor workspace"}
        title={overview ? (now && approved ? doctorGreeting(displayName, now) : "Overview") : pageTitle(pathname)}
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
              { id: "profile", label: "Your profile", onSelect: () => router.push("/provider/profile") },
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
          {gated ? <ApplicationGate /> : children}
        </div>
      </WorkspaceShell>
    </ProviderContext.Provider>
  );
}
