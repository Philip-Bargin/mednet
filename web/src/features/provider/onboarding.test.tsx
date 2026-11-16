import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApplicantDashboard } from "./application";
import { onboardingStates } from "./onboarding-steps";
import type { ProviderApplication } from "./provider-api";

const posts: unknown[] = [];
let applyResponse: { status: number; body: unknown } = { status: 200, body: {} };

beforeEach(() => {
  posts.length = 0;
  applyResponse = { status: 200, body: {} };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/auth/csrf")) return Response.json({ headerName: "X-XSRF-TOKEN", token: "t" });
      if (url.endsWith("/providers/applications") && init?.method === "POST") {
        posts.push(JSON.parse(String(init.body)));
        return Response.json(applyResponse.body, { status: applyResponse.status });
      }
      throw new Error(`Unexpected request ${init?.method ?? "GET"} ${url}`);
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

const application = (status: string): ProviderApplication => ({
  id: "app-1",
  displayName: "Dr. Abena Sirleaf",
  specialty: "Family medicine",
  credentialReference: "LMDC-2041",
  status,
  createdAt: "2026-11-10T09:00:00Z",
  reviewedAt: status === "PENDING" ? null : "2026-11-12T09:00:00Z",
});

function renderDashboard(app: ProviderApplication | null, providerAccount = true) {
  const onApplicationChanged = vi.fn();
  const onSignOut = vi.fn();
  render(
    <ApplicantDashboard
      application={app}
      providerAccount={providerAccount}
      onApplicationChanged={onApplicationChanged}
      onSignOut={onSignOut}
      signOutFailed={false}
    />,
  );
  return { onApplicationChanged, onSignOut };
}

function stepText(name: RegExp) {
  return within(screen.getByRole("list", { name: "Provider sign-up steps" })).getByText(name).closest("li")!;
}

describe("onboardingStates", () => {
  it("marks earlier steps complete, the current step current and a review outcome needing action", () => {
    expect(onboardingStates("details")).toEqual({ account: "complete", email: "complete", details: "current", review: "upcoming" });
    expect(onboardingStates("details", true).review).toBe("attention");
    expect(Object.values(onboardingStates("done"))).toEqual(["complete", "complete", "complete", "complete"]);
  });
});

describe("ApplicantDashboard", () => {
  it("asks a new provider sign-up for professional details and submits one application", async () => {
    const { onApplicationChanged } = renderDashboard(null);
    expect(screen.getByRole("heading", { name: "Submit your professional details" })).toBeInTheDocument();
    expect(stepText(/Submit your professional details/)).toHaveAttribute("aria-current", "step");
    expect(screen.queryByRole("link", { name: "Go to the patient workspace" })).not.toBeInTheDocument();

    const form = screen.getByRole("form", { name: "Professional details" });
    await userEvent.click(within(form).getByRole("button", { name: "Submit application" }));
    // The form focuses the first invalid field on the next animation frame.
    await waitFor(() => expect(within(form).getByRole("textbox", { name: /Display name/ })).toHaveFocus());
    expect(posts).toEqual([]);

    await userEvent.type(within(form).getByRole("textbox", { name: /Display name/ }), "Dr. Abena Sirleaf");
    await userEvent.type(within(form).getByRole("textbox", { name: /Specialty/ }), "Family medicine");
    await userEvent.type(within(form).getByRole("textbox", { name: /Licence or registration reference/ }), "LMDC-2041");
    await userEvent.click(within(form).getByRole("button", { name: "Submit application" }));

    await waitFor(() => expect(onApplicationChanged).toHaveBeenCalledTimes(1));
    expect(posts).toEqual([{ displayName: "Dr. Abena Sirleaf", specialty: "Family medicine", credentialReference: "LMDC-2041" }]);
  });

  it("resumes the existing application when the API reports one was already submitted", async () => {
    applyResponse = { status: 409, body: { success: false, error: { code: "CONFLICT", message: "A provider application already exists for this account" } } };
    const { onApplicationChanged } = renderDashboard(null);
    const form = screen.getByRole("form", { name: "Professional details" });
    await userEvent.type(within(form).getByRole("textbox", { name: /Display name/ }), "Dr. Abena Sirleaf");
    await userEvent.type(within(form).getByRole("textbox", { name: /Specialty/ }), "Family medicine");
    await userEvent.type(within(form).getByRole("textbox", { name: /Licence or registration reference/ }), "LMDC-2041");
    await userEvent.click(within(form).getByRole("button", { name: "Submit application" }));
    await waitFor(() => expect(onApplicationChanged).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a pending application under review with a status check and no clinical actions", async () => {
    const { onApplicationChanged } = renderDashboard(application("PENDING"));
    expect(screen.getByRole("heading", { name: "Your application is under review" })).toBeInTheDocument();
    expect(stepText(/Administrator review/)).toHaveAttribute("aria-current", "step");
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /schedule|appointments|patients/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Check status" }));
    expect(onApplicationChanged).toHaveBeenCalledTimes(1);
  });

  it("offers a corrected application after a rejection", () => {
    renderDashboard(application("REJECTED"));
    expect(screen.getByRole("heading", { name: "Your application was not approved" })).toBeInTheDocument();
    expect(stepText(/Administrator review/)).toHaveTextContent("needs attention");
    expect(screen.getByRole("form", { name: "Submit corrected details" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit corrected application" })).toBeInTheDocument();
  });

  it("offers no new application while suspended", () => {
    renderDashboard(application("SUSPENDED"));
    expect(screen.getByRole("heading", { name: "Your provider listing is suspended" })).toBeInTheDocument();
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  });

  it("asks an applicant approved after signing in to sign in again", async () => {
    const { onSignOut } = renderDashboard(application("APPROVED"));
    expect(screen.getByRole("heading", { name: "Sign in again to open your doctor workspace" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it("keeps the patient workspace link for patients who applied", () => {
    renderDashboard(application("PENDING"), false);
    expect(screen.getByRole("link", { name: "Go to the patient workspace" })).toHaveAttribute("href", "/patient");
  });
});
