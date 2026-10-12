import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import {
  adminContext,
  completePatientProfile,
  createVerifiedAccount,
  seedProvider,
  signedInContext,
  type SeededProvider,
} from "./support/seed-directory";

/**
 * Doctor workspace and the patient–provider workflows (Phase 4D) against a running MedNet API, no
 * mocks. Run with MEDNET_LIVE_API=1 (see e2e/README.md). Synthetic accounts only; each viewport project
 * seeds its own provider and patients. The provider acts through the UI; the patient side alternates
 * between the patient workspace UI and the patient's own API session, and every result is checked
 * from both sides.
 */
test.describe.configure({ mode: "serial" });

const password = "Phase4d-Live-Pass-1";
let baseURL = "";
let tag = "";
let doctor: SeededProvider;
let patientA = { email: "", name: "", context: null as unknown as APIRequestContext, accountId: "" };
let patientB = { email: "", name: "", context: null as unknown as APIRequestContext };
let pendingProviderEmail = "";

const hoursFromNow = (hours: number) => new Date(Math.ceil((Date.now() + hours * 3_600_000) / 60_000) * 60_000);

async function csrf(context: APIRequestContext) {
  const token = await (await context.get("/api/v1/auth/csrf")).json();
  return { [token.headerName]: token.token } as Record<string, string>;
}

async function call(context: APIRequestContext, method: "get" | "post" | "patch", url: string, data?: unknown) {
  const response = method === "get" ? await context.get(url) : await context[method](url, { data, headers: await csrf(context) });
  if (!response.ok()) throw new Error(`${method.toUpperCase()} ${url} → ${response.status()} ${await response.text()}`);
  const text = await response.text();
  return text ? JSON.parse(text) : undefined;
}

