"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { TextInput } from "@/components/ui/inputs";
import { Stepper } from "@/components/ui/navigation";
import { PasswordField } from "@/components/ui/password-field";
import { StateMessage } from "@/components/ui/state-message";
import { emailProblem, passwordProblem, requestPasswordReset, resetPassword, verifyResetCode } from "./auth-api";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Step = "request" | "verify" | "reset" | "done";
const stepIndex: Record<Step, number> = { request: 0, verify: 1, reset: 2, done: 2 };

const copy: Record<Step, { title: string; description: string }> = {
  request: { title: "Reset your password", description: "Enter your email and we will send a one-time recovery code." },
  verify: { title: "Enter your recovery code", description: "Enter the six-digit code sent to your email address." },
  reset: { title: "Choose a new password", description: "Your email is verified. Choose a new password for your account." },
  done: { title: "Password updated", description: "Your password has been changed successfully." },
};

/**
 * Password reset by emailed six-digit code: request → verify code → set password.
 * `/reset?email=…` (the link in the reset email) starts at the code step. Same endpoints and
 * messages as the original page.
 */
export function ResetPasswordPanel({
  initialEmail,
  initialRecovery,
}: {
  initialEmail: string;
  initialRecovery: boolean;
}) {
  const [step, setStep] = useState<Step>(
    initialRecovery ? "reset" : initialEmail ? "verify" : "request",
  );
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const fieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!initialRecovery) return;
    let cancelled = false;
    async function validateRecoverySession() {
      try {
        const { data, error: sessionError } = await getSupabaseBrowserClient().auth.getSession();
        if (!cancelled && (sessionError || !data.session)) {
          setError("This recovery link is invalid or expired. Request a new password reset.");
          setStep("request");
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Could not verify the recovery session.");
          setStep("request");
        }
      }
    }
    void validateRecoverySession();
    return () => {
      cancelled = true;
    };
  }, [initialRecovery]);

  function fail(cause: unknown, fallback: string) {
    setError(cause instanceof Error ? cause.message : fallback);
  }

  function invalid(problem: string) {
    setFieldError(problem);
    fieldRef.current?.focus();
  }

  async function sendCode(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const problem = emailProblem(email.trim());
    if (problem) return invalid(problem);
    setFieldError(undefined);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await requestPasswordReset(email.trim());
      setMessage(result.message ?? "If the account exists, a password reset code has been sent.");
      setStep("verify");
    } catch (cause) {
      fail(cause, "Could not send a reset code.");
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) return invalid("Enter the six-digit code from your email.");
    setFieldError(undefined);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await verifyResetCode(email.trim(), code);
      setStep("reset");
      // Remove the email from the address bar once it is no longer needed.
      window.history.replaceState(null, "", "/reset");
    } catch (cause) {
      fail(cause, "The code is invalid or expired. Request a new code.");
    } finally {
      setBusy(false);
    }
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    const problem = passwordProblem(password);
    if (problem) return invalid(problem);
    setFieldError(undefined);
    setBusy(true);
    setError("");
    try {
      const result = await resetPassword(password);
      setMessage(result.message ?? "Password updated. You can now sign in.");
      setCode("");
      setStep("done");
    } catch (cause) {
      fail(cause, "Password reset failed.");
    } finally {
      setBusy(false);
    }
  }

  const errorAlert = error ? <Alert tone="critical" live="assertive" title={error} /> : null;
  const messageAlert = message && step !== "done" ? <Alert tone="success" live="polite" title={message} /> : null;

  return (
    <div className="flex flex-col gap-6">
      <Stepper steps={["Email", "Code", "New password"]} current={stepIndex[step]} label="Password reset progress" />
      <div>
        <h2 className="text-title text-ink">{copy[step].title}</h2>
        <p className="mt-1 text-data text-text-secondary">{copy[step].description}</p>
      </div>

      {step === "request" ? (
        <form noValidate onSubmit={sendCode} className="flex flex-col gap-5" aria-label="Request a recovery code">
          <TextInput
            ref={fieldRef}
            name="email"
            type="email"
            label="Email address"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={fieldError}
          />
          {errorAlert}
          {messageAlert}
          <Button type="submit" fullWidth loading={busy}>
            Send recovery code
          </Button>
        </form>
      ) : step === "verify" ? (
        <>
          <p className="text-data text-text-secondary">
            Recovery code for <strong className="text-ink [overflow-wrap:anywhere]">{email}</strong>
          </p>
          <form noValidate onSubmit={submitCode} className="flex flex-col gap-5" aria-label="Verify recovery code">
            <TextInput
              ref={fieldRef}
              name="code"
              label="Six-digit code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              error={fieldError}
              className="tracking-[0.3em] tabular-nums"
            />
            {errorAlert}
            {messageAlert}
            <Button type="submit" fullWidth loading={busy}>
              Verify code
            </Button>
          </form>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <button
              type="button"
              disabled={busy}
              onClick={() => void sendCode()}
              className="min-h-10 rounded-sm text-data font-semibold text-green-800 hover:underline disabled:opacity-[0.42]"
            >
              Send a new code
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("request");
                setCode("");
                setError("");
                setMessage("");
                setFieldError(undefined);
              }}
              className="min-h-10 rounded-sm text-data font-semibold text-green-800 hover:underline"
            >
              Use a different email
            </button>
          </div>
        </>
      ) : step === "reset" ? (
        <form noValidate onSubmit={submitPassword} className="flex flex-col gap-5" aria-label="Choose a new password">
          <PasswordField
            ref={fieldRef}
            name="password"
            label="New password"
            autoComplete="new-password"
            description="At least 12 characters."
            required
            error={fieldError}
          />
          {errorAlert}
          <Button type="submit" fullWidth loading={busy}>
            Update password
          </Button>
        </form>
      ) : (
        <>
          <StateMessage kind="success" title="Password updated" description={message} />
          <ButtonLink href="/sign-in" fullWidth>
            Continue to sign in
          </ButtonLink>
        </>
      )}

      {step !== "done" ? (
        <Link href="/sign-in" className="min-h-10 self-start content-center rounded-sm text-data text-text-secondary hover:text-action">
          Back to sign in
        </Link>
      ) : null}
    </div>
  );
}
