import { AuthApiError } from "@supabase/supabase-js";
import { apiRequest } from "@/lib/api/client";
import { getSession, type Session } from "@/lib/api/session";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type MessageResponse = { message?: string };

function callbackUrl(next: string): string {
  const url = new URL("/auth/callback", window.location.origin);
  url.searchParams.set("next", next);
  return url.toString();
}

/** Authenticate through Supabase, migrating a valid legacy BCrypt login only when necessary. */
export async function signIn(email: string, password: string): Promise<Session | null> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (!(error instanceof AuthApiError) || error.code !== "invalid_credentials") {
      throw error;
    }
    await apiRequest<MessageResponse>("/auth/migrate-legacy", {
      method: "POST",
      body: { email, password },
    });
    const migratedLogin = await supabase.auth.signInWithPassword({ email, password });
    if (migratedLogin.error) throw migratedLogin.error;
  }
  return getSession();
}

/** The MedNet API issues Supabase verification tokens and delivers them directly through EKDSend. */
export async function register(email: string, password: string): Promise<MessageResponse> {
  return apiRequest<MessageResponse>("/auth/register", {
    method: "POST",
    body: { email, password },
  });
}

export async function resendVerification(email: string): Promise<MessageResponse> {
  return apiRequest<MessageResponse>("/auth/resend-verification", {
    method: "POST",
    body: { email },
  });
}

export async function requestPasswordReset(email: string): Promise<MessageResponse> {
  return apiRequest<MessageResponse>("/auth/prepare-reset", {
    method: "POST",
    body: { email },
  });
}

export async function verifyResetCode(email: string, code: string): Promise<void> {
  const { data, error } = await getSupabaseBrowserClient().auth.verifyOtp({
    email,
    token: code,
    type: "recovery",
  });
  if (error) throw error;
  if (!data.session) throw new Error("Could not verify that code.");
}

export async function resetPassword(password: string): Promise<MessageResponse> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
  const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
  if (signOutError) throw signOutError;
  return { message: "Password updated. You can now sign in." };
}

export async function signInWithGoogle(): Promise<void> {
  const { error } = await getSupabaseBrowserClient().auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl("/sign-in"),
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) throw error;
}

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_BYTES = 72;

export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) return "Use a shorter password (72 bytes maximum).";
  return null;
}

export function emailProblem(email: string): string | null {
  if (!email.trim()) return "Enter your email address.";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Enter a valid email address.";
  return null;
}
