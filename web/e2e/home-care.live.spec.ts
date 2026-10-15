import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { adminContext, completePatientProfile, createVerifiedAccount, signedInContext } from "./support/seed-directory";

/**
 * Home-care workspace and the patient → administrator → home-care → patient workflow (Phase 5C)
 * against a running MedNet API, no mocks. Run with MEDNET_LIVE_API=1 (see e2e/README.md). Synthetic
 * accounts and text only. Every stage is driven through the acting role's real UI and checked from the
 * other roles' sessions:
 *
 *   patient requests home care → administrator assigns → staff schedules, starts and completes the
 *   visit → patient sees each status. Other accounts are refused, and a request the patient cancels
 *   while it is open is refused to the staff member and shown as cancelled.
 */
test.describe.configure({ mode: "serial" });

const password = "Phase5c-Live-Pass-1";
let baseURL = "";
let tag = "";
const admin = { email: "", context: null as unknown as APIRequestContext };
const patient = { email: "", name: "", context: null as unknown as APIRequestContext };
const staff = { email: "", name: "", publicId: "", context: null as unknown as APIRequestContext };
const colleague = { email: "", context: null as unknown as APIRequestContext };
const lab = { email: "", context: null as unknown as APIRequestContext };
let requestId = "";
let reference = "";
const care = () => `Synthetic wound dressing ${tag}`;
const place = () => `Synthetic address ${tag}, Sinkor`;
/** Two days ahead at 10:30 Liberia time (GMT), as a datetime-local value. */
const visitInput = () => `${new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10)}T10:30`;

async function csrf(context: APIRequestContext) {
  const token = await (await context.get("/api/v1/auth/csrf")).json();
  return { [token.headerName]: token.token } as Record<string, string>;
}

async function send(context: APIRequestContext, method: "GET" | "POST" | "PUT" | "PATCH", url: string, data?: unknown) {
  return context.fetch(url, { method, data, headers: method === "GET" ? {} : await csrf(context) });
}

async function call(context: APIRequestContext, method: "GET" | "POST" | "PUT" | "PATCH", url: string, data?: unknown) {
  const response = await send(context, method, url, data);
  if (!response.ok()) throw new Error(`${method} ${url} → ${response.status()} ${await response.text()}`);
  const text = await response.text();
  return text ? JSON.parse(text) : undefined;
}

async function as(page: Page, context: APIRequestContext) {
  await page.context().clearCookies();
  await page.context().addCookies((await context.storageState()).cookies);
}

async function expectFitsAndAccessible(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).exclude("nextjs-portal").analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
}

async function patientStatus(id: string) {
  const mine = await call(patient.context, "GET", "/api/v1/home-care-requests");
  return mine.find((r: { id: string }) => r.id === id);
}

async function openVisit(page: Page, id: string) {
  await page.goto("/home-care/visits");
  const ref = `HCR-${id.replaceAll("-", "").slice(0, 8).toUpperCase()}`;
  await page.getByRole("button", { name: `Open ${ref}` }).filter({ visible: true }).click();
  return page.getByRole("region", { name: "Selected record" });
}

async function assignInAdminUi(page: Page, id: string) {
  const ref = id.replaceAll("-", "").slice(0, 8).toUpperCase();
  await as(page, admin.context);
  await page.goto("/admin/tasks");
  await page.getByRole("tab", { name: "Home-care requests" }).click();
  await page.getByRole("button", { name: new RegExp(`Request ${ref}`) }).click();
  const record = page.getByRole("region", { name: "Selected record" });
  await record.getByLabel("Assign to home-care staff").selectOption({ label: `${staff.name} (${staff.publicId})` });
  await record.getByRole("button", { name: "Assign request" }).click();
  await expect(page.getByRole("status").filter({ hasText: "The request was assigned." })).toBeVisible();
  return record;
}

