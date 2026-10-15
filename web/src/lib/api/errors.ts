/** Field-level validation detail from the backend `ApiErrorResponse`. */
export type ApiErrorDetail = { field: string; message: string };

/** Body returned by `com.mednet.api.ApiExceptionHandler` for every API error. */
export type ApiErrorBody = {
  success: false;
  error: { code: string; message: string; details?: ApiErrorDetail[] };
  detail?: string;
  meta?: { requestId?: string };
};

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ApiErrorDetail[];
  readonly requestId?: string;

  constructor(options: {
    status: number;
    code: string;
    message: string;
    details?: ApiErrorDetail[];
    requestId?: string;
  }) {
    super(options.message);
    this.name = "ApiRequestError";
    this.status = options.status;
    this.code = options.code;
    this.details = options.details ?? [];
    this.requestId = options.requestId;
  }

  get isUnauthenticated() {
    return this.status === 401;
  }

  get isForbidden() {
    return this.status === 403;
  }

  get isNetworkFailure() {
    return this.status === 0;
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== "object" || value === null) return false;
  const error = (value as { error?: unknown }).error;
  return (
    typeof error === "object" &&
    error !== null &&
    typeof (error as { code?: unknown }).code === "string"
  );
}

const fallbackMessages: Record<number, string> = {
  401: "Your session has ended. Sign in again to continue.",
  403: "You do not have permission to do that.",
  404: "We could not find what you were looking for.",
  409: "This record changed. Refresh and try again.",
  429: "Too many attempts. Please wait and try again later.",
};

/** Builds an `ApiRequestError` from a non-OK response without throwing on unexpected bodies. */
export async function toApiRequestError(
  response: Response,
): Promise<ApiRequestError> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }

  // Some auth endpoints answer errors with a plain MessageResponse ({ message }) or a
  // ResetVerificationResponse ({ token: null, message }) instead of the standard envelope.
  const plain = body as { message?: unknown; detail?: unknown } | undefined;
  const plainMessage =
    typeof plain?.detail === "string" ? plain.detail : typeof plain?.message === "string" ? plain.message : undefined;

  if (isApiErrorBody(body)) {
    return new ApiRequestError({
      status: response.status,
      code: body.error.code,
      message: body.error.message,
      details: body.error.details,
      requestId: body.meta?.requestId,
    });
  }

  return new ApiRequestError({
    status: response.status,
    code: `HTTP_${response.status}`,
    message:
      plainMessage ??
      fallbackMessages[response.status] ??
      "Something went wrong. Try again shortly.",
  });
}

export function networkError(): ApiRequestError {
  return new ApiRequestError({
    status: 0,
    code: "NETWORK_UNAVAILABLE",
    message: "The MedNet API is unavailable. Try again shortly.",
  });
}
