import AxeBuilder from "@axe-core/playwright";
import { expect, request as playwrightRequest, test, type APIRequestContext, type Page } from "@playwright/test";
import {
  adminContext,
  completePatientProfile,
  createVerifiedAccount,
  seedProvider,
  signedInContext,
  type SeededProvider,
} from "./support/seed-directory";

/**
 * Laboratory workspace and the laboratory → doctor → patient result workflow (Phase 4F) against a
 * running MedNet API, no mocks. Run with MEDNET_LIVE_API=1 (see e2e/README.md). Synthetic accounts and
 * synthetic result text only. Every stage is driven through the real UI of the acting role, and the
 * outcome is checked from the other roles' sessions:
 *
 *   patient requests (patient UI) → administrator assigns (admin UI) → laboratory starts and submits
 *   (laboratory UI) → doctor returns it (doctor UI) → laboratory submits a correction → doctor releases →
 *   patient reads it (patient UI). The unreleased result is checked as invisible to the patient at
 *   every stage before release, and other accounts are refused.
 */
test.describe.configure({ mode: "serial" });

const password = "Phase4f-Live-Pass-1";
let baseURL = "";
let tag = "";
let doctor: SeededProvider;
const admin = { email: "", context: null as unknown as APIRequestContext };
let patient = { email: "", name: "", id: "", context: null as unknown as APIRequestContext };
const lab = { email: "", context: null as unknown as APIRequestContext, publicId: "" };
const otherLab = { email: "", context: null as unknown as APIRequestContext };
const homeCare = { email: "", context: null as unknown as APIRequestContext };
let requestId = "";
let reference = "";
const testName = () => `Synthetic full blood count ${tag}`;
const firstResult = () => `Synthetic result ${tag}: haemoglobin value omitted in error`;
const correctedResult = () => `Synthetic corrected result ${tag}: all values within the synthetic reference range`;

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

/** The patient must not be able to read anything about the result before release. */
async function expectPatientSeesNoResult(page: Page) {
  const released = await call(patient.context, "GET", "/api/v1/patients/me/lab-results");
  expect(JSON.stringify(released)).not.toContain(tag);
  await as(page, patient.context);
  await page.goto("/patient/records?tab=laboratory");
  await expect(page.getByText("No released results yet.")).toBeVisible();
  await expect(page.getByText(firstResult())).toHaveCount(0);
  await expect(page.getByText(correctedResult())).toHaveCount(0);
}

test.beforeAll(async ({}, testInfo) => {
  baseURL = String(testInfo.project.use.baseURL);
  tag = `${testInfo.project.name}${Date.now().toString(36)}`;
  const superAdmin = await adminContext(baseURL);
  doctor = await seedProvider(baseURL, superAdmin, {
    email: `p4f-doc-${tag}@mednet.test`,
    displayName: `Dr. Lab Reviewer ${tag}`,
    specialty: "General medicine",
    password,
    slots: [{ startsAt: new Date(Math.ceil((Date.now() + 30 * 3_600_000) / 60_000) * 60_000), minutes: 30, mode: "TEXT" }],
  });

  admin.email = `p4f-admin-${tag}@mednet.test`;
  const adminAccount = await createVerifiedAccount(superAdmin, { email: admin.email, displayName: `Ops ${tag}`, accountType: "PATIENT", password });
  await call(superAdmin, "PUT", `/api/v1/admin/accounts/${adminAccount.id}`, { displayName: `Ops ${tag}`, email: admin.email, accountType: "ADMIN" });
  admin.context = await signedInContext(baseURL, admin.email, password);

  patient = { ...patient, email: `p4f-patient-${tag}@mednet.test`, name: `Musu Patient ${tag}` };
  patient.id = (await createVerifiedAccount(superAdmin, { email: patient.email, displayName: patient.name, accountType: "PATIENT", password })).id;
  patient.context = await signedInContext(baseURL, patient.email, password);
  await completePatientProfile(patient.context, patient.name);

  // Care relationship (confirmed appointment) and consent, so the doctor may review the patient's results.
  const appointment = await call(patient.context, "POST", "/api/v1/appointments", { availabilitySlotId: doctor.slotIds[0] });
  const doctorContext = await signedInContext(baseURL, doctor.email, password);
  await call(doctorContext, "PATCH", `/api/v1/appointments/${appointment.id}`, { action: "ACCEPT" });
  await call(patient.context, "POST", "/api/v1/patients/me/record-consents", { providerId: doctor.id });
  await doctorContext.dispose();

  lab.email = `p4f-lab-${tag}@mednet.test`;
  await createVerifiedAccount(superAdmin, { email: lab.email, displayName: `Grace Lab ${tag}`, accountType: "LABORATORY", password });
  lab.context = await signedInContext(baseURL, lab.email, password);
  const labAccount = (await call(superAdmin, "GET", `/api/v1/admin/accounts?search=${encodeURIComponent(lab.email)}`)).content[0];
  lab.publicId = labAccount.publicId;

  otherLab.email = `p4f-lab2-${tag}@mednet.test`;
  await createVerifiedAccount(superAdmin, { email: otherLab.email, displayName: `Other Lab ${tag}`, accountType: "LABORATORY", password });
  otherLab.context = await signedInContext(baseURL, otherLab.email, password);
  homeCare.email = `p4f-hc-${tag}@mednet.test`;
  await createVerifiedAccount(superAdmin, { email: homeCare.email, displayName: `Home Care ${tag}`, accountType: "HOME_CARE", password });
  homeCare.context = await signedInContext(baseURL, homeCare.email, password);
});

