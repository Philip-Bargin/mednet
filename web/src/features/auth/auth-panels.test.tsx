import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthApiError } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountPanel } from "./account-panel";
import { ResetPasswordPanel } from "./reset-password-panel";
import { SignInPanel } from "./sign-in-panel";
import { VerifyEmailPanel } from "./verify-email-panel";

const supabaseAuth = vi.hoisted(() => ({
  getSession: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resend: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  verifyOtp: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  signInWithOAuth: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => ({ auth: supabaseAuth }),
}));

type Route = { status: number; body?: unknown };
const routes = new Map<string, Route[]>();
const calls: Array<{ url: string; init?: RequestInit }> = [];

function on(method: string, path: string, ...responses: Route[]) {
  routes.set(`${method} ${path}`, responses);
}

const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  calls.push({ url, init });
  const key = `${init?.method ?? "GET"} ${url.split("?")[0]}`;
  const queue = routes.get(key);
  if (key === "GET /api/v1/auth/csrf") return Response.json({ headerName: "X-XSRF-TOKEN", token: "t" });
  if (!queue?.length) throw new Error(`Unexpected request ${key}`);
  const next = queue.length > 1 ? queue.shift()! : queue[0];
  return next.body === undefined
    ? new Response(null, { status: next.status })
    : Response.json(next.body, { status: next.status });
});

const replace = vi.fn();
const unauthenticated = {
  status: 401,
  body: { success: false, error: { code: "UNAUTHORIZED", message: "Sign-in required" } },
};

beforeEach(() => {
  routes.clear();
  calls.length = 0;
  vi.stubGlobal("fetch", fetchMock);
  replace.mockReset();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...window.location, replace, search: "", origin: "http://localhost:3000" },
  });
  supabaseAuth.getSession.mockReset().mockResolvedValue({ data: { session: null }, error: null });
  supabaseAuth.signInWithPassword.mockReset().mockResolvedValue({ data: { session: null }, error: null });
  supabaseAuth.signUp.mockReset().mockResolvedValue({ data: { user: {}, session: null }, error: null });
  supabaseAuth.resend.mockReset().mockResolvedValue({ data: {}, error: null });
  supabaseAuth.resetPasswordForEmail.mockReset().mockResolvedValue({ data: {}, error: null });
  supabaseAuth.verifyOtp.mockReset().mockResolvedValue({
    data: { session: { access_token: "recovery-token" } },
    error: null,
  });
  supabaseAuth.updateUser.mockReset().mockResolvedValue({ data: {}, error: null });
  supabaseAuth.signOut.mockReset().mockResolvedValue({ error: null });
  supabaseAuth.signInWithOAuth.mockReset().mockResolvedValue({ data: { url: "https://google.test" }, error: null });
});

afterEach(() => vi.unstubAllGlobals());

