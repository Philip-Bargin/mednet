"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { DescriptionList } from "@/components/ui/lists";
import { StateMessage } from "@/components/ui/state-message";
import { getSession, signOut, type Session } from "@/lib/api";
import { homePathForRole } from "@/features/workspace/workspaces";

const roleLabels: Record<string, string> = {
  PATIENT: "Patient",
  PROVIDER: "Provider",
  LABORATORY: "Laboratory partner",
  HOME_CARE: "Home care partner",
  ADMIN: "Administrator",
  SUPER_ADMIN: "Super administrator",
};

type State = "loading" | "signed-out" | "signed-in";

/**
 * `/account` — signed-in account summary for roles without a workspace yet. Administrators are sent
 * to /admin; providers, laboratory and home-care staff to their workspaces (Phase 5C added home care).
 * Everyone else sees their email and role, and can sign out.
 * No clinical information is displayed here.
 */
export function AccountPanel() {
  const [session, setSession] = useState<Session | null>(null);
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let active = true;
    getSession()
      .then((current) => {
        if (!active) return;
        if (!current) return setState("signed-out");
        if (current.role === "ADMIN" || current.role === "SUPER_ADMIN") {
          window.location.replace("/admin");
          return;
        }
        if (current.role === "PROVIDER" || current.role === "LABORATORY" || current.role === "HOME_CARE") {
          window.location.replace(homePathForRole(current.role));
          return;
        }
        setSession(current);
        setState("signed-in");
      })
      .catch(() => {
        if (!active) return;
        setError("The MedNet API is unavailable. Try again shortly.");
        setState("signed-out");
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    setError("");
    try {
      await signOut();
      setSession(null);
      setState("signed-out");
    } catch {
      setError("Sign-out failed. Close this browser session and try again.");
    } finally {
      setSigningOut(false);
    }
  }

  if (state === "loading") return <StateMessage kind="loading" layout="inline" title="Checking your session…" />;

  if (state === "signed-out") {
    return (
      <div className="flex flex-col gap-5">
        <h2 className="text-title text-ink">Sign in to continue</h2>
        {error ? <Alert tone="critical" live="assertive" title={error} /> : null}
        <ButtonLink href="/sign-in" fullWidth>
          Go to sign in
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-title text-ink">Signed in</h2>
      <DescriptionList
        items={[
          { term: "Email", detail: session?.email },
          { term: "Account type", detail: roleLabels[session?.role ?? ""] ?? session?.role },
        ]}
      />
      <Alert tone="info" title="Your workspace is being prepared">
        Service workflows for this account type are being connected separately. No clinical information is displayed
        here.
      </Alert>
      {error ? <Alert tone="critical" live="assertive" title={error} /> : null}
      <Button variant="secondary" fullWidth loading={signingOut} onClick={handleSignOut}>
        Sign out
      </Button>
    </div>
  );
}
