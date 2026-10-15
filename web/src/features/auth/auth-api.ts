import { apiRequest, getSession, type Session } from "@/lib/api";

/**
 * Account-access calls. Contracts: `com.mednet.auth.api.AccountAuthController`,
 * `AdminAuthController` and Spring Security form login (`SecurityConfig`).
 * Each write fetches a fresh CSRF token (handled by `apiRequest`).
 */
type MessageResponse = { message?: string };

/** POST /auth/login — Spring form login, so the body is form-encoded. 401 = bad credentials or unverified. */
export async function signIn(email: string, password: string): Promise<Session | null> {
  await apiRequest<void>("/auth/login", { method: "POST", form: { email, password } });
  return getSession();
}

/** POST /auth/register — 202 with a generic message (never reveals whether the email exists). */
export function register(email: string, password: string) {
  return apiRequest<MessageResponse>("/auth/register", { method: "POST", body: { email, password } });
}

/** POST /auth/resend-verification — 202 with a generic message. */
export function resendVerification(email: string) {
  return apiRequest<MessageResponse>("/auth/resend-verification", { method: "POST", body: { email } });
}

/** POST /auth/forgot-password — 202 with a generic message; emails a six-digit code. */
export function requestPasswordReset(email: string) {
  return apiRequest<MessageResponse>("/auth/forgot-password", { method: "POST", body: { email } });
}

/** POST /auth/reset-password/verify — exchanges the six-digit code for a reset token. */
export function verifyResetCode(email: string, code: string) {
  return apiRequest<{ token: string | null; message?: string }>("/auth/reset-password/verify", {
    method: "POST",
    body: { email, code },
  });
}

/** POST /auth/reset-password */
export function resetPassword(email: string, token: string, password: string) {
  return apiRequest<MessageResponse>("/auth/reset-password", { method: "POST", body: { email, token, password } });
}

/** GET /auth/verify — confirms an emailed verification link. */
export function verifyEmail(email: string, token: string) {
  return apiRequest<MessageResponse>("/auth/verify", { query: { email, token } });
}

/** GET /auth/google/status */
export async function googleSignInEnabled(): Promise<boolean> {
  try {
    const status = await apiRequest<{ enabled: boolean }>("/auth/google/status");
    return status.enabled === true;
  } catch {
    return false;
  }
}

/** Browser navigation target that starts the Google OAuth flow (handled by Spring). */
export const GOOGLE_AUTHORIZATION_PATH = "/api/v1/auth/oauth2/authorization/google";

/** Backend limits (CredentialsRequest / ResetPasswordRequest). */
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
