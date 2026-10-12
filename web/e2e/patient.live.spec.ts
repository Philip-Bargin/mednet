import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { adminContext, createVerifiedAccount, seedProvider, signedInContext, type SeededProvider } from "./support/seed-directory";

/**
 * Patient workspace (Phase 4C) against a running MedNet API, no mocks. Run with MEDNET_LIVE_API=1
 * (see e2e/README.md). The patient acts through the UI; the provider's side (confirming, proposing
 * a new time, adding a record, replying) goes through the provider's own API session, and every
 * patient action is checked back against the API.
 */
test.describe.configure({ mode: "serial" });

const password = "Phase4c-Live-Pass-1";
let baseURL = "";
let tag = "";
let doctor: SeededProvider;
let other: SeededProvider;
let patientEmail = "";
let patient: APIRequestContext;

const hoursFromNow = (hours: number) => new Date(Math.ceil((Date.now() + hours * 3_600_000) / 60_000) * 60_000);

async function csrf(context: APIRequestContext) {
  const token = await (await context.get("/api/v1/auth/csrf")).json();
  return { [token.headerName]: token.token } as Record<string, string>;
}

async function call(context: APIRequestContext, method: "get" | "post" | "patch", url: string, data?: unknown) {
  const response =
    method === "get" ? await context.get(url) : await context[method](url, { data, headers: await csrf(context) });
  if (!response.ok()) throw new Error(`${method.toUpperCase()} ${url} → ${response.status()} ${await response.text()}`);
  const text = await response.text();
  return text ? JSON.parse(text) : undefined;
}

async function asPatient(page: Page) {
  await page.context().addCookies((await patient.storageState()).cookies);
}

async function expectFitsAndAccessible(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .exclude("nextjs-portal")
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
}

test.beforeAll(async ({}, testInfo) => {
  baseURL = String(testInfo.project.use.baseURL);
  tag = `${testInfo.project.name}${Date.now().toString(36)}`;
  const admin = await adminContext(baseURL);
  doctor = await seedProvider(baseURL, admin, {
    email: `p4c-doc-${tag}@mednet.test`,
    displayName: `Dr. Mariama Cole ${tag}`,
    specialty: "General medicine",
    password,
    slots: [
      { startsAt: hoursFromNow(30), minutes: 30, mode: "TEXT" },
      { startsAt: hoursFromNow(31), minutes: 30, mode: "IN_PERSON" },
      { startsAt: hoursFromNow(54), minutes: 30, mode: "TEXT" },
    ],
  });
  other = await seedProvider(baseURL, admin, {
    email: `p4c-other-${tag}@mednet.test`,
    displayName: `Dr. Joseph Tarr ${tag}`,
    specialty: "Pediatrics",
    password,
    slots: [{ startsAt: hoursFromNow(40), minutes: 30, mode: "TEXT" }],
  });
  patientEmail = `p4c-patient-${tag}@mednet.test`;
  await createVerifiedAccount(admin, { email: patientEmail, displayName: "Live Patient", accountType: "PATIENT", password });
  await admin.dispose();
  patient = await signedInContext(baseURL, patientEmail, password);
});

test.afterAll(async () => {
  await patient?.dispose();
});

test("sign-in lands in the workspace, which asks for the profile first", async ({ page }) => {
  await page.goto("/patient/records?tab=vitals");
  await page.getByRole("link", { name: "Go to sign in" }).click();
  await page.getByRole("textbox", { name: "Email address" }).fill(patientEmail);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/patient\/records\?tab=vitals$/);

  await page.getByRole("link", { name: "Overview" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^Good (morning|afternoon|evening)$/);
  await expect(page.getByRole("heading", { name: "No upcoming appointments", exact: true })).toBeVisible();
  await page.getByRole("link", { name: /Complete your patient profile/ }).click();

  await page.getByLabel("Full name").fill("Ama Live-Patient");
  await page.getByLabel("Date of birth").fill("1991-03-09");
  await page.getByLabel("Phone number").fill("+231 770 123 456");
  await page.getByLabel("Address").fill("Sinkor, Monrovia");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Your profile was saved.")).toBeVisible();
  expect(await call(patient, "get", "/api/v1/patients/me/profile")).toMatchObject({ fullName: "Ama Live-Patient", dateOfBirth: "1991-03-09" });
  await expectFitsAndAccessible(page);
});

