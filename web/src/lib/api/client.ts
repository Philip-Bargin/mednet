import { networkError, toApiRequestError } from "./errors";

/** Every authoritative endpoint lives under this prefix (proxied in development by next.config.ts). */
export const API_BASE = "/api/v1";

type CsrfToken = { headerName: string; token: string };

type QueryValue = string | number | boolean | null | undefined;

export type ApiRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Serialized as JSON. */
  body?: unknown;
  /**
   * Sent as application/x-www-form-urlencoded instead of JSON. Only for endpoints that
   * require it — Spring Security's form login at /auth/login.
   */
  form?: Record<string, string>;
  /** An array repeats the key (`status=OPEN&status=IN_PROGRESS`). */
  query?: Record<string, QueryValue | QueryValue[]>;
  signal?: AbortSignal;
};

export function buildApiUrl(
  path: string,
  query?: Record<string, QueryValue | QueryValue[]>,
): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== null && item !== undefined) params.append(key, String(item));
    }
  }
  const search = params.toString();
  return `${API_BASE}${normalizedPath}${search ? `?${search}` : ""}`;
}

async function send(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, {
      cache: "no-store",
      credentials: "same-origin",
      ...init,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw networkError();
  }
}

/**
 * Fetches a fresh CSRF token. The backend issues it per session, so it is requested
 * immediately before each state-changing call (same behaviour as the existing pages).
 */
export async function getCsrfToken(signal?: AbortSignal): Promise<CsrfToken> {
  const response = await send(buildApiUrl("/auth/csrf"), { signal });
  if (!response.ok) throw await toApiRequestError(response);
  return (await response.json()) as CsrfToken;
}

/**
 * Calls a MedNet API endpoint with the session cookie. State-changing methods include
 * the CSRF header. Non-2xx responses throw `ApiRequestError`; 204 resolves to undefined.
 */
export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = { Accept: "application/json" };

  if (method !== "GET") {
    const csrf = await getCsrfToken(options.signal);
    headers[csrf.headerName] = csrf.token;
  }
  let body: string | URLSearchParams | undefined;
  if (options.form !== undefined) {
    body = new URLSearchParams(options.form);
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  } else if (options.body !== undefined) {
    body = JSON.stringify(options.body);
    headers["Content-Type"] = "application/json";
  }

  const response = await send(buildApiUrl(path, options.query), {
    method,
    headers,
    body,
    signal: options.signal,
  });

  if (!response.ok) throw await toApiRequestError(response);
  if (response.status === 204) return undefined as T;

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
