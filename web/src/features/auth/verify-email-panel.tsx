"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { TextInput } from "@/components/ui/inputs";
import { StateMessage } from "@/components/ui/state-message";
import { emailProblem, getEmailVerificationMode, verifyEmailCode, verifyLegacyEmailLink, type EmailVerificationMode } from "./auth-api";

type State = { kind: "loading" } | { kind: "form" } | { kind: "success" };

/** Accepts the emailed OTP by default and supports callback-link verification as a fallback. */
export function VerifyEmailPanel() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeType, setCodeType] = useState<"email" | "magiclink">("email");
  const [mode, setMode] = useState<EmailVerificationMode | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let active = true;
    const queryEmail = params.get("email") ?? "";
    const legacyToken = params.get("token");
    const initialize = async () => {
      setEmail(params.get("email") ?? "");
      setCodeType(params.get("type") === "magiclink" ? "magiclink" : "email");
      if (params.get("verified") === "1") {
        setState({ kind: "success" });
        return;
      }
      try {
        const verificationMode = await getEmailVerificationMode();
        if (!active) return;
        setMode(verificationMode);
        if (verificationMode === "legacy" && legacyToken) {
          try {
            await verifyLegacyEmailLink(queryEmail, legacyToken);
            if (active) setState({ kind: "success" });
            return;
          } catch (cause) {
            if (active) {
              setError(cause instanceof Error ? cause.message : "This verification link is invalid or expired.");
            }
          }
        } else if (params.get("error") === "auth_callback") {
          setError("That verification link is invalid or expired. You can enter the six-digit code instead.");
        }
        setState({ kind: "form" });
      } catch (cause) {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Verification is temporarily unavailable.");
          setState({ kind: "form" });
        }
      }
    };
    queueMicrotask(() => void initialize());
    return () => {
      active = false;
    };
  }, []);

  async function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const emailError = emailProblem(email.trim());
    if (emailError) return setError(emailError);
    if (!/^\d{6}$/.test(code)) return setError("Enter the six-digit code from your email.");
    if (!mode) return setError("Verification is temporarily unavailable. Please reload and try again.");
    setBusy(true);
    setError("");
    try {
      await verifyEmailCode(email.trim(), code, codeType, mode);
      setState({ kind: "success" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The code is invalid or expired. Request a new email.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-title text-ink">Email verification</h2>
      {state.kind === "loading" ? (
        <StateMessage kind="loading" layout="inline" title="Preparing verification…" />
      ) : state.kind === "success" ? (
        <StateMessage
          kind="success"
          title="Email verified"
          description="Your email address is confirmed. You can now continue to MedNet."
        />
      ) : (
        <>
          <p className="text-data text-text-secondary">
            Enter the six-digit code from your MedNet email. If the code does not work, use the secure verification link included in that email.
          </p>
          {error ? <Alert tone="critical" live="assertive" title={error} /> : null}
          <form noValidate onSubmit={submitCode} className="flex flex-col gap-5" aria-label="Verify your email">
            <TextInput
              label="Email address"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <TextInput
              label="Six-digit verification code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              pattern="[0-9]{6}"
              required
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            />
            <Button type="submit" fullWidth loading={busy}>Verify email</Button>
          </form>
        </>
      )}
      {state.kind === "success" ? (
        <ButtonLink href="/sign-in" fullWidth>Continue to sign in</ButtonLink>
      ) : state.kind !== "loading" ? (
        <ButtonLink href="/sign-in" fullWidth variant="secondary">Back to sign in</ButtonLink>
      ) : null}
    </div>
  );
}