test("book from the workspace directory and see it on the overview", async ({ page }) => {
  await asPatient(page);
  await page.goto(`/patient/find-a-doctor?provider=${doctor.id}`);
  const drawer = page.getByRole("dialog", { name: `Open times · ${doctor.displayName}` });
  await drawer.getByRole("radio").first().check();
  await drawer.getByRole("button", { name: "Send appointment request" }).click();
  await expect(drawer.getByText("Request sent")).toBeVisible();
  // A second request with the same doctor, used for the cancel flow.
  await call(patient, "post", "/api/v1/appointments", { availabilitySlotId: doctor.slotIds[1] });

  const list = await call(patient, "get", "/api/v1/appointments?page=0&size=10");
  expect(list.content.map((item: { status: string }) => item.status)).toEqual(["PENDING", "PENDING"]);

  await page.goto("/patient");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/, Ama$/);
  const next = page.locator("section").filter({ has: page.getByText("Next appointment", { exact: true }) });
  await expect(next).toContainText(doctor.displayName);
  await expect(next).toContainText("Pending");
  await expect(next).toContainText("Text consultation");
});

test("confirmations and proposed times from the doctor can be answered", async ({ page }) => {
  const provider = await signedInContext(baseURL, doctor.email, password);
  const mine = (await call(patient, "get", "/api/v1/appointments?page=0&size=10")).content as Array<{ id: string; startsAt: string }>;
  const first = mine.sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  await call(provider, "patch", `/api/v1/appointments/${first.id}`, { action: "ACCEPT" });
  await call(provider, "patch", `/api/v1/appointments/${first.id}`, { action: "REQUEST_RESCHEDULE", proposedAvailabilitySlotId: doctor.slotIds[2] });
  await provider.dispose();

  await asPatient(page);
  await page.goto("/patient");
  await page.getByRole("link", { name: /Review a proposed new time/ }).click();
  await expect(page.getByText("A new time was proposed")).toBeVisible();
  await expectFitsAndAccessible(page);
  await page.getByRole("button", { name: "Accept new time" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Accept new time" }).click();
  await expect(page.getByText("New time accepted.")).toBeVisible();

  const updated = await call(patient, "get", `/api/v1/appointments/${first.id}`);
  expect(updated.status).toBe("CONFIRMED");
  const slot = (await call(patient, "get", `/api/v1/providers/${doctor.id}/availability?size=50`)).content as Array<{ id: string }>;
  expect(slot.map((item) => item.id)).not.toContain(doctor.slotIds[2]);
});

test("a pending request can be cancelled", async ({ page }) => {
  await asPatient(page);
  await page.goto("/patient/appointments");
  const pending = page.locator("li", { hasText: "Waiting for the doctor to confirm." });
  await pending.getByRole("button", { name: `Cancel appointment with ${doctor.displayName}` }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel appointment" }).click();
  await expect(page.getByText("Appointment cancelled.", { exact: false })).toBeVisible();
  const statuses = (await call(patient, "get", "/api/v1/appointments?page=0&size=10")).content.map((item: { status: string }) => item.status);
  expect(statuses.sort()).toEqual(["CANCELLED", "CONFIRMED"]);
});

test("record sharing lists only the care team and grants consent", async ({ page }) => {
  await asPatient(page);
  await page.goto("/patient/records?tab=sharing");
  await expect(page.getByText(doctor.displayName)).toBeVisible();
  await expect(page.getByText(other.displayName)).toHaveCount(0);
  await page.getByRole("button", { name: `Allow ${doctor.displayName} to see your records` }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Allow access" }).click();
  await expect(page.getByText(`${doctor.displayName} can now see your records.`)).toBeVisible();
  expect(await call(patient, "get", "/api/v1/patients/me/record-consents")).toEqual([
    expect.objectContaining({ providerId: doctor.id, status: "GRANTED" }),
  ]);

  // With consent and a confirmed appointment the doctor can add a record; the patient sees it.
  const provider = await signedInContext(baseURL, doctor.email, password);
  const patientAccountId = (await call(patient, "get", "/api/v1/appointments?page=0&size=1")).content[0].patientAccountId;
  await call(provider, "post", `/api/v1/patients/${patientAccountId}/records`, {
    category: "ENCOUNTER_SUMMARY",
    title: `Live visit summary ${tag}`,
    summary: "Discussed symptoms. Follow up in two weeks.",
    effectiveAt: new Date().toISOString(),
  });
  await provider.dispose();
  await page.getByRole("tab", { name: "Records" }).click();
  await page.getByText(`Live visit summary ${tag}`).click();
  await expect(page.getByText("Discussed symptoms. Follow up in two weeks.")).toBeVisible();
  await expectFitsAndAccessible(page);
});

test("messages reach the doctor and replies appear on refresh", async ({ page }) => {
  await asPatient(page);
  await page.goto("/patient/messages");
  await page.getByLabel("Doctor").selectOption({ label: `${doctor.displayName} · General medicine` });
  await page.getByRole("button", { name: "Start conversation" }).click();
  await expect(page).toHaveURL(/\/patient\/messages\?conversation=/);
  await page.getByLabel("Your message").fill("Thank you, doctor. I feel better.");
  await page.getByRole("button", { name: "Send message" }).click();
  const thread = page.getByRole("list", { name: `Messages with ${doctor.displayName}` });
  await expect(thread).toContainText("Thank you, doctor. I feel better.");

  const provider = await signedInContext(baseURL, doctor.email, password);
  const [conversation] = await call(provider, "get", "/api/v1/conversations");
  const seen = await call(provider, "get", `/api/v1/conversations/${conversation.id}/messages`);
  expect(seen.content.map((message: { body: string }) => message.body)).toEqual(["Thank you, doctor. I feel better."]);
  await call(provider, "post", `/api/v1/conversations/${conversation.id}/messages`, { body: "Glad to hear it." });
  await provider.dispose();

  await page.getByRole("button", { name: "Refresh" }).click();
  await expect(thread).toContainText("Glad to hear it.");
  await expectFitsAndAccessible(page);
});

test("laboratory and home-care requests, medications and vitals are saved", async ({ page }) => {
  await asPatient(page);
  await page.goto("/patient/records?tab=laboratory");
  await page.getByLabel("Test needed").fill("Malaria rapid test");
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText("Request sent.")).toBeVisible();
  expect(await call(patient, "get", "/api/v1/lab-requests")).toEqual([
    expect.objectContaining({ requestedService: "Malaria rapid test", status: "OPEN" }),
  ]);

  await page.getByRole("tab", { name: "Medications" }).click();
  await page.getByLabel("Medicine").fill("Paracetamol");
  await page.getByLabel(/^Dose/).fill("500 mg");
  await page.getByRole("button", { name: "Add reminder" }).click();
  await expect(page.getByText("Reminder for Paracetamol added.")).toBeVisible();
  const [medication] = await call(patient, "get", "/api/v1/patients/me/medications");
  expect(medication).toMatchObject({ medicationName: "Paracetamol", dose: "500 mg", timeZone: "Africa/Monrovia", status: "ACTIVE" });

  await page.getByRole("tab", { name: "Vitals" }).click();
  await page.getByLabel("Measurement").fill("Weight");
  await page.getByLabel("Value").fill("72.5");
  await page.getByLabel("Unit").fill("kg");
  await page.getByRole("button", { name: "Save reading" }).click();
  await expect(page.getByText("Weight reading saved.")).toBeVisible();
  const vitals = await call(patient, "get", "/api/v1/patients/me/vitals");
  expect(vitals.content[0]).toMatchObject({ metric: "Weight", value: 72.5, unit: "kg", source: "PATIENT_REPORTED" });

  await page.goto("/patient/appointments?tab=home-care");
  await page.getByLabel("Care needed").fill("Wound dressing");
  await page.getByLabel("Visit location").fill("Sinkor, near the market");
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText("Request sent.")).toBeVisible();
  await page.getByRole("button", { name: "Cancel request: Wound dressing" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel request" }).click();
  await expect(page.getByText("Request cancelled.")).toBeVisible();
  expect((await call(patient, "get", "/api/v1/home-care-requests"))[0]).toMatchObject({ status: "CANCELLED" });
});

test("notifications can be marked as read", async ({ page }) => {
  const before = await call(patient, "get", "/api/v1/notifications/unread-count");
  expect(before).toBeGreaterThan(0);
  await asPatient(page);
  await page.goto("/patient");
  const updates = page.locator("section", { hasText: "Notifications" });
  await updates.getByRole("button", { name: "Mark as read" }).first().click();
  await expect.poll(() => call(patient, "get", "/api/v1/notifications/unread-count")).toBe(before - 1);
  await expectFitsAndAccessible(page);
});

test("appointment details and a text consultation with the doctor", async ({ page }) => {
  await asPatient(page);
  await page.goto("/patient/appointments");
  await page.getByRole("button", { name: `Details of appointment with ${doctor.displayName}` }).first().click();
  const drawer = page.getByRole("dialog", { name: "Appointment details" });
  await expect(drawer).toContainText("The doctor confirmed this appointment.");
  await drawer.getByRole("link", { name: "Text consultation" }).click();
  await page.getByRole("button", { name: "Join text consultation" }).click();
  await expect(page).toHaveURL(/consultation\?consultation=/);
  await page.getByLabel("Your message").fill("Hello doctor, I have joined.");
  await page.getByRole("button", { name: "Send message" }).click();
  const thread = page.getByRole("list", { name: "Consultation messages" });
  await expect(thread).toContainText("Hello doctor, I have joined.");

  // The doctor sees the same consultation (opening again is idempotent) and replies.
  const provider = await signedInContext(baseURL, doctor.email, password);
  const confirmed = (await call(patient, "get", "/api/v1/appointments?page=0&size=10")).content.find(
    (item: { status: string }) => item.status === "CONFIRMED",
  );
  const consultation = await call(provider, "post", `/api/v1/appointments/${confirmed.id}/consultation`);
  expect(page.url()).toContain(consultation.id);
  const seen = await call(provider, "get", `/api/v1/consultations/${consultation.id}/messages`);
  expect(seen.content.map((message: { body: string }) => message.body)).toEqual(["Hello doctor, I have joined."]);
  await call(provider, "post", `/api/v1/consultations/${consultation.id}/messages`, { body: "Welcome. How are you today?" });
  await provider.dispose();
  await page.getByRole("button", { name: "Refresh" }).click();
  await expect(thread).toContainText("Welcome. How are you today?");
  await expectFitsAndAccessible(page);
});

test("a session ended elsewhere hides the workspace", async ({ page }) => {
  const session = await signedInContext(baseURL, patientEmail, password);
  await page.context().addCookies((await session.storageState()).cookies);
  await page.goto("/patient/records");
  await expect(page.getByText(`Live visit summary ${tag}`)).toBeVisible();
  await call(session, "post", "/api/v1/auth/logout");
  await session.dispose();
  await page.getByRole("tab", { name: "Vitals" }).click();
  await expect(page.getByText("Your session has ended", { exact: true })).toBeVisible();
  await expect(page.getByText(`Live visit summary ${tag}`)).toHaveCount(0);
});

test("a provider account is sent away from the patient workspace", async ({ page }) => {
  const provider = await signedInContext(baseURL, other.email, password);
  await page.context().addCookies((await provider.storageState()).cookies);
  await page.goto("/patient");
  await expect(page).toHaveURL(/\/provider$/);
  // The API refuses patient data to a provider regardless of the page.
  expect((await provider.get("/api/v1/patients/me/profile")).status()).toBe(403);
  await provider.dispose();
});
