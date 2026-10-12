import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import {
  adminContext,
  completePatientProfile,
  createVerifiedAccount,
  requestAppointmentAs,
  seedProvider,
  signedInContext,
  type SeededProvider,
} from "./support/seed-directory";

/**
 * Homepage directory sections and /find-care against a running MedNet API (no mocks).
 * Run with MEDNET_LIVE_API=1 (see e2e/README.md). Data is created through the real admin and
 * provider endpoints; each viewport project seeds its own providers and patients.
 */
test.describe.configure({ mode: "serial" });

const password = "Phase4b-Live-Pass-1";
let baseURL = "";
let tag = "";
let providers: SeededProvider[] = [];
let patientEmail = "";
let secondPatientEmail = "";
let providerAccountEmail = "";

const hoursFromNow = (hours: number) => new Date(Math.ceil((Date.now() + hours * 3_600_000) / 60_000) * 60_000);
/**
 * Tomorrow at `hour`:00 Liberia time (GMT). "now + 26 hours" fell two calendar days ahead when the suite ran
 * after 22:00 GMT, so the "Tomorrow" label check failed late in the evening (found in Phase 5D).
 */
const tomorrowAt = (hour: number) => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, hour));
};

test.beforeAll(async ({}, testInfo) => {
  baseURL = String(testInfo.project.use.baseURL);
  tag = `${testInfo.project.name}${Date.now().toString(36)}`;
  const admin = await adminContext(baseURL);
  providers = [
    await seedProvider(baseURL, admin, {
      email: `p4b-a-${tag}@mednet.test`,
      displayName: `Dr. Ama Kollie ${tag}`,
      specialty: `Family medicine ${tag}`,
      password,
      slots: [
        { startsAt: tomorrowAt(12), minutes: 30, mode: "IN_PERSON" },
        { startsAt: tomorrowAt(13), minutes: 30, mode: "TEXT" },
        { startsAt: hoursFromNow(50), minutes: 45, mode: "TEXT" },
      ],
    }),
    await seedProvider(baseURL, admin, {
      email: `p4b-b-${tag}@mednet.test`,
      displayName: `Dr. Joseph Tarr ${tag}`,
      specialty: `Family medicine ${tag}`,
      password,
      slots: [],
    }),
  ];
  providerAccountEmail = providers[1].email;
  patientEmail = `p4b-patient-${tag}@mednet.test`;
  secondPatientEmail = `p4b-patient2-${tag}@mednet.test`;
  await createVerifiedAccount(admin, { email: patientEmail, displayName: "Live Patient", accountType: "PATIENT", password });
  await createVerifiedAccount(admin, { email: secondPatientEmail, displayName: "Live Patient Two", accountType: "PATIENT", password });
  await admin.dispose();
});

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .exclude("nextjs-portal")
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
}

async function apiJson(context: APIRequestContext, url: string) {
  return (await context.get(url)).json();
}

test("homepage sections show live directory data and no unsupported claims", async ({ page, request }) => {
  const directory = await apiJson(request, "/api/v1/providers?size=100");
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Trusted care, wherever you are." })).toBeVisible();

  const firstThree = directory.content.slice(0, 3);
  const cards = page.getByRole("region", { name: "Explore available care" }).getByRole("article");
  await expect(cards).toHaveCount(firstThree.length);
  for (const [index, provider] of firstThree.entries()) {
    await expect(cards.nth(index)).toContainText(provider.displayName);
    await expect(cards.nth(index).getByRole("link", { name: `See open times: ${provider.displayName}` })).toHaveAttribute(
      "href",
      `/find-care?provider=${encodeURIComponent(provider.id)}`,
    );
  }
  await expect(cards.first()).not.toContainText("Checking open times");

  const specialtyLinks = page.getByRole("region", { name: "Start with the right kind of care" }).getByRole("link", { name: /approved provider/ });
  expect(await specialtyLinks.count()).toBeGreaterThan(0);
  await expect(specialtyLinks.first()).toHaveAttribute("href", /\/find-care\?specialty=/);

  const text = await page.locator("main").innerText();
  for (const unsupported of ["USD", "Video consultation", "payout", "Transparent fixed fees", "Profile verified", "Verified providers"]) {
    expect(text, `homepage must not show "${unsupported}"`).not.toContain(unsupported);
  }
  await expectNoHorizontalScroll(page);
  await expectNoAxeViolations(page);
});

test("the hero search finds providers by specialty through /find-care", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("searchbox", { name: "What care do you need?" }).fill(providers[0].specialty);
  await page.getByRole("button", { name: "Find a doctor" }).click();
  await expect(page).toHaveURL(/\/find-care\?search=/);
  await expect(page.getByRole("status").filter({ hasText: "2 providers found" })).toBeVisible();
  const results = page.getByRole("region", { name: "Approved providers" }).getByRole("article");
  await expect(results).toHaveCount(2);
  await expect(results.filter({ hasText: providers[0].displayName })).toContainText("Tomorrow");
  await expect(results.filter({ hasText: providers[1].displayName })).toContainText("No open times");
  await expectNoHorizontalScroll(page);
  await expectNoAxeViolations(page);
});