test("laboratory sign-in lands in the laboratory workspace", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("textbox", { name: "Email address" }).fill(lab.email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/laboratory$/);
  await expect(page.getByRole("heading", { level: 1, name: "Laboratory" })).toBeVisible();
  await expect(page.getByText("No orders are assigned to you")).toBeVisible();
  await page.goto("/account");
  await expect(page).toHaveURL(/\/laboratory$/);
  await expectFitsAndAccessible(page);
});

test("1. the patient requests a laboratory test in the patient workspace", async ({ page }) => {
  await as(page, patient.context);
  await page.goto("/patient/records?tab=laboratory");
  await page.getByRole("textbox", { name: "Test needed" }).fill(testName());
  await page.getByRole("button", { name: /Send request|Request test|Submit request/ }).click();
  await expect(page.getByText(testName()).first()).toBeVisible();
  const mine = await call(patient.context, "GET", "/api/v1/lab-requests");
  const created = mine.find((r: { requestedService: string }) => r.requestedService === testName());
  expect(created.status).toBe("OPEN");
  requestId = created.id;
  reference = requestId.replaceAll("-", "").slice(0, 8).toUpperCase();
  // Not assigned yet: no laboratory sees it.
  expect(JSON.stringify(await call(lab.context, "GET", "/api/v1/partner/service-requests?type=LABORATORY"))).not.toContain(requestId);
});

test("2. an administrator assigns it to the laboratory, and the queue shows the assignment", async ({ page }) => {
  await as(page, admin.context);
  await page.goto("/admin/tasks");
  await page.getByRole("tab", { name: "Laboratory requests" }).click();
  await page.getByRole("button", { name: new RegExp(`Request ${reference}`) }).click();
  const record = page.getByRole("region", { name: "Selected record" });
  await expect(record).not.toContainText(testName());
  await record.getByLabel("Assign to laboratory staff").selectOption({ label: `Grace Lab ${tag} (${lab.publicId})` });
  await record.getByRole("button", { name: "Assign request" }).click();
  await expect(page.getByRole("status").filter({ hasText: "The request was assigned." })).toBeVisible();
  await expect(record).toContainText(lab.publicId);
  // The server now reports the assignment, so a reload shows it and offers no second assignment.
  await page.reload();
  await page.getByRole("tab", { name: "Laboratory requests" }).click();
  await page.getByRole("button", { name: new RegExp(`Request ${reference}`) }).click();
  await expect(record).toContainText(lab.publicId);
  await expect(record.getByRole("button", { name: "Assign request" })).toHaveCount(0);
  const queue = await call(admin.context, "GET", "/api/v1/admin/service-requests?type=LABORATORY");
  const row = queue.find((r: { id: string }) => r.id === requestId);
  expect(row).toEqual({ id: requestId, requestType: "LABORATORY", status: "OPEN", createdAt: row.createdAt, assignedStaffPublicId: lab.publicId });
});