async function status(context: APIRequestContext, method: "get" | "post", url: string, data?: unknown) {
  return (method === "get" ? await context.get(url) : await context.post(url, { data, headers: await csrf(context) })).status();
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

const appointmentsOf = async (context: APIRequestContext) =>
  (await call(context, "get", "/api/v1/appointments?page=0&size=50")).content as Array<Record<string, string | null>>;

test.beforeAll(async ({}, testInfo) => {
  baseURL = String(testInfo.project.use.baseURL);
  tag = `${testInfo.project.name}${Date.now().toString(36)}`;
  const admin = await adminContext(baseURL);
  doctor = await seedProvider(baseURL, admin, {
    email: `p4d-doc-${tag}@mednet.test`,
    displayName: `Dr. Mariama Cole ${tag}`,
    specialty: "General medicine",
    password,
    slots: [
      { startsAt: hoursFromNow(30), minutes: 30, mode: "TEXT" },
      { startsAt: hoursFromNow(31), minutes: 30, mode: "TEXT" },
      { startsAt: hoursFromNow(32), minutes: 30, mode: "IN_PERSON" },
      { startsAt: hoursFromNow(54), minutes: 30, mode: "TEXT" },
    ],
  });
  patientA = { ...patientA, email: `p4d-a-${tag}@mednet.test`, name: `Ama Patient ${tag}` };
  patientB = { ...patientB, email: `p4d-b-${tag}@mednet.test`, name: `Ben Patient ${tag}` };
  for (const p of [patientA, patientB]) {
    await createVerifiedAccount(admin, { email: p.email, displayName: p.name, accountType: "PATIENT", password });
    p.context = await signedInContext(baseURL, p.email, password);
    await completePatientProfile(p.context, p.name);
  }
  // A provider account whose application is still pending review.
  pendingProviderEmail = `p4d-pending-${tag}@mednet.test`;
  await createVerifiedAccount(admin, { email: pendingProviderEmail, displayName: "Pending Doctor", accountType: "PROVIDER", password });
  const pending = await signedInContext(baseURL, pendingProviderEmail, password);
  await call(pending, "post", "/api/v1/providers/applications", { displayName: `Dr. Pending ${tag}`, specialty: "Dermatology", credentialReference: "LIVE-PENDING" });
  await pending.dispose();
  await admin.dispose();
});

test.afterAll(async () => {
  await patientA.context?.dispose();
  await patientB.context?.dispose();
});

test("provider sign-in lands in the doctor workspace", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("textbox", { name: "Email address" }).fill(doctor.email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/provider$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(new RegExp(`^Good (morning|afternoon|evening), Dr\\. ${tag}$`));
  await page.goto("/account");
  await expect(page).toHaveURL(/\/provider$/);
  await expectFitsAndAccessible(page);
});

test("1–2. patient requests in the workspace; the provider receives the request", async ({ page }) => {
  await as(page, patientA.context);
  await page.goto(`/patient/find-a-doctor?provider=${doctor.id}`);
  const drawer = page.getByRole("dialog", { name: `Open times · ${doctor.displayName}` });
  await drawer.getByRole("radio").first().check();
  await drawer.getByRole("button", { name: "Send appointment request" }).click();
  await expect(drawer.getByText("Request sent")).toBeVisible();
  await call(patientA.context, "post", "/api/v1/appointments", { availabilitySlotId: doctor.slotIds[1] });
  await call(patientB.context, "post", "/api/v1/appointments", { availabilitySlotId: doctor.slotIds[2] });
  const mine = await appointmentsOf(patientA.context);
  patientA.accountId = mine[0].patientAccountId!;
  expect(mine.every((a) => a.providerId === doctor.id && a.providerSpecialty === "General medicine")).toBe(true);

  const provider = await signedInContext(baseURL, doctor.email, password);
  await as(page, provider);
  await page.goto("/provider/appointments");
  await expect(page.getByRole("list", { name: "Requests to answer" }).getByRole("listitem")).toHaveCount(3);
  await expect(page.getByRole("tab", { name: "Requests (3)" })).toBeVisible();
  await expectFitsAndAccessible(page);
  await provider.dispose();
});

test("3–5. provider confirms, declines and proposes; patient responds; both sides agree", async ({ page }) => {
  const provider = await signedInContext(baseURL, doctor.email, password);
  await as(page, provider);
  await page.goto("/provider/appointments");
  const [first, second] = (await appointmentsOf(patientA.context)).sort((a, b) => a.startsAt!.localeCompare(b.startsAt!));

  await page.locator(`#appointment-${first.id}`).getByRole("button", { name: /^Confirm request/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm appointment" }).click();
  await expect(page.getByText("Appointment confirmed. The patient has been notified.")).toBeVisible();
  await page.locator(`#appointment-${second.id}`).getByRole("button", { name: /^Decline request/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Decline request" }).click();
  await expect(page.getByText("Request declined. The time is open again.")).toBeVisible();
  const a = Object.fromEntries((await appointmentsOf(patientA.context)).map((x) => [x.id, x.status]));
  expect(a).toMatchObject({ [first.id!]: "CONFIRMED", [second.id!]: "DECLINED" });

  // Propose a new time (the provider's last open slot).
  await page.getByRole("tab", { name: "Upcoming" }).click();
  await page.getByRole("button", { name: `Propose a new time to ${patientA.name}` }).click();
  const dialog = page.getByRole("dialog", { name: "Propose a new time" });
  await dialog.getByRole("radio", { name: /Text consultation/ }).last().check();
  await dialog.getByRole("button", { name: "Propose this time" }).click();
  await expect(page.getByText("Waiting for the patient to accept or decline.")).toBeVisible();
  const proposed = await call(patientA.context, "get", `/api/v1/appointments/${first.id}`);
  expect(proposed).toMatchObject({ status: "RESCHEDULE_REQUESTED", rescheduleRequestedBy: "PROVIDER" });

  // The patient sees it in their workspace and accepts.
  await as(page, patientA.context);
  await page.goto("/patient/appointments");
  await expect(page.getByText("A new time was proposed")).toBeVisible();
  await page.getByRole("button", { name: "Accept new time" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Accept new time" }).click();
  await expect(page.getByText("New time accepted.")).toBeVisible();

  // Both sides show the same state.
  const fromPatient = await call(patientA.context, "get", `/api/v1/appointments/${first.id}`);
  const fromProvider = await call(provider, "get", `/api/v1/appointments/${first.id}`);
  expect(fromPatient).toMatchObject({ status: "CONFIRMED", startsAt: proposed.proposedStartsAt, rescheduleRequestedBy: null });
  expect(fromProvider.status).toBe(fromPatient.status);
  expect(fromProvider.startsAt).toBe(fromPatient.startsAt);
  await as(page, provider);
  await page.goto("/provider/appointments?tab=upcoming");
  await expect(page.locator(`#appointment-${first.id}`)).toContainText("Confirmed");
  await provider.dispose();
});

test("6. provider opens a text consultation; patient joins and replies; provider ends it", async ({ page }) => {
  const provider = await signedInContext(baseURL, doctor.email, password);
  const confirmed = (await appointmentsOf(patientA.context)).find((x) => x.status === "CONFIRMED")!;
  await as(page, provider);
  await page.goto(`/provider/appointments/consultation?appointment=${confirmed.id}`);
  await page.getByRole("button", { name: "Open text consultation" }).click();
  await page.getByLabel("Your message").fill("Good morning. How are you feeling today?");
  await page.getByRole("button", { name: "Send message" }).click();
  const thread = page.getByRole("list", { name: "Consultation messages" });
  await expect(thread).toContainText("How are you feeling today?");

  // The patient joins the same consultation from their workspace and replies.
  await as(page, patientA.context);
  await page.goto(`/patient/appointments/consultation?appointment=${confirmed.id}`);
  await page.getByRole("button", { name: "Join text consultation" }).click();
  await expect(page.getByRole("list", { name: "Consultation messages" })).toContainText("How are you feeling today?");
  await page.getByLabel("Your message").fill("Much better, thank you.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("list", { name: "Consultation messages" })).toContainText("Much better, thank you.");
  const consultationId = new URL(page.url()).searchParams.get("consultation")!;

  // Patient B cannot read it.
  expect(await status(patientB.context, "get", `/api/v1/consultations/${consultationId}/messages`)).toBe(404);

  await as(page, provider);
  await page.goto(`/provider/appointments/consultation?consultation=${consultationId}`);
  await expect(thread).toContainText("Much better, thank you.");
  await page.getByRole("button", { name: "End consultation" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "End consultation" }).click();
  await expect(page.getByText("This consultation has ended and can no longer receive messages.")).toBeVisible();
  expect(await status(patientA.context, "post", `/api/v1/consultations/${consultationId}/messages`, { body: "One more thing" })).toBe(409);
  await provider.dispose();
});

test("7. record access follows the patient's consent", async ({ page }) => {
  const provider = await signedInContext(baseURL, doctor.email, password);
  await as(page, provider);
  await page.goto(`/provider/patients/${patientA.accountId}`);
  await expect(page.getByText("The patient has not allowed you to see their records")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add record" })).toHaveCount(0);

  await call(patientA.context, "post", "/api/v1/patients/me/record-consents", { providerId: doctor.id });
  await page.reload();
  await page.getByLabel(/^Title/).fill(`Consultation summary ${tag}`);
  await page.getByLabel(/^Clinical note/).fill("Reported improvement. No changes to the plan.");
  await page.getByRole("button", { name: "Add record" }).click();
  await expect(page.getByText("Record added to the patient’s file.")).toBeVisible();
  const records = await call(patientA.context, "get", "/api/v1/patients/me/records");
  expect(records.content[0]).toMatchObject({ title: `Consultation summary ${tag}`, authorName: doctor.displayName });
  await expectFitsAndAccessible(page);

  // Patient B only has a pending request: no care relationship, so no records, and the list does not open them.
  const patientBId = (await appointmentsOf(patientB.context))[0].patientAccountId;
  expect(await status(provider, "get", `/api/v1/patients/${patientBId}/records`)).toBe(403);
  await page.goto("/provider/patients");
  await expect(page.getByRole("link", { name: `Open ${patientB.name}` })).toHaveCount(0);

  // Withdrawing consent closes access again.
  const revoke = await patientA.context.delete(`/api/v1/patients/me/record-consents/${doctor.id}`, { headers: await csrf(patientA.context) });
  expect(revoke.ok()).toBe(true);
  expect(await status(provider, "get", `/api/v1/patients/${patientA.accountId}/records`)).toBe(403);
  await provider.dispose();
});

test("8. messaging is limited to care relationships", async ({ page }) => {
  expect(await status(patientB.context, "post", "/api/v1/conversations", { providerId: doctor.id })).toBe(403);
  const conversation = await call(patientA.context, "post", "/api/v1/conversations", { providerId: doctor.id });
  await call(patientA.context, "post", `/api/v1/conversations/${conversation.id}/messages`, { body: "Is the next visit still on?" });

  const provider = await signedInContext(baseURL, doctor.email, password);
  await as(page, provider);
  await page.goto(`/provider/messages?conversation=${conversation.id}`);
  await expect(page.getByRole("list", { name: `Messages with ${patientA.name}` })).toContainText("Is the next visit still on?");
  await page.getByLabel("Your message").fill("Yes, it is confirmed.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("list", { name: `Messages with ${patientA.name}` })).toContainText("Yes, it is confirmed.");
  const seen = await call(patientA.context, "get", `/api/v1/conversations/${conversation.id}/messages`);
  expect(seen.content.map((m: { body: string }) => m.body)).toEqual(["Is the next visit still on?", "Yes, it is confirmed."]);
  expect(await status(patientB.context, "get", `/api/v1/conversations/${conversation.id}/messages`)).toBe(404);
  await provider.dispose();
});

test("availability: publish, reject overlap, close; the public directory follows", async ({ page }) => {
  const provider = await signedInContext(baseURL, doctor.email, password);
  await as(page, provider);
  await page.goto("/provider/schedule");
  const day = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
  await page.getByLabel(/^Date/).fill(day);
  await page.getByLabel(/^Start time/).fill("10:00");
  await page.getByRole("button", { name: "Publish time" }).click();
  await expect(page.getByText(/^Published /)).toBeVisible();
  const open = async () => (await call(patientA.context, "get", `/api/v1/providers/${doctor.id}/availability?size=100`)).content as Array<{ id: string; startsAt: string }>;
  expect((await open()).map((s) => s.startsAt)).toContain(`${day}T10:00:00Z`);

  await page.getByLabel(/^Start time/).fill("10:15");
  await page.getByRole("button", { name: "Publish time" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Availability slots may not overlap" })).toBeVisible();

  await page.getByRole("button", { name: new RegExp(`^Close .*10:00 AM`) }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Close time" }).click();
  await expect(page.getByText(/^Closed /)).toBeVisible();
  expect((await open()).map((s) => s.startsAt)).not.toContain(`${day}T10:00:00Z`);
  await expectFitsAndAccessible(page);
  await provider.dispose();
});

test("a pending application sees its status only; other providers cannot read this provider's data", async ({ page }) => {
  const pending = await signedInContext(baseURL, pendingProviderEmail, password);
  await as(page, pending);
  // The backend signs applicants in with the PATIENT role until approval; /provider shows the status.
  expect((await call(pending, "get", "/api/v1/auth/session")).role).toBe("PATIENT");
  await page.goto("/provider/schedule");
  await expect(page.getByText("Under review", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish time" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Doctor workspace" })).toHaveCount(0);
  const confirmed = (await appointmentsOf(patientA.context)).find((x) => x.status === "CONFIRMED")!;
  // Refused either way: 403 (provider account type with the patient role) or 404 (not a participant).
  expect([403, 404]).toContain(await status(pending, "get", `/api/v1/appointments/${confirmed.id}`));
  expect(await status(pending, "get", `/api/v1/patients/${patientA.accountId}/records`)).toBeGreaterThanOrEqual(403);
  await expectFitsAndAccessible(page);
  await pending.dispose();
});
