import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountPanel } from "./account-panel";
import { ResetPasswordPanel } from "./reset-password-panel";
import { SignInPanel } from "./sign-in-panel";
import { VerifyEmailPanel } from "./verify-email-panel";

/**
 * Component tests with a scripted fetch. They check request contracts and UI states only; live
 * behaviour is verified separately against the running Spring Boot API (e2e/auth.live.spec.ts).
 */
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
  return next.body === undefined ? new Response(null, { status: next.status }) : Response.json(next.body, { status: next.status });
});

const replace = vi.fn();

beforeEach(() => {
  routes.clear();
  calls.length = 0;
  vi.stubGlobal("fetch", fetchMock);
  replace.mockReset();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...window.location, replace, search: "", origin: "http://localhost:3000" },
  });
  on("GET", "/api/v1/auth/google/status", { status: 200, body: { enabled: false, missingConfiguration: [] } });
});

afterEach(() => vi.unstubAllGlobals());

const unauthenticated = { status: 401, body: { success: false, error: { code: "UNAUTHORIZED", message: "Sign-in required" } } };

describe("SignInPanel", () => {
  it("redirects an existing session to the role home", async () => {
    on("GET", "/api/v1/auth/session", { status: 200, body: { email: "a@b.lr", role: "SUPER_ADMIN" } });
    render(<SignInPanel googleError={false} />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin"));
  });

  it("validates fields before calling the API and focuses the first problem", async () => {
    on("GET", "/api/v1/auth/session", unauthenticated);
    render(<SignInPanel googleError={false} />);
    await userEvent.click(await screen.findByRole("button", { name: "Sign in" }));
    const email = screen.getByRole("textbox", { name: /Email address/ });
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveFocus();
    expect(calls.some((call) => call.url.includes("/auth/login"))).toBe(false);
  });

  it("signs in with a form-encoded body and redirects a patient to /patient", async () => {
    on("GET", "/api/v1/auth/session", unauthenticated, { status: 200, body: { email: "p@b.lr", role: "PATIENT" } });
    on("POST", "/api/v1/auth/login", { status: 200, body: {} });
    render(<SignInPanel googleError={false} />);
    await userEvent.type(await screen.findByRole("textbox", { name: /Email address/ }), "p@b.lr");
    await userEvent.type(screen.getByLabelText(/^Password/), "correct horse battery");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/patient"));
    const login = calls.find((call) => call.url === "/api/v1/auth/login")!;
    expect(login.init?.headers).toMatchObject({
      "Content-Type": "application/x-www-form-urlencoded",
      "X-XSRF-TOKEN": "t",
    });
    expect(String(login.init?.body)).toBe("email=p%40b.lr&password=correct+horse+battery");
  });

  it("shows the original failure message and offers verification resend on 401", async () => {
    on("GET", "/api/v1/auth/session", unauthenticated);
    on("POST", "/api/v1/auth/login", { status: 401, body: { success: false, error: { code: "UNAUTHORIZED", message: "Invalid email or password" } } });
    render(<SignInPanel googleError={false} />);
    await userEvent.type(await screen.findByRole("textbox", { name: /Email address/ }), "p@b.lr");
    await userEvent.type(screen.getByLabelText(/^Password/), "wrong-password-1");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Sign-in failed. Verify your email and password.");
    await userEvent.click(screen.getByRole("button", { name: "Resend verification email" }));
    expect(screen.getByRole("heading", { name: "Resend verification email" })).toBeInTheDocument();
  });

  it("explains a 503 as temporarily unavailable", async () => {
    on("GET", "/api/v1/auth/session", unauthenticated);
    on("POST", "/api/v1/auth/login", { status: 503, body: { success: false, error: { code: "SERVICE_UNAVAILABLE", message: "Sign-in is temporarily unavailable" } } });
    render(<SignInPanel googleError={false} />);
    await userEvent.type(await screen.findByRole("textbox", { name: /Email address/ }), "p@b.lr");
    await userEvent.type(screen.getByLabelText(/^Password/), "any-password-123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Sign-in is temporarily unavailable. Please try again shortly.");
  });

  it("registers, shows the server message, and returns to sign in", async () => {
    on("GET", "/api/v1/auth/session", unauthenticated);
    on("POST", "/api/v1/auth/register", { status: 202, body: { message: "Thanks for signing up." } });
    render(<SignInPanel googleError={false} />);
    await userEvent.click(await screen.findByText("Create account"));
    await userEvent.type(screen.getByRole("textbox", { name: /Email address/ }), "new@b.lr");
    await userEvent.type(screen.getByLabelText(/^Password/), "short");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByLabelText(/^Password/)).toHaveAccessibleDescription(/At least 12 characters.*Use at least 12 characters/);

    await userEvent.type(screen.getByLabelText(/^Password/), "-but-long-enough");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Thanks for signing up.");
    expect(screen.getByRole("heading", { name: "Sign in to MedNet" })).toBeInTheDocument();
    const body = JSON.parse(String(calls.find((call) => call.url === "/api/v1/auth/register")!.init?.body));
    expect(body).toEqual({ email: "new@b.lr", password: "short-but-long-enough" });
  });

  it("surfaces the backend's plain-message 503 when verification email cannot be sent", async () => {
    on("GET", "/api/v1/auth/session", unauthenticated);
    on("POST", "/api/v1/auth/register", { status: 503, body: { message: "Verification email could not be sent. Please try again shortly." } });
    render(<SignInPanel googleError={false} />);
    await userEvent.click(await screen.findByText("Create account"));
    await userEvent.type(screen.getByRole("textbox", { name: /Email address/ }), "new@b.lr");
    await userEvent.type(screen.getByLabelText(/^Password/), "a-valid-password");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Verification email could not be sent. Please try again shortly.");
  });

  it("sends a recovery code and links to the code-entry step", async () => {
    on("GET", "/api/v1/auth/session", unauthenticated);
    on("POST", "/api/v1/auth/forgot-password", { status: 202, body: { message: "If an account exists for this email, password reset instructions will arrive shortly." } });
    render(<SignInPanel googleError={false} />);
    await userEvent.click(await screen.findByRole("button", { name: "Forgot password?" }));
    await userEvent.type(screen.getByRole("textbox", { name: /Email address/ }), "p@b.lr");
    await userEvent.click(screen.getByRole("button", { name: "Send recovery code" }));
    expect(await screen.findByRole("status")).toHaveTextContent("password reset instructions");
    expect(screen.getByRole("link", { name: "Enter your recovery code" })).toHaveAttribute("href", "/reset?email=p%40b.lr");
  });

  it("shows the Google error notice and the Google option when enabled", async () => {
    on("GET", "/api/v1/auth/session", unauthenticated);
    on("GET", "/api/v1/auth/google/status", { status: 200, body: { enabled: true, missingConfiguration: [] } });
    render(<SignInPanel googleError />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Google sign-in could not be completed");
    expect(await screen.findByRole("link", { name: "Continue with Google" })).toHaveAttribute(
      "href",
      "/api/v1/auth/oauth2/authorization/google",
    );
  });

  it("shows the exact missing backend setting names when Google sign-in is unavailable", async () => {
    on("GET", "/api/v1/auth/session", unauthenticated);
    on("GET", "/api/v1/auth/google/status", {
      status: 200,
      body: {
        enabled: false,
        missingConfiguration: ["SPRING_DATASOURCE_URL", "GOOGLE_CLIENT_SECRET"],
      },
    });
    render(<SignInPanel googleError={false} />);
    expect(await screen.findByText(/SPRING_DATASOURCE_URL, GOOGLE_CLIENT_SECRET/)).toBeInTheDocument();
  });

  it("does not report Google as unconfigured when the status endpoint fails", async () => {
    on("GET", "/api/v1/auth/session", unauthenticated);
    on("GET", "/api/v1/auth/google/status", { status: 503, body: { message: "Unavailable" } });
    render(<SignInPanel googleError={false} />);
    expect(await screen.findByText(/Could not check Google sign-in availability/)).toBeInTheDocument();
  });
});

describe("ResetPasswordPanel", () => {
  it("starts at the code step from the email link and completes the reset", async () => {
    window.history.replaceState = vi.fn();
    on("POST", "/api/v1/auth/reset-password/verify", { status: 200, body: { token: "reset-token", message: "ok" } });
    on("POST", "/api/v1/auth/reset-password", { status: 200, body: { message: "Password updated. You can now sign in." } });
    render(<ResetPasswordPanel initialEmail="p@b.lr" />);

    expect(screen.getByRole("heading", { name: "Enter your recovery code" })).toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox", { name: /Six-digit code/ }), "12a3456");
    expect(screen.getByRole("textbox", { name: /Six-digit code/ })).toHaveValue("123456");
    await userEvent.click(screen.getByRole("button", { name: "Verify code" }));

    expect(await screen.findByRole("heading", { name: "Choose a new password" })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/^New password/), "a-brand-new-password");
    await userEvent.click(screen.getByRole("button", { name: "Update password" }));
    expect(await screen.findByText("Password updated. You can now sign in.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue to sign in" })).toHaveAttribute("href", "/sign-in");
  });

  it("shows the backend's invalid-code message", async () => {
    on("POST", "/api/v1/auth/reset-password/verify", { status: 400, body: { token: null, message: "The code is invalid or expired. Request a new code." } });
    render(<ResetPasswordPanel initialEmail="p@b.lr" />);
    await userEvent.type(screen.getByRole("textbox", { name: /Six-digit code/ }), "000000");
    await userEvent.click(screen.getByRole("button", { name: "Verify code" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The code is invalid or expired. Request a new code.");
  });
});

describe("VerifyEmailPanel", () => {
  it("reports an incomplete link without calling the API", async () => {
    render(<VerifyEmailPanel />);
    expect(await screen.findByRole("alert")).toHaveTextContent("This verification link is incomplete.");
    expect(calls).toHaveLength(0);
  });

  it("confirms a valid link", async () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, search: "?email=p%40b.lr&token=abc", origin: "http://localhost:3000" },
    });
    on("GET", "/api/v1/auth/verify", { status: 200, body: { message: "Email verified. You can now sign in." } });
    render(<VerifyEmailPanel />);
    expect(await screen.findByText("Email verified. You can now sign in.")).toBeInTheDocument();
    expect(calls[0].url).toBe("/api/v1/auth/verify?email=p%40b.lr&token=abc");
  });
});