test("3–4. the laboratory receives the order and starts processing", async ({ page }) => {
  await as(page, lab.context);
  await page.goto("/laboratory/orders");
  await page.getByRole("button", { name: `Open LAB-${reference}` }).filter({ visible: true }).click();
  const record = page.getByRole("region", { name: "Selected record" });
  await expect(record).toContainText(testName());
  await expect(record).not.toContainText(patient.name);
  await expect(record).not.toContainText(patient.email);
  await record.getByRole("button", { name: "Start processing" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Start processing" }).click();
  await expect(page.getByRole("status").filter({ hasText: `LAB-${reference} is processing.` })).toBeVisible();
  const mine = await call(patient.context, "GET", "/api/v1/lab-requests");
  expect(mine.find((r: { id: string }) => r.id === requestId).status).toBe("IN_PROGRESS");
  await expectFitsAndAccessible(page);
});

test("5. the laboratory submits a result; it is not released and the patient cannot see it", async ({ page }) => {
  await as(page, lab.context);
  await page.goto("/laboratory/orders");
  await page.getByRole("button", { name: `Open LAB-${reference}` }).filter({ visible: true }).click();
  const record = page.getByRole("region", { name: "Selected record" });
  await record.getByRole("button", { name: "Submit for doctor review" }).click();
  await expect(record.getByRole("textbox", { name: "Result" })).toBeFocused();
  await record.getByRole("textbox", { name: "Result" }).fill(firstResult());
  await record.getByRole("button", { name: "Submit for doctor review" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Submit result" }).click();
  await expect(page.getByRole("status").filter({ hasText: "submitted for doctor review" })).toBeVisible();
  await expect(record.getByText("Result awaiting doctor review")).toBeVisible();

  // The status comes from the server: a fresh page load still shows it awaiting review.
  await page.reload();
  await page.getByRole("button", { name: `Open LAB-${reference}` }).filter({ visible: true }).click();
  await expect(page.getByRole("region", { name: "Selected record" }).getByText("Result awaiting doctor review")).toBeVisible();
  // A second submission while one is pending is refused by the server.
  expect((await send(lab.context, "POST", `/api/v1/partner/service-requests/${requestId}/lab-result`, { summary: "duplicate" })).status()).toBe(409);
  // Still in progress, not resolved: submission is not release.
  expect((await call(patient.context, "GET", "/api/v1/lab-requests")).find((r: { id: string }) => r.id === requestId).status).toBe("IN_PROGRESS");
  await expectPatientSeesNoResult(page);
});

test("6–7a. the doctor receives the result for review and returns it", async ({ page }) => {
  const doctorContext = await signedInContext(baseURL, doctor.email, password);
  await as(page, doctorContext);
  await page.goto(`/provider/patients/${patient.id}?tab=results`);
  const item = page.getByRole("list", { name: "Results to review" }).getByRole("listitem").filter({ hasText: firstResult() });
  await expect(item).toBeVisible();
  await item.getByRole("button", { name: "Return to laboratory" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Return result" }).click();
  await expect(page.getByText("Result returned to the laboratory.")).toBeVisible();
  await doctorContext.dispose();
  await expectPatientSeesNoResult(page);
});

test("7b. the laboratory submits a corrected result after the return", async ({ page }) => {
  await as(page, lab.context);
  await page.goto("/laboratory/orders");
  await page.getByRole("button", { name: `Open LAB-${reference}` }).filter({ visible: true }).click();
  const record = page.getByRole("region", { name: "Selected record" });
  // After a return the order is still processing, and the form is available again in a new session.
  await expect(record).toContainText("Returned · correction needed");
  await expect(record.getByText("A doctor returned your result")).toBeVisible();
  await record.getByRole("textbox", { name: "Corrected result" }).fill(correctedResult());
  await record.getByRole("button", { name: "Submit for doctor review" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Submit result" }).click();
  await expect(record.getByText("Result awaiting doctor review")).toBeVisible();
  await expectPatientSeesNoResult(page);
});

test("10. other accounts cannot read or change the request or the result", async () => {
  // Another laboratory: the order is not in its queue, and it cannot start or submit (404).
  expect(JSON.stringify(await call(otherLab.context, "GET", "/api/v1/partner/service-requests?type=LABORATORY"))).not.toContain(requestId);
  expect((await send(otherLab.context, "PATCH", `/api/v1/partner/service-requests/${requestId}/status`, { status: "IN_PROGRESS" })).status()).toBe(404);
  expect((await send(otherLab.context, "POST", `/api/v1/partner/service-requests/${requestId}/lab-result`, { summary: "forged" })).status()).toBe(404);
  // A home-care account cannot submit laboratory results at all.
  expect((await send(homeCare.context, "POST", `/api/v1/partner/service-requests/${requestId}/lab-result`, { summary: "forged" })).status()).toBe(403);
  expect((await send(homeCare.context, "GET", "/api/v1/partner/service-requests?type=LABORATORY")).status()).toBe(403);
  // The laboratory cannot release results or move the request to resolved.
  expect((await send(lab.context, "PATCH", `/api/v1/partner/service-requests/${requestId}/status`, { status: "RESOLVED" })).status()).toBe(409);
  // The patient cannot read the pending result by any route; administrators cannot read results.
  expect((await send(patient.context, "GET", `/api/v1/patients/${patient.id}/lab-results/pending`)).status()).toBe(403);
  for (const context of [admin.context, lab.context]) {
    expect((await send(context, "GET", "/api/v1/patients/me/lab-results")).status()).toBe(403);
    expect((await send(context, "GET", `/api/v1/patients/${patient.id}/lab-results/pending`)).status()).toBe(403);
  }
  // A doctor without a care relationship and consent cannot see or review it.
  const stranger = await seedProvider(baseURL, await adminContext(baseURL), {
    email: `p4f-stranger-${tag}@mednet.test`,
    displayName: `Dr. Stranger ${tag}`,
    specialty: "Dermatology",
    password,
    slots: [],
  });
  const strangerContext = await signedInContext(baseURL, stranger.email, password);
  expect((await send(strangerContext, "GET", `/api/v1/patients/${patient.id}/lab-results/pending`)).status()).toBe(403);
  const anonymous = await playwrightRequest.newContext({ baseURL });
  expect((await anonymous.get("/api/v1/partner/service-requests?type=LABORATORY")).status()).toBe(401);
  await anonymous.dispose();
  // Nothing changed: still processing, still unreleased.
  expect((await call(patient.context, "GET", "/api/v1/lab-requests")).find((r: { id: string }) => r.id === requestId).status).toBe("IN_PROGRESS");
  expect(JSON.stringify(await call(patient.context, "GET", "/api/v1/patients/me/lab-results"))).not.toContain(tag);
});

test("7c–8. the doctor releases the corrected result and the patient sees it", async ({ page }) => {
  const doctorContext = await signedInContext(baseURL, doctor.email, password);
  await as(page, doctorContext);
  await page.goto(`/provider/patients/${patient.id}?tab=results`);
  const item = page.getByRole("list", { name: "Results to review" }).getByRole("listitem").filter({ hasText: correctedResult() });
  await expect(item).toBeVisible();
  await expect(page.getByText(firstResult())).toHaveCount(0);
  await item.getByRole("button", { name: "Release to patient" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Release result" }).click();
  await expect(page.getByText("Result released.")).toBeVisible();
  await doctorContext.dispose();

  await as(page, patient.context);
  await page.goto("/patient/records?tab=laboratory");
  const results = page.getByRole("list", { name: "Laboratory results" });
  await results.getByText("Laboratory result").first().click();
  await expect(results.getByText(correctedResult())).toBeVisible();
  // The returned draft never reaches the patient.
  await expect(page.getByText(firstResult())).toHaveCount(0);
  const released = await call(patient.context, "GET", "/api/v1/patients/me/lab-results");
  expect(released.filter((r: { summary: string }) => r.summary.includes(tag)).map((r: { status: string; summary: string }) => [r.status, r.summary])).toEqual([
    ["RELEASED", correctedResult()],
  ]);
  await expectFitsAndAccessible(page);
});

test("9. after release the laboratory sees both review outcomes, and the order is complete", async ({ page }) => {
  await as(page, lab.context);
  await page.goto("/laboratory/results");
  await expect(page.getByRole("list", { name: "Released to the patient" })).toContainText(`LAB-${reference}`);
  await expect(page.getByRole("list", { name: "Returned by a doctor" })).toContainText(`LAB-${reference}`);
  const own = await call(lab.context, "GET", "/api/v1/partner/lab-results");
  const mine = own.filter((r: { requestId: string }) => r.requestId === requestId);
  expect(mine.map((r: { status: string; summary: string }) => [r.status, r.summary])).toEqual([
    ["RELEASED", correctedResult()],
    ["RETURNED", firstResult()],
  ]);
  expect(JSON.stringify(own)).not.toContain(patient.id);
  // Another laboratory sees none of it; other roles cannot call the endpoint.
  expect(JSON.stringify(await call(otherLab.context, "GET", "/api/v1/partner/lab-results"))).not.toContain(requestId);
  for (const context of [homeCare.context, patient.context, admin.context]) {
    expect((await send(context, "GET", "/api/v1/partner/lab-results")).status()).toBe(403);
  }
  expect((await send(lab.context, "POST", `/api/v1/partner/service-requests/${requestId}/lab-result`, { summary: "late" })).status()).toBe(409);
  await expectFitsAndAccessible(page);
  const queue = await call(admin.context, "GET", "/api/v1/admin/service-requests?type=LABORATORY");
  expect(queue.find((r: { id: string }) => r.id === requestId).status).toBe("RESOLVED");
});

test("an administrator cannot suspend a peer administrator or super administrator", async ({ page }) => {
  const superAdmin = await adminContext(baseURL);
  const peer = await createVerifiedAccount(superAdmin, { email: `p4f-peer-${tag}@mednet.test`, displayName: `Peer ${tag}`, accountType: "PATIENT", password });
  await call(superAdmin, "PUT", `/api/v1/admin/accounts/${peer.id}`, { displayName: `Peer ${tag}`, email: `p4f-peer-${tag}@mednet.test`, accountType: "ADMIN" });
  const superAccount = (await call(superAdmin, "GET", "/api/v1/admin/accounts?accountType=SUPER_ADMIN")).content[0];
  for (const target of [peer.id, superAccount.id]) {
    const response = await send(admin.context, "PATCH", `/api/v1/admin/accounts/${target}/status`, { status: "SUSPENDED" });
    expect([403, 409]).toContain(response.status()); // 409 for the environment-configured administrator
  }
  expect((await send(admin.context, "PATCH", `/api/v1/admin/accounts/${peer.id}/status`, { status: "SUSPENDED" })).status()).toBe(403);
  const after = (await call(superAdmin, "GET", `/api/v1/admin/accounts?search=${encodeURIComponent(`p4f-peer-${tag}`)}`)).content[0];
  expect(after.status).toBe("ACTIVE");
  // The administrator's UI offers no status action on administrator accounts.
  await as(page, admin.context);
  await page.goto("/admin/onboarding?tab=accounts");
  await page.getByRole("searchbox", { name: "Search by name, email or public ID" }).fill(`p4f-peer-${tag}`);
  await page.getByRole("button", { name: "Search" }).click();
  await page.getByRole("button", { name: `Open Peer ${tag}` }).filter({ visible: true }).click();
  const record = page.getByRole("region", { name: "Selected record" });
  await expect(record.getByRole("button", { name: /Suspend|Reactivate/ })).toHaveCount(0);
  await expect(record).toContainText("Only a super administrator can suspend");
  // A super administrator still can.
  expect((await send(superAdmin, "PATCH", `/api/v1/admin/accounts/${peer.id}/status`, { status: "SUSPENDED" })).status()).toBe(200);
});

test("signing out of the laboratory workspace removes the orders", async ({ page }) => {
  const fresh = await signedInContext(baseURL, lab.email, password);
  await as(page, fresh);
  await page.goto("/laboratory/orders");
  await expect(page.getByRole("button", { name: `Open LAB-${reference}` }).filter({ visible: true })).toBeVisible();
  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto("/laboratory/orders");
  await expect(page.getByRole("link", { name: "Go to sign in" })).toBeVisible();
  await expect(page.getByText(testName())).toHaveCount(0);
});
