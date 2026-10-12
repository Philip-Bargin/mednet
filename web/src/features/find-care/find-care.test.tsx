import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { topSpecialties } from "@/features/home/home-directory";
import { AvailabilityDrawer } from "./availability-drawer";
import { findCareHref } from "./find-care";
import { consultationModeLabel, formatDayHeading, formatNextAvailable, formatSlot, groupByDay } from "./format";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

/** Scripted fetch, same approach as the auth panel tests. Live behaviour: e2e/find-care.live.spec.ts. */
type Route = { status: number; body?: unknown };
const routes = new Map<string, Route[]>();
const calls: Array<{ url: string; init?: RequestInit }> = [];
const on = (method: string, path: string, ...responses: Route[]) => routes.set(`${method} ${path}`, responses);

const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  calls.push({ url, init });
  const key = `${init?.method ?? "GET"} ${url.split("?")[0]}`;
  if (key === "GET /api/v1/auth/csrf") return Response.json({ headerName: "X-XSRF-TOKEN", token: "t" });
  const queue = routes.get(key);
  if (!queue?.length) throw new Error(`Unexpected request ${key}`);
  const next = queue.length > 1 ? queue.shift()! : queue[0];
  return next.body === undefined ? new Response(null, { status: next.status }) : Response.json(next.body, { status: next.status });
});

beforeEach(() => {
  routes.clear();
  calls.length = 0;
  vi.stubGlobal("fetch", fetchMock);
  // jsdom has no <dialog> modal support.
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});
afterEach(() => vi.unstubAllGlobals());

const page = <T,>(content: T[], number = 0, totalPages = 1) => ({ content, number, totalPages, totalElements: content.length, size: 25 });
const provider = { id: "p1", displayName: "Dr. Ama Kollie", specialty: "General medicine" };
const slots = [
  { id: "s1", startsAt: "2026-10-12T09:00:00Z", endsAt: "2026-10-12T09:30:00Z", consultationMode: "IN_PERSON" },
  { id: "s2", startsAt: "2026-10-12T14:30:00Z", endsAt: "2026-10-12T15:00:00Z", consultationMode: "TEXT" },
  { id: "s3", startsAt: "2026-10-14T10:00:00Z", endsAt: "2026-10-14T10:30:00Z", consultationMode: "TEXT" },
];
const unauthenticated = { status: 401, body: { success: false, error: { code: "UNAUTHORIZED", message: "Sign-in required" } } };

describe("format (Liberia time, GMT)", () => {
  const now = new Date("2026-10-12T08:00:00Z");
  it("labels today and tomorrow, otherwise weekday and date", () => {
    expect(formatNextAvailable("2026-10-12T14:30:00Z", now)).toBe("Today, 2:30 PM");
    expect(formatNextAvailable("2026-10-13T09:00:00Z", now)).toBe("Tomorrow, 9:00 AM");
    expect(formatNextAvailable("2026-10-14T10:00:00Z", now)).toBe("Wed 14 Oct, 10:00 AM");
    expect(formatDayHeading("2026-10-14T10:00:00Z", now)).toBe("Wednesday 14 October");
  });

  it("uses Liberia's calendar day, not the browser's", () => {
    // 23:30 GMT on the 12th is still "today" in Monrovia regardless of the test machine's zone.
    expect(formatNextAvailable("2026-10-12T23:30:00Z", now)).toBe("Today, 11:30 PM");
  });

  it("describes a full slot and groups by day in order", () => {
    expect(formatSlot("2026-10-12T09:00:00Z", "2026-10-12T09:30:00Z")).toBe("Monday 12 October, 9:00 AM – 9:30 AM");
    expect(groupByDay(slots).map((g) => g.slots.map((s) => s.id))).toEqual([["s1", "s2"], ["s3"]]);
  });

  it("names only the consultation modes the backend supports", () => {
    expect(consultationModeLabel("IN_PERSON")).toBe("In person");
    expect(consultationModeLabel("TEXT")).toBe("Text consultation");
    expect(consultationModeLabel("VIDEO")).toBe("Consultation");
  });
});

describe("topSpecialties", () => {
  it("adds up server counts case-insensitively, groups spellings and orders by count", () => {
    const counts = [
      { specialty: "Pediatrics", providers: 2 },
      { specialty: "General medicine", providers: 2 },
      { specialty: "pediatrics", providers: 1 },
      { specialty: " ", providers: 4 },
      { specialty: "Cardiology", providers: 1 },
      { specialty: "Paediatrics", providers: 3 },
    ];
    expect(topSpecialties(counts)).toEqual([
      { name: "Paediatrics", count: 6 },
      { name: "General medicine", count: 2 },
      { name: "Cardiology", count: 1 },
    ]);
  });
});

describe("findCareHref", () => {
  it("keeps only meaningful parameters", () => {
    expect(findCareHref({})).toBe("/find-care");
    expect(findCareHref({ search: "ama", page: 1, provider: "p1", slot: "s2" })).toBe("/find-care?search=ama&provider=p1&slot=s2");
    expect(findCareHref({ specialty: "Women’s health", page: 3 })).toBe("/find-care?specialty=Women%E2%80%99s+health&page=3");
  });
});

