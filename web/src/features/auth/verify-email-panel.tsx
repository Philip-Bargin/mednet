"use client";

import { useEffect, useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";

type State = { kind: "loading" } | { kind: "success"; message: string } | { kind: "error"; message: string };

/** The auth callback exchanges the Supabase single-use token before redirecting here. */
export function VerifyEmailPanel() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verified = params.get("verified") === "1";
    const callbackError = params.get("error") === "auth_callback";
    queueMicrotask(() => setState(
      verified
        ? { kind: "success", message: "Email verified. You can now sign in." }
        : {
            kind: "error",
            message: callbackError
              ? "This verification link is invalid or expired."
              : "This verification link is incomplete.",
          },
    ));
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-title text-ink">Email verification</h2>
      {state.kind === "loading" ? (
        <StateMessage kind="loading" layout="inline" title="Verifying your email…" />
      ) : state.kind === "success" ? (
        <StateMessage kind="success" title="Email verified" description={state.message} />
      ) : (
        <StateMessage
          kind="error"
          title="We could not verify this link"
          description={`${state.message} Sign in and choose “Resend verification email” to get a new link.`}
        />
      )}
      <ButtonLink href="/sign-in" fullWidth variant={state.kind === "success" ? "primary" : "secondary"}>
        Continue to sign in
      </ButtonLink>
    </div>
  );
}
