import { apiRequest } from "./client";
import { ApiRequestError } from "./errors";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/** Roles issued by the backend today (see `hasRole` checks in the Spring controllers). */
export const BACKEND_ROLES = [
  "PATIENT",
  "PROVIDER",
  "LABORATORY",
  "HOME_CARE",
  "ADMIN",
  "SUPER_ADMIN",
] as const;

export type BackendRole = (typeof BACKEND_ROLES)[number];

export type Session = { email: string; role: BackendRole | (string & {}) };

/** Returns the signed-in session, or null when there is none. Other failures throw. */
export async function getSession(signal?: AbortSignal): Promise<Session | null> {
  try {
    return await apiRequest<Session>("/auth/session", { signal });
  } catch (error) {
    if (error instanceof ApiRequestError && error.isUnauthenticated) return null;
    throw error;
  }
}

/** Ends this browser's Supabase session. */
export async function signOut(): Promise<void> {
  const { error } = await getSupabaseBrowserClient().auth.signOut({ scope: "local" });
  if (error) throw error;
}