test.beforeAll(async ({}, testInfo) => {
  baseURL = String(testInfo.project.use.baseURL);
  tag = `${testInfo.project.name}${Date.now().toString(36)}`;
  const superAdmin = await adminContext(baseURL);

  admin.email = `p5c-admin-${tag}@mednet.test`;
  const adminAccount = await createVerifiedAccount(superAdmin, { email: admin.email, displayName: `Ops ${tag}`, accountType: "PATIENT", password });
  await call(superAdmin, "PUT", `/api/v1/admin/accounts/${adminAccount.id}`, { displayName: `Ops ${tag}`, email: admin.email, accountType: "ADMIN" });
  admin.context = await signedInContext(baseURL, admin.email, password);

  patient.email = `p5c-patient-${tag}@mednet.test`;
  patient.name = `Musu Patient ${tag}`;
  await createVerifiedAccount(superAdmin, { email: patient.email, displayName: patient.name, accountType: "PATIENT", password });
  patient.context = await signedInContext(baseURL, patient.email, password);
  await completePatientProfile(patient.context, patient.name);

  staff.email = `p5c-hc-${tag}@mednet.test`;
  staff.name = `Hawa Carer ${tag}`;
  await createVerifiedAccount(superAdmin, { email: staff.email, displayName: staff.name, accountType: "HOME_CARE", password });
  staff.publicId = (await call(superAdmin, "GET", `/api/v1/admin/accounts?search=${encodeURIComponent(staff.email)}`)).content[0].publicId;
  staff.context = await signedInContext(baseURL, staff.email, password);

  colleague.email = `p5c-hc2-${tag}@mednet.test`;
  await createVerifiedAccount(superAdmin, { email: colleague.email, displayName: `Other Carer ${tag}`, accountType: "HOME_CARE", password });
  colleague.context = await signedInContext(baseURL, colleague.email, password);
  lab.email = `p5c-lab-${tag}@mednet.test`;
  await createVerifiedAccount(superAdmin, { email: lab.email, displayName: `Lab ${tag}`, accountType: "LABORATORY", password });
  lab.context = await signedInContext(baseURL, lab.email, password);
});

test("home-care sign-in lands in the home-care workspace", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("textbox", { name: "Email address" }).fill(staff.email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/home-care$/);
  await expect(page.getByRole("heading", { level: 1, name: "Home care" })).toBeVisible();
  await expect(page.getByText("No home-care requests are assigned to you")).toBeVisible();
  await page.goto("/account");
  await expect(page).toHaveURL(/\/home-care$/);
  // Laboratory pages send home-care staff back to their own workspace.
  await page.goto("/laboratory/orders");
  await expect(page).toHaveURL(/\/home-care$/);
  await expectFitsAndAccessible(page);
});

test("1. the patient requests home care in the patient workspace", async ({ page }) => {
  await as(page, patient.context);
  await page.goto("/patient/appointments?tab=home-care");
  await page.getByRole("textbox", { name: "Care needed" }).fill(care());
  await page.getByRole("textbox", { name: "Visit location" }).fill(place());
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText(care()).first()).toBeVisible();
  const mine = await call(patient.context, "GET", "/api/v1/home-care-requests");
  const created = mine.find((r: { requestedService: string }) => r.requestedService === care());
  expect(created.status).toBe("OPEN");
  requestId = created.id;
  reference = `HCR-${requestId.replaceAll("-", "").slice(0, 8).toUpperCase()}`;
  // Not assigned yet: no home-care staff member sees it.
  expect(JSON.stringify(await call(staff.context, "GET", "/api/v1/partner/service-requests?type=HOME_CARE"))).not.toContain(requestId);
});

test("2. an administrator assigns it, seeing no care details or address", async ({ page }) => {
  const record = await assignInAdminUi(page, requestId);
  await expect(record).toContainText(staff.publicId);
  await expect(record).not.toContainText(care());
  await expect(record).not.toContainText(place());
  const queue = await call(admin.context, "GET", "/api/v1/admin/service-requests?type=HOME_CARE");
  const row = queue.find((r: { id: string }) => r.id === requestId);
  expect(row).toEqual({ id: requestId, requestType: "HOME_CARE", status: "OPEN", createdAt: row.createdAt, assignedStaffPublicId: staff.publicId });
});

