"use client";

import { useEffect, useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { verifyEmail } from "./auth-api";

type State = { kind: "loading" } | { kind: "success"; message: string } | { kind: "error"; message: string };

/**
 * The token is single-use. A remounted or re-run effect (React Strict Mode in development, a fast
 * remount) must reuse the first request instead of spending the token twice and reporting failure.
 */
const submissions = new Map<string, ReturnType<typeof verifyEmail>>();

function verifyOnce(email: string, token: string) {
  const key = `${email}\n${token}`;
  let request = submissions.get(key);
  if (!request) {
    request = verifyEmail(email, token);
    submissions.set(key, request);
  }
  return request;
}

/** Confirms the emailed link (`/verify?email=…&token=…`) once, on load. */
export function VerifyEmailPanel() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const email = params.get("email");
    const token = params.get("token");
    if (!email || !token) {
      // Deferred so the state update does not run synchronously inside the effect.
      queueMicrotask(() => setState({ kind: "error", message: "This verification link is incomplete." }));
      return;
    }
    verifyOnce(email, token)
      .then((result) => setState({ kind: "success", message: result.message ?? "Email verified. You can now sign in." }))
      .catch((error: unknown) =>
        setState({
          kind: "error",
          message: error instanceof Error ? error.message : "This verification link is invalid or expired.",
        }),
      );
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