describe("SignInPanel", () => {
  it("redirects an existing session to the role home", async () => {
    on("GET", "/api/v1/auth/session", { status: 200, body: { email: "a@b.lr", role: "SUPER_ADMIN" } });
    render(<SignInPanel googleError={false} />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin"));
  });

  it("validates fields before attempting Supabase authentication", async () => {
    on("GET", "/api/v1/auth/session", unauthenticated);
    render(<SignInPanel googleError={false} />);
    await userEvent.click(await screen.findByRole("button", { name: "Sign in" }));
    const email = screen.getByRole("textbox", { name: /Email address/ });
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveFocus();
    expect(supabaseAuth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("signs in with Supabase and redirects using the backend role", async () => {
    on("GET", "/api/v1/auth/session", unauthenticated, { status: 200, body: { email: "p@b.lr", role: "PATIENT" } });
    render(<SignInPanel googleError={false} />);
    await userEvent.type(await screen.findByRole("textbox", { name: /Email address/ }), "p@b.lr");
    await userEvent.type(screen.getByLabelText(/^Password/), "correct horse battery");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/patient"));
    expect(supabaseAuth.signInWithPassword).toHaveBeenCalledWith({
      email: "p@b.lr",
      password: "correct horse battery",
    });
  });

  it("migrates a valid legacy BCrypt login, then signs in with Supabase", async () => {
    on("GET", "/api/v1/auth/session", unauthenticated, { status: 200, body: { email: "p@b.lr", role: "PATIENT" } });
    on("POST", "/api/v1/auth/migrate-legacy", { status: 200, body: { message: "Migrated" } });
    supabaseAuth.signInWithPassword
      .mockResolvedValueOnce({
        data: { session: null },
        error: new AuthApiError("Invalid login credentials", 400, "invalid_credentials"),
      })
      .mockResolvedValueOnce({ data: { session: { access_token: "new-token" } }, error: null });

    render(<SignInPanel googleError={false} />);
    await userEvent.type(await screen.findByRole("textbox", { name: /Email address/ }), "p@b.lr");
    await userEvent.type(screen.getByLabelText(/^Password/), "correct horse battery");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/patient"));
    const migrationCall = calls.find((call) => call.url === "/api/v1/auth/migrate-legacy");
    expect(JSON.parse(String(migrationCall?.init?.body))).toEqual({
      email: "p@b.lr",
      password: "correct horse battery",
    });
    expect(supabaseAuth.signInWithPassword).toHaveBeenCalledTimes(2);
  });

  it("reports a migration service outage without disguising it as bad credentials", async () => {
    on("GET", "/api/v1/auth/session", unauthenticated);
    on("POST", "/api/v1/auth/migrate-legacy", {
      status: 503,
      body: { success: false, error: { code: "SERVICE_UNAVAILABLE", message: "Migration unavailable" } },
    });
    supabaseAuth.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: new AuthApiError("Invalid login credentials", 400, "invalid_credentials"),
    });

    render(<SignInPanel googleError={false} />);
    await userEvent.type(await screen.findByRole("textbox", { name: /Email address/ }), "p@b.lr");
    await userEvent.type(screen.getByLabelText(/^Password/), "any-password-123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sign-in is temporarily unavailable. Please try again shortly.",
    );
  });

  it("registers through the API so EKDSend delivers the Supabase verification email", async () => {
    on("GET", "/api/v1/auth/session", unauthenticated);
    on("POST", "/api/v1/auth/register", {
      status: 202,
      body: { message: "If a new account can be created for this email, we will send a verification link." },
    });
    render(<SignInPanel googleError={false} />);
    await userEvent.click(await screen.findByText("Create account"));
    await userEvent.type(screen.getByRole("textbox", { name: /Email address/ }), "new@b.lr");
    await userEvent.type(screen.getByLabelText(/^Password/), "a-valid-password-123");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    const registrationStatus = await screen.findByRole("status");
    expect(registrationStatus).toHaveTextContent("Thanks for signing up.");
    expect(registrationStatus).toHaveTextContent(
      "If this email is eligible for a new MedNet account, a verification link will arrive shortly.",
    );
    expect(screen.getByRole("button", { name: "Resend verification email" })).toBeInTheDocument();
    const registerCall = calls.find((call) => call.url === "/api/v1/auth/register");
    expect(JSON.parse(String(registerCall?.init?.body))).toEqual({
      email: "new@b.lr",
      password: "a-valid-password-123",
    });
    expect(supabaseAuth.signUp).not.toHaveBeenCalled();
  });

  it("prepares old accounts for recovery and links to the six-digit code step", async () => {
    on("GET", "/api/v1/auth/session", unauthenticated);
    on("POST", "/api/v1/auth/prepare-reset", {
      status: 202,
      body: { message: "If the account exists, password recovery instructions have been sent." },
    });
    render(<SignInPanel googleError={false} />);
    await userEvent.click(await screen.findByRole("button", { name: "Forgot password?" }));
    await userEvent.type(screen.getByRole("textbox", { name: /Email address/ }), "p@b.lr");
    await userEvent.click(screen.getByRole("button", { name: "Send recovery instructions" }));

    expect(await screen.findByRole("status")).toHaveTextContent("password recovery instructions");
    expect(screen.getByRole("link", { name: "Enter your recovery code" })).toHaveAttribute(
      "href",
      "/reset?email=p%40b.lr",
    );
    expect(supabaseAuth.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("keeps Google OAuth visible and reports a callback error", async () => {
    on("GET", "/api/v1/auth/session", unauthenticated);
    render(<SignInPanel googleError />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Google sign-in could not be completed");
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
  });
});

describe("ResetPasswordPanel", () => {
  it("verifies the recovery OTP and completes a Supabase password reset", async () => {
    window.history.replaceState = vi.fn();
    render(<ResetPasswordPanel initialEmail="p@b.lr" initialRecovery={false} />);

    expect(screen.getByRole("heading", { name: "Enter your recovery code" })).toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox", { name: /Six-digit code/ }), "12a3456");
    expect(screen.getByRole("textbox", { name: /Six-digit code/ })).toHaveValue("123456");
    await userEvent.click(screen.getByRole("button", { name: "Verify code" }));

    expect(await screen.findByRole("heading", { name: "Choose a new password" })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/^New password/), "a-brand-new-password");
    await userEvent.click(screen.getByRole("button", { name: "Update password" }));
    expect(await screen.findByText("Password updated. You can now sign in.")).toBeInTheDocument();
    expect(supabaseAuth.verifyOtp).toHaveBeenCalledWith({
      email: "p@b.lr",
      token: "123456",
      type: "recovery",
    });
    expect(supabaseAuth.updateUser).toHaveBeenCalledWith({ password: "a-brand-new-password" });
    expect(supabaseAuth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("shows an invalid-code error returned by Supabase", async () => {
    supabaseAuth.verifyOtp.mockResolvedValue({
      data: { session: null },
      error: new Error("The code is invalid or expired. Request a new code."),
    });
    render(<ResetPasswordPanel initialEmail="p@b.lr" initialRecovery={false} />);
    await userEvent.type(screen.getByRole("textbox", { name: /Six-digit code/ }), "000000");
    await userEvent.click(screen.getByRole("button", { name: "Verify code" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The code is invalid or expired. Request a new code.");
  });
});

describe("VerifyEmailPanel", () => {
  it("reports an incomplete link", async () => {
    render(<VerifyEmailPanel />);
    expect(await screen.findByRole("alert")).toHaveTextContent("This verification link is incomplete.");
  });

  it("shows success after the callback has verified the email", async () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, search: "?verified=1", origin: "http://localhost:3000" },
    });
    render(<VerifyEmailPanel />);
    expect(await screen.findByText("Email verified. You can now sign in.")).toBeInTheDocument();
  });
});

describe("AccountPanel", () => {
  it("forwards administrators to /admin without rendering account details", async () => {
    on("GET", "/api/v1/auth/session", { status: 200, body: { email: "admin@b.lr", role: "ADMIN" } });
    render(<AccountPanel />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin"));
    expect(screen.queryByText("admin@b.lr")).not.toBeInTheDocument();
  });

  it("forwards providers to their workspace", async () => {
    on("GET", "/api/v1/auth/session", { status: 200, body: { email: "doctor@b.lr", role: "PROVIDER" } });
    render(<AccountPanel />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/provider"));
    expect(screen.queryByText("doctor@b.lr")).not.toBeInTheDocument();
  });

  it("forwards laboratory staff to the laboratory workspace", async () => {
    on("GET", "/api/v1/auth/session", { status: 200, body: { email: "lab@b.lr", role: "LABORATORY" } });
    render(<AccountPanel />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/laboratory"));
    expect(screen.queryByText("lab@b.lr")).not.toBeInTheDocument();
  });

  it("forwards home-care staff to the home-care workspace", async () => {
    on("GET", "/api/v1/auth/session", { status: 200, body: { email: "care@b.lr", role: "HOME_CARE" } });
    render(<AccountPanel />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/home-care"));
    expect(screen.queryByText("care@b.lr")).not.toBeInTheDocument();
  });

  it("shows the session email and signs out through Supabase", async () => {
    on("GET", "/api/v1/auth/session", { status: 200, body: { email: "patient@b.lr", role: "PATIENT" } });
    render(<AccountPanel />);
    expect(await screen.findByText("patient@b.lr")).toBeInTheDocument();
    expect(screen.getByText("Patient")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("link", { name: "Go to sign in" })).toHaveAttribute("href", "/sign-in");
    expect(supabaseAuth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("keeps the session and explains a failed sign-out", async () => {
    on("GET", "/api/v1/auth/session", { status: 200, body: { email: "p@b.lr", role: "PATIENT" } });
    supabaseAuth.signOut.mockRejectedValue(new Error("Sign-out unavailable"));
    render(<AccountPanel />);
    await userEvent.click(await screen.findByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Sign-out failed. Close this browser session and try again.");
    expect(screen.getByText("p@b.lr")).toBeInTheDocument();
  });

  it("reports an unreachable API instead of claiming the visitor is signed out silently", async () => {
    on("GET", "/api/v1/auth/session", { status: 502 });
    render(<AccountPanel />);
    expect(await screen.findByRole("alert")).toHaveTextContent("The MedNet API is unavailable. Try again shortly.");
    expect(screen.getByRole("link", { name: "Go to sign in" })).toBeInTheDocument();
  });
});