test("3. the assigned staff member sees care and location, not the patient, and schedules the visit", async ({ page }) => {
  await as(page, staff.context);
  const record = await openVisit(page, requestId);
  await expect(record).toContainText(care());
  await expect(record).toContainText(place());
  await expect(record).not.toContainText(patient.name);
  await expect(record).not.toContainText(patient.email);
  const when = visitInput();
  await record.getByLabel("Visit date and time").fill(when);
  await record.getByRole("button", { name: "Schedule visit" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Schedule visit" }).click();
  await expect(page.getByRole("status").filter({ hasText: `${reference}: visit scheduled` })).toBeVisible();
  await expect(record.getByRole("button", { name: "Start visit" })).toBeVisible();
  const seen = await patientStatus(requestId);
  expect(seen.status).toBe("OPEN");
  expect(seen.scheduledAt).toBe(new Date(`${when}:00Z`).toISOString().replace(".000Z", "Z"));
  await expectFitsAndAccessible(page);
});

test("4. the patient sees the visit time in the patient workspace", async ({ page }) => {
  await as(page, patient.context);
  await page.goto("/patient/appointments?tab=home-care");
  const row = page.getByRole("listitem").filter({ hasText: care() });
  await expect(row).toContainText("Visit");
  await expect(row).toContainText("Open");
});

test("5. other accounts can neither see nor change the request", async () => {
  const colleagueQueue = await call(colleague.context, "GET", "/api/v1/partner/service-requests?type=HOME_CARE");
  expect(JSON.stringify(colleagueQueue)).not.toContain(requestId);
  for (const [context, expected] of [
    [colleague.context, 404],
    [lab.context, 403],
    [patient.context, 403],
    [admin.context, 403],
  ] as const) {
    expect((await send(context, "PATCH", `/api/v1/partner/service-requests/${requestId}/status`, { status: "IN_PROGRESS" })).status()).toBe(expected);
  }
  expect((await send(lab.context, "GET", "/api/v1/partner/service-requests?type=HOME_CARE")).status()).toBe(403);
  expect((await send(staff.context, "GET", "/api/v1/partner/service-requests?type=LABORATORY")).status()).toBe(403);
  expect((await send(staff.context, "GET", "/api/v1/partner/lab-results")).status()).toBe(403);
  expect((await send(staff.context, "GET", "/api/v1/home-care-requests")).status()).toBe(403);
  expect((await patientStatus(requestId)).status).toBe("OPEN");
});

test("6. the staff member starts and completes the visit; the patient sees each status", async ({ page }) => {
  await as(page, staff.context);
  const record = await openVisit(page, requestId);
  await record.getByRole("button", { name: "Start visit" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Start visit" }).click();
  await expect(page.getByRole("status").filter({ hasText: `${reference}: visit started` })).toBeVisible();
  expect((await patientStatus(requestId)).status).toBe("IN_PROGRESS");
  // The patient can no longer cancel once the visit has started.
  expect((await send(patient.context, "PATCH", `/api/v1/home-care-requests/${requestId}/cancel`)).status()).toBe(409);

  await record.getByRole("button", { name: "Mark visit completed" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Mark completed" }).click();
  await expect(page.getByRole("status").filter({ hasText: `${reference}: visit completed` })).toBeVisible();
  await expect(record.getByRole("button")).toHaveCount(0);
  expect((await patientStatus(requestId)).status).toBe("RESOLVED");

  await as(page, patient.context);
  await page.goto("/patient/appointments?tab=home-care");
  await expect(page.getByRole("listitem").filter({ hasText: care() })).toContainText("Resolved");
});

test("7. a request the patient cancels is refused to the staff member and shown as cancelled", async ({ page }) => {
  const second = await call(patient.context, "POST", "/api/v1/home-care-requests", {
    serviceDescription: `${care()} (second)`,
    locationDescription: place(),
  });
  await assignInAdminUi(page, second.id);
  await as(page, staff.context);
  const record = await openVisit(page, second.id);
  await expect(record).toContainText(`${care()} (second)`);
  // Cancelled by the patient while the staff member has it open.
  await call(patient.context, "PATCH", `/api/v1/home-care-requests/${second.id}/cancel`);
  await record.getByLabel("Visit date and time").fill(visitInput());
  await record.getByRole("button", { name: "Schedule visit" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Schedule visit" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Only unscheduled open home-care requests can be scheduled" })).toBeVisible();
  await expect(record).toContainText("Do not visit.");
  expect((await patientStatus(second.id)).status).toBe("CANCELLED");
});