describe("AvailabilityDrawer", () => {
  function openDrawer(initialSlotId?: string) {
    return render(<AvailabilityDrawer provider={provider} providerId="p1" initialSlotId={initialSlotId} onClose={() => undefined} />);
  }

  it("lists open times by day and sends signed-out visitors to sign in with the chosen time", async () => {
    on("GET", "/api/v1/providers/p1/availability", { status: 200, body: page(slots) });
    on("GET", "/api/v1/auth/session", unauthenticated);
    openDrawer();

    const group = await screen.findByRole("group", { name: "Choose an open time" });
    expect(within(group).getAllByRole("radio")).toHaveLength(3);
    expect(within(group).getByText("Times are in Liberia time (GMT).")).toBeInTheDocument();

    await userEvent.click(within(group).getByRole("radio", { name: /2:30 PM – 3:00 PM/ }));
    const signIn = await screen.findByRole("link", { name: "Sign in to request this time" });
    expect(signIn).toHaveAttribute("href", `/sign-in?redirect=${encodeURIComponent("/find-care?provider=p1&slot=s2")}`);
    expect(calls.some((c) => c.init?.method === "POST")).toBe(false);
  });

  it("lets a patient send the request for the preselected time", async () => {
    on("GET", "/api/v1/providers/p1/availability", { status: 200, body: page(slots) });
    on("GET", "/api/v1/auth/session", { status: 200, body: { email: "p@b.lr", role: "PATIENT" } });
    on("POST", "/api/v1/appointments", {
      status: 200,
      body: { id: "a1", status: "PENDING", providerName: "Dr. Ama Kollie", consultationMode: "TEXT", startsAt: slots[1].startsAt, endsAt: slots[1].endsAt },
    });
    openDrawer("s2");

    expect(await screen.findByRole("radio", { name: /2:30 PM – 3:00 PM/ })).toBeChecked();
    await userEvent.click(await screen.findByRole("button", { name: "Send appointment request" }));

    expect(await screen.findByText("Request sent")).toBeInTheDocument();
    const post = calls.find((c) => c.init?.method === "POST");
    expect(JSON.parse(String(post?.init?.body))).toEqual({ availabilitySlotId: "s2" });
    expect((post?.init?.headers as Record<string, string>)["X-XSRF-TOKEN"]).toBe("t");
    expect(screen.getByRole("link", { name: "View my appointments" })).toHaveAttribute("href", "/patient/appointments");
  });

  it("asks for a completed patient profile on the API's 409", async () => {
    on("GET", "/api/v1/providers/p1/availability", { status: 200, body: page(slots) });
    on("GET", "/api/v1/auth/session", { status: 200, body: { email: "p@b.lr", role: "PATIENT" } });
    on("POST", "/api/v1/appointments", {
      status: 409,
      body: { success: false, error: { code: "CONFLICT", message: "Complete your patient profile before booking" } },
    });
    openDrawer("s1");
    await userEvent.click(await screen.findByRole("button", { name: "Send appointment request" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Complete your patient profile before booking");
    expect(within(alert).getByRole("link", { name: "Open my profile" })).toHaveAttribute("href", "/patient/profile");
  });

  it("refreshes the times when the chosen one was just taken", async () => {
    on(
      "GET",
      "/api/v1/providers/p1/availability",
      { status: 200, body: page(slots) },
      { status: 200, body: page(slots.slice(1)) },
    );
    on("GET", "/api/v1/auth/session", { status: 200, body: { email: "p@b.lr", role: "PATIENT" } });
    on("POST", "/api/v1/appointments", {
      status: 409,
      body: { success: false, error: { code: "CONFLICT", message: "The selected appointment time is unavailable" } },
    });
    openDrawer("s1");
    await userEvent.click(await screen.findByRole("button", { name: "Send appointment request" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That time is no longer available");
    await waitFor(() => expect(screen.getAllByRole("radio")).toHaveLength(2));
    expect(screen.getByRole("button", { name: "Send appointment request" })).toBeDisabled();
  });

  it("tells provider and staff accounts that only patients can request", async () => {
    on("GET", "/api/v1/providers/p1/availability", { status: 200, body: page(slots) });
    on("GET", "/api/v1/auth/session", { status: 200, body: { email: "d@b.lr", role: "PROVIDER" } });
    openDrawer();
    expect(await screen.findByText("Requests are made from a patient account")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send appointment request" })).not.toBeInTheDocument();
  });

  it("shows empty and not-listed states", async () => {
    on("GET", "/api/v1/providers/p1/availability", { status: 200, body: page([]) });
    on("GET", "/api/v1/auth/session", unauthenticated);
    const { unmount } = openDrawer();
    expect(await screen.findByText("No open times")).toBeInTheDocument();
    unmount();

    on("GET", "/api/v1/providers/p1/availability", { status: 404, body: { success: false, error: { code: "NOT_FOUND", message: "x" } } });
    openDrawer();
    expect(await screen.findByText("This provider is not available")).toBeInTheDocument();
  });
});
