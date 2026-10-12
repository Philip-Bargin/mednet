import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { adminContext, completePatientProfile, createVerifiedAccount, seedProvider, signedInContext } from "./support/seed-directory";

/**
 * Phase 5D pagination regressions against a running MedNet API (MEDNET_LIVE_API=1, disposable database,
 * synthetic data only). Seeds more than 100 rows through the real endpoints, then checks in the UI and
 * the API that nothing stops at 100, that filters apply to the whole dataset and survive paging, that a
 * provider past the first 100 opens, that the doctor's queue counts every authorized result and drops a
 * patient the moment consent is revoked, and that paged lists keep their role boundaries.
 *
 * Runs in the 1440px project only: seeding 100+ rows per viewport is too heavy for one machine. The
 * Pagination control itself is checked at 390/820/1440 by the mocked suites.
 */
test.describe.configure({ mode: "serial" });

const password = "Phase5d-Live-Pass-1";
const COUNT = 105;
let baseURL = "";
let tag = "";
const contexts = {} as Record<"superAdmin" | "doctor" | "lab" | "otherLab" | "consented" | "small" | "unshared", APIRequestContext>;
let doctorId = "";
let lastProviderId = "";
let lastProviderName = "";
const pad = (n: number) => String(n).padStart(3, "0");

async function csrf(context: APIRequestContext) {
  const token = await (await context.get("/api/v1/auth/csrf")).json();
  return { [token.headerName]: token.token } as Record<string, string>;
}

async function send(context: APIRequestContext, method: "GET" | "POST" | "PATCH" | "DELETE", url: string, data?: unknown) {
  return context.fetch(url, { method, data, headers: method === "GET" ? {} : await csrf(context) });
}

async function call(context: APIRequestContext, method: "GET" | "POST" | "PATCH" | "DELETE", url: string, data?: unknown) {
  const response = await send(context, method, url, data);
  if (!response.ok()) throw new Error(`${method} ${url} → ${response.status()} ${await response.text()}`);
  const text = await response.text();
  return text ? JSON.parse(text) : undefined;
}

async function as(page: Page, context: APIRequestContext) {
  await page.context().clearCookies();
  await page.context().addCookies((await context.storageState()).cookies);
}

/** A care patient of the doctor, optionally sharing records, with `results` laboratory results awaiting review. */
async function carePatient(name: string, slotId: string, consent: boolean, results: number) {
  const email = `p5d-${name.toLowerCase()}-${tag}@mednet.test`;
  await createVerifiedAccount(contexts.superAdmin, { email, displayName: `${name} ${tag}`, accountType: "PATIENT", password });
  const patient = await signedInContext(baseURL, email, password);
  await completePatientProfile(patient, `${name} ${tag}`);
  const appointment = await call(patient, "POST", "/api/v1/appointments", { availabilitySlotId: slotId });
  await call(contexts.doctor, "PATCH", `/api/v1/appointments/${appointment.id}`, { action: "ACCEPT" });
  if (consent) await call(patient, "POST", "/api/v1/patients/me/record-consents", { providerId: doctorId });
  const labId = (await call(contexts.superAdmin, "GET", `/api/v1/admin/accounts?search=${encodeURIComponent(`p5d-lab-${tag}@mednet.test`)}`)).content[0].id;
  for (let i = 0; i < results; i++) {
    const request = await call(patient, "POST", "/api/v1/lab-requests", { testDescription: `Synthetic ${name} test ${pad(i)}` });
    await call(contexts.superAdmin, "PATCH", `/api/v1/admin/service-requests/${request.id}/assignment`, { staffAccountId: labId });
    await call(contexts.lab, "PATCH", `/api/v1/partner/service-requests/${request.id}/status`, { status: "IN_PROGRESS" });
    await call(contexts.lab, "POST", `/api/v1/partner/service-requests/${request.id}/lab-result`, { summary: `Synthetic result ${name} ${pad(i)}` });
  }
  return patient;
}