describe("AccountPanel", () => {
  it("forwards administrators to /admin without rendering account details", async () => {
    on("GET", "/api/v1/auth/session", { status: 200, body: { email: "admin@b.lr", role: "ADMIN" } });
    render(<AccountPanel />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin"));
    expect(screen.queryByText("admin@b.lr")).not.toBeInTheDocument();
  });

  it("forwards providers to their workspace (Google sign-in lands them on /account)", async () => {
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

  it("shows the session email and a readable account type, then signs out with CSRF", async () => {
    on("GET", "/api/v1/auth/session", { status: 200, body: { email: "patient@b.lr", role: "PATIENT" } });
    on("POST", "/api/v1/auth/logout", { status: 204 });
    render(<AccountPanel />);
    expect(await screen.findByText("patient@b.lr")).toBeInTheDocument();
    expect(screen.getByText("Patient")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("link", { name: "Go to sign in" })).toHaveAttribute("href", "/sign-in");
    const logout = calls.find((call) => call.init?.method === "POST");
    expect((logout?.init?.headers as Record<string, string>)["X-XSRF-TOKEN"]).toBe("t");
  });

  it("keeps the session and explains a failed sign-out", async () => {
    on("GET", "/api/v1/auth/session", { status: 200, body: { email: "p@b.lr", role: "PATIENT" } });
    on("POST", "/api/v1/auth/logout", { status: 500 });
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