test("filters and empty results", async ({ page }) => {
  await page.goto(`/find-care?specialty=${encodeURIComponent(providers[0].specialty)}`);
  await expect(page.getByRole("link", { name: `Remove specialty filter: ${providers[0].specialty}` })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "2 providers found" })).toBeVisible();

  await page.getByRole("searchbox", { name: "Doctor name or specialty" }).fill(`nobody-${tag}`);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByText("No providers match your search")).toBeVisible();
  await page.getByRole("link", { name: "Clear filters" }).click();
  await expect(page).toHaveURL(/\/find-care$/);
});

test("a provider with no open times says so", async ({ page }) => {
  await page.goto(`/find-care?provider=${providers[1].id}`);
  const drawer = page.getByRole("dialog");
  await expect(drawer).toContainText("No open times");
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page).toHaveURL(/\/find-care$/);
});

test("signed-out visitor picks a time, signs in, and returns with the time selected", async ({ page }) => {
  await page.goto(`/find-care?search=${encodeURIComponent(providers[0].displayName)}`);
  await page.getByRole("link", { name: `See open times: ${providers[0].displayName}` }).click();
  const drawer = page.getByRole("dialog", { name: `Open times · ${providers[0].displayName}` });
  await expect(drawer.getByRole("radio")).toHaveCount(3);
  await expect(drawer).toContainText("Times are in Liberia time (GMT).");
  await expect(drawer).toContainText("In person");
  await expect(drawer).toContainText("Text consultation");

  await drawer.getByRole("radio").nth(1).check();
  await drawer.getByRole("link", { name: "Sign in to request this time" }).click();
  await expect(page).toHaveURL(/\/sign-in\?redirect=/);
  await page.getByRole("textbox", { name: "Email address" }).fill(patientEmail);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page).toHaveURL(new RegExp(`/find-care\\?provider=${providers[0].id}&slot=${providers[0].slotIds[1]}`));
  const returned = page.getByRole("dialog");
  await expect(returned.getByRole("radio").nth(1)).toBeChecked();
  await expect(returned.getByRole("status").filter({ hasText: "Selected:" })).toContainText("Text consultation");
});

test("booking needs a completed patient profile, then the request is sent", async ({ page }) => {
  const patient = await signedInContext(baseURL, patientEmail, password);
  await page.context().addCookies((await patient.storageState()).cookies);
  await page.goto(`/find-care?provider=${providers[0].id}&slot=${providers[0].slotIds[1]}`);
  const drawer = page.getByRole("dialog");
  await drawer.getByRole("button", { name: "Send appointment request" }).click();
  await expect(drawer.getByRole("alert").filter({ hasText: "Complete your patient profile before booking" })).toBeVisible();
  await expect(drawer.getByRole("link", { name: "Open my profile" })).toHaveAttribute("href", "/patient/profile");

  await completePatientProfile(patient, "Live Patient");
  await drawer.getByRole("button", { name: "Send appointment request" }).click();
  await expect(drawer.getByText("Request sent")).toBeVisible();
  await expect(drawer.getByRole("link", { name: "View my appointments" })).toHaveAttribute("href", "/patient/appointments");

  const appointments = await apiJson(patient, "/api/v1/appointments?page=0&size=10");
  expect(appointments.content).toHaveLength(1);
  expect(appointments.content[0]).toMatchObject({ status: "PENDING", consultationMode: "TEXT" });
  await patient.dispose();
  await expectNoAxeViolations(page);
});

test("a time taken by someone else is refreshed instead of double-booked", async ({ page }) => {
  const patient2 = await signedInContext(baseURL, secondPatientEmail, password);
  await completePatientProfile(patient2, "Live Patient Two");
  await page.context().addCookies((await patient2.storageState()).cookies);

  const remaining = providers[0].slotIds.filter((id) => id !== providers[0].slotIds[1]);
  await page.goto(`/find-care?provider=${providers[0].id}&slot=${remaining[0]}`);
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByRole("radio")).toHaveCount(2);

  // Someone else requests the same time first (the first patient, through the API).
  const patient1 = await signedInContext(baseURL, patientEmail, password);
  expect((await requestAppointmentAs(patient1, remaining[0])).ok()).toBe(true);

  await drawer.getByRole("button", { name: "Send appointment request" }).click();
  await expect(drawer.getByRole("alert").filter({ hasText: "That time is no longer available" })).toBeVisible();
  await expect(drawer.getByRole("radio")).toHaveCount(1);
  await patient1.dispose();
  await patient2.dispose();
});

test("provider accounts are told that only patients can request", async ({ page }) => {
  const provider = await signedInContext(baseURL, providerAccountEmail, password);
  await page.context().addCookies((await provider.storageState()).cookies);
  await page.goto(`/find-care?provider=${providers[0].id}`);
  await expect(page.getByRole("dialog")).toContainText("Requests are made from a patient account");
  await expect(page.getByRole("button", { name: "Send appointment request" })).toHaveCount(0);
  await provider.dispose();
});