test.beforeAll(async ({}, testInfo) => {
  if (testInfo.project.name !== "wide") return;
  test.setTimeout(900_000);
  baseURL = String(testInfo.project.use.baseURL);
  tag = Date.now().toString(36);
  contexts.superAdmin = await adminContext(baseURL);

  for (let i = 0; i < COUNT; i++) {
    const seeded = await seedProvider(baseURL, contexts.superAdmin, {
      email: `p5d-provider-${pad(i)}-${tag}@mednet.test`,
      displayName: `Dr. Zz Page ${tag} ${pad(i)}`,
      specialty: i % 2 ? "Pagination medicine" : "Paging surgery",
      password,
      slots: i === COUNT - 1 ? [{ startsAt: new Date(Math.ceil((Date.now() + 40 * 3_600_000) / 60_000) * 60_000), minutes: 30, mode: "TEXT" }] : [],
    });
    lastProviderId = seeded.id;
    lastProviderName = seeded.displayName;
  }

  const doctor = await seedProvider(baseURL, contexts.superAdmin, {
    email: `p5d-doctor-${tag}@mednet.test`,
    displayName: `Dr. Aaa Pager ${tag}`,
    specialty: "General medicine",
    password,
    slots: [0, 1, 2].map((i) => ({ startsAt: new Date(Math.ceil((Date.now() + (30 + i) * 3_600_000) / 60_000) * 60_000), minutes: 30, mode: "TEXT" as const })),
  });
  doctorId = doctor.id;
  contexts.doctor = await signedInContext(baseURL, doctor.email, password);
  await createVerifiedAccount(contexts.superAdmin, { email: `p5d-lab-${tag}@mednet.test`, displayName: `Page Lab ${tag}`, accountType: "LABORATORY", password });
  contexts.lab = await signedInContext(baseURL, `p5d-lab-${tag}@mednet.test`, password);
  await createVerifiedAccount(contexts.superAdmin, { email: `p5d-lab2-${tag}@mednet.test`, displayName: `Other Lab ${tag}`, accountType: "LABORATORY", password });
  contexts.otherLab = await signedInContext(baseURL, `p5d-lab2-${tag}@mednet.test`, password);

  contexts.consented = await carePatient("Consented", doctor.slotIds[0], true, COUNT);
  contexts.small = await carePatient("Small", doctor.slotIds[1], true, 1);
  contexts.unshared = await carePatient("Unshared", doctor.slotIds[2], false, 0);
});

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "wide", "Seeds more than 100 rows; run once at 1440px (Pagination is covered at all widths by mocked suites)");
});

test("a provider past the first 100 opens from a link, with its next open time", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto(`/find-care?provider=${encodeURIComponent(lastProviderId)}`);
  await expect(page.getByRole("dialog")).toContainText(lastProviderName);
  const entry = await (await page.request.get(`/api/v1/providers/${lastProviderId}`)).json();
  expect(entry.nextAvailableAt).not.toBeNull();
});

test("directory search covers every provider and page navigation keeps the search", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto(`/find-care?search=${encodeURIComponent(`Zz Page ${tag}`)}`);
  await expect(page.getByText(`Dr. Zz Page ${tag} 000`)).toBeVisible();
  const directory = await (await page.request.get(`/api/v1/providers?search=${encodeURIComponent(`Zz Page ${tag}`)}&size=12`)).json();
  expect(directory.totalElements).toBe(COUNT);
  await page.getByRole("button", { name: "Next page" }).first().click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page).toHaveURL(new RegExp(`search=${encodeURIComponent(`Zz Page ${tag}`).replaceAll("%20", "(\\+|%20)")}`));
  await expect(page.getByText(`Dr. Zz Page ${tag} 012`)).toBeVisible();
});

test("admin applications: search finds the 105th, totals cover all, paging keeps the filters", async ({ page }) => {
  await as(page, contexts.superAdmin);
  await page.goto("/admin/providers");
  await page.getByLabel("Application status").selectOption("APPROVED");
  await page.getByRole("searchbox", { name: "Search applications" }).fill(`zz page ${tag}`);
  await expect(page.getByText(`${COUNT} applications`)).toBeVisible();
  await page.getByRole("navigation", { name: "Application pages" }).getByRole("button", { name: "Next page" }).click();
  await expect(page.getByText(`${COUNT} applications`)).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search applications" })).toHaveValue(`zz page ${tag}`);
  await expect(page.getByRole("navigation", { name: "Application pages" }).getByRole("button", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
  await page.getByRole("searchbox", { name: "Search applications" }).fill(`zz page ${tag} 000`);
  await expect(page.getByText("1 application", { exact: true })).toBeVisible();
  await expect(page.getByText(`Dr. Zz Page ${tag} 000`)).toBeVisible();
});

test("admin audit: the whole trail is searchable by its readable labels and record type", async ({ page }) => {
  const all = await call(contexts.superAdmin, "GET", "/api/v1/admin/audit?page=0&size=1");
  expect(all.totalElements).toBeGreaterThan(100);
  await as(page, contexts.superAdmin);
  await page.goto("/admin/security");
  await page.getByRole("searchbox", { name: "Search the audit trail" }).fill("Provider application approved");
  const approved = await call(contexts.superAdmin, "GET", "/api/v1/admin/audit?page=0&size=1&search=Provider%20application%20approved&labelAction=provider.approved");
  expect(approved.totalElements).toBeGreaterThanOrEqual(COUNT + 1);
  await expect(page.getByText(`${approved.totalElements} matching events`)).toBeVisible();
  await page.getByRole("navigation", { name: "Audit trail pages" }).getByRole("button", { name: "Next page" }).click();
  await expect(page.getByText(`${approved.totalElements} matching events`)).toBeVisible();
  await expect(page.getByRole("table").getByText("Provider application approved").first()).toBeVisible();
});

test("admin laboratory queue: every open request is reachable and the status filter holds across pages", async ({ page }) => {
  const open = await call(contexts.superAdmin, "GET", "/api/v1/admin/service-requests?type=LABORATORY&status=OPEN&status=IN_PROGRESS&page=0&size=25");
  expect(open.totalElements).toBeGreaterThanOrEqual(COUNT + 1);
  await as(page, contexts.superAdmin);
  await page.goto("/admin/tasks");
  await page.getByRole("tab", { name: "Laboratory requests" }).click();
  const pages = page.getByRole("navigation", { name: "laboratory request pages" });
  await expect(pages).toBeVisible();
  await pages.getByRole("button", { name: "Next page" }).click();
  await expect(pages.getByRole("button", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
  const panel = page.getByRole("tabpanel", { name: "Laboratory requests" });
  await expect(panel.getByLabel("Request status")).toHaveValue("open");
  // Every row on page 2 still matches the filter.
  for (const badge of await panel.getByRole("list").getByText(/Resolved|Cancelled/).all()) await expect(badge).toBeHidden();
});

test("laboratory results count every submission and page within the laboratory's own work", async ({ page }) => {
  const pending = await call(contexts.lab, "GET", "/api/v1/partner/lab-results?status=PENDING_REVIEW&page=0&size=10");
  expect(pending.totalElements).toBe(COUNT + 1);
  expect((await call(contexts.otherLab, "GET", "/api/v1/partner/lab-results?page=0")).totalElements).toBe(0);
  await as(page, contexts.lab);
  await page.goto("/laboratory/results");
  const card = page.getByRole("navigation", { name: "Awaiting doctor review: pages" });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Next page" }).click();
  await expect(card.getByRole("button", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("list", { name: "Awaiting doctor review" }).getByRole("listitem")).toHaveCount(10);
});

test("the doctor's queue counts every authorized result and drops a patient as soon as consent is revoked", async ({ page }) => {
  await as(page, contexts.doctor);
  await page.goto("/provider/clinical-work");
  await expect(page.getByText(`${COUNT + 1} results`).first()).toBeVisible();
  await expect(page.getByRole("list", { name: "Patients without record access" })).toContainText(`Unshared ${tag}`);
  await call(contexts.consented, "DELETE", `/api/v1/patients/me/record-consents/${doctorId}`);
  await page.reload();
  await expect(page.getByText("1 result", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("list", { name: "Patients without record access" })).toContainText(`Consented ${tag}`);
  const queue = await call(contexts.doctor, "GET", "/api/v1/providers/me/lab-review-queue?page=0&size=20");
  expect(queue.totalPendingResults).toBe(1);
  expect(JSON.stringify(queue)).not.toContain("Synthetic result");
  const consentedId = queue.content.find((entry: { patientName: string }) => entry.patientName === `Consented ${tag}`).patientAccountId;
  expect((await send(contexts.doctor, "GET", `/api/v1/patients/${consentedId}/lab-results/pending`)).status()).toBe(403);
});

test("paged lists keep their role boundaries", async () => {
  const forbidden: Array<[APIRequestContext, string]> = [
    [contexts.consented, "/api/v1/partner/lab-results?page=0"],
    [contexts.lab, "/api/v1/patients/me/lab-results?page=0"],
    [contexts.lab, "/api/v1/providers/me/lab-review-queue"],
    [contexts.lab, "/api/v1/admin/service-requests?type=LABORATORY&page=0"],
    [contexts.doctor, "/api/v1/admin/audit?page=0"],
    [contexts.consented, "/api/v1/admin/providers?page=0"],
  ];
  for (const [context, url] of forbidden) expect((await send(context, "GET", url)).status(), url).toBe(403);
  const anonymous = await (await import("@playwright/test")).request.newContext({ baseURL });
  for (const url of ["/api/v1/providers/me/lab-review-queue", "/api/v1/admin/audit?page=0", "/api/v1/partner/lab-results?page=0"]) {
    expect((await anonymous.get(url)).status(), url).toBe(401);
  }
  await anonymous.dispose();
  const released = await call(contexts.small, "GET", "/api/v1/patients/me/lab-results?page=0&size=10");
  expect(released.totalElements).toBe(0);
});
