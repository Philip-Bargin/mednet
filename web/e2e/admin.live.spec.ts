import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { liveAdmin } from "./support/live-backend";
import { completePatientProfile, createVerifiedAccount, signedInContext } from "./support/seed-directory";

/**
 * Administration (Phase 4E) against a running MedNet API, no mocks. Run with MEDNET_LIVE_API=1 (see
 * e2e/README.md). Synthetic accounts only. Covers the super-admin sign-in fix, both role workspaces,
 * provider decisions, the account lifecycle, service-request coordination and the server's refusals
 * for every SUPER_ADMIN-only endpoint when called by an ADMIN, a patient or nobody.
 */
test.describe.configure({ mode: "serial" });

const password = "Phase4e-Live-Pass-1";
let baseURL = "";
let tag = "";
let superAdmin: APIRequestContext;
let admin = { email: "", id: "", context: null as unknown as APIRequestContext };
let patient = { email: "", id: "", context: null as unknown as APIRequestContext };
let homeCare = { email: "", id: "", name: "", publicId: "" };

async function csrf(context: APIRequestContext) {
  const token = await (await context.get("/api/v1/auth/csrf")).json();
  return { [token.headerName]: token.token } as Record<string, string>;
}

async function send(context: APIRequestContext, method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", url: string, data?: unknown) {
  return context.fetch(url, { method, data, headers: method === "GET" ? {} : await csrf(context) });
}

async function call(context: APIRequestContext, method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", url: string, data?: unknown) {
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

async function findAccount(email: string) {
  const page = await call(superAdmin, "GET", `/api/v1/admin/accounts?search=${encodeURIComponent(email)}`);
  return page.content.find((account: { email: string }) => account.email === email);
}

test.beforeAll(async ({}, testInfo) => {
  test.skip(!liveAdmin.email || !liveAdmin.password, "set MEDNET_LIVE_ADMIN_EMAIL and MEDNET_LIVE_ADMIN_PASSWORD");
  baseURL = String(testInfo.project.use.baseURL);
  tag = `${testInfo.project.name}${Date.now().toString(36)}`;
  // A fresh sign-in on every project run: before the Phase 4E fix the second one failed.
  superAdmin = await signedInContext(baseURL, liveAdmin.email, liveAdmin.password);

  admin.email = `p4e-admin-${tag}@mednet.test`;
  const created = await createVerifiedAccount(superAdmin, { email: admin.email, displayName: `Ops Admin ${tag}`, accountType: "PATIENT", password });
  await call(superAdmin, "PUT", `/api/v1/admin/accounts/${created.id}`, { displayName: `Ops Admin ${tag}`, email: admin.email, accountType: "ADMIN" });
  admin = { ...admin, id: created.id, context: await signedInContext(baseURL, admin.email, password) };

  patient.email = `p4e-patient-${tag}@mednet.test`;
  const patientAccount = await createVerifiedAccount(superAdmin, { email: patient.email, displayName: `Kebeh Patient ${tag}`, accountType: "PATIENT", password });
  patient = { ...patient, id: patientAccount.id, context: await signedInContext(baseURL, patient.email, password) };
  await completePatientProfile(patient.context, `Kebeh Patient ${tag}`);

  homeCare = { email: `p4e-hc-${tag}@mednet.test`, id: "", name: `Hawa Carer ${tag}`, publicId: "" };
  homeCare.id = (await createVerifiedAccount(superAdmin, { email: homeCare.email, displayName: homeCare.name, accountType: "HOME_CARE", password })).id;
  homeCare.publicId = (await findAccount(homeCare.email)).publicId;
});

test("1. the configured super administrator can sign in again and lands on /admin", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(liveAdmin.email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(liveAdmin.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { level: 1, name: "Super administrator" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Platform control centre" })).toBeVisible();
  await expectFitsAndAccessible(page);
  // A third sign-in through the API in the same process still works.
  const again = await signedInContext(baseURL, liveAdmin.email, liveAdmin.password);
  expect((await (await again.get("/api/v1/auth/session")).json()).role).toBe("SUPER_ADMIN");
});

test("2. provider intake and approval, seen from both sides", async ({ page }) => {
  const name = `Dr. Intake ${tag}`;
  const email = `p4e-doc-${tag}@mednet.test`;
  await createVerifiedAccount(superAdmin, { email, displayName: name, accountType: "PROVIDER", password });
  await as(page, superAdmin);
  await page.goto("/admin/providers");
  await page.getByRole("button", { name: "Add application" }).click();
  const dialog = page.getByRole("dialog", { name: "Add a provider application" });
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByLabel("Email").fill(email);
  await dialog.getByLabel("Specialty").fill("Family medicine");
  await dialog.getByLabel("Licence or registration reference").fill(`LMDC-${tag}`);
  await dialog.getByRole("button", { name: "Add application" }).click();
  await expect(page.getByRole("status").filter({ hasText: `Application added for ${name}` })).toBeVisible();

  const record = page.getByRole("region", { name: "Selected record" });
  await expect(record).toContainText(`LMDC-${tag}`);
  await record.getByRole("button", { name: "Approve" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Approve" }).click();
  await expect(page.getByRole("status").filter({ hasText: `${name} is approved.` })).toBeVisible();
  await expect(page.locator("main").getByText(/\bverified\b/i)).toHaveCount(0);

  const applications = await call(superAdmin, "GET", "/api/v1/admin/providers?status=APPROVED");
  expect(applications.find((a: { email: string }) => a.email === email)?.status).toBe("APPROVED");
  // The provider now signs in with the PROVIDER role and is listed publicly.
  const provider = await signedInContext(baseURL, email, password);
  expect((await (await provider.get("/api/v1/auth/session")).json()).role).toBe("PROVIDER");
  const directory = await call(provider, "GET", `/api/v1/providers?search=${encodeURIComponent(name)}`);
  expect(JSON.stringify(directory)).toContain(name);
});

test("3. account lifecycle: create, verify, suspend, reactivate, edit, delete", async ({ page }) => {
  const email = `p4e-new-${tag}@mednet.test`;
  await as(page, superAdmin);
  await page.goto("/admin/users");
  await page.getByRole("button", { name: "Create account" }).click();
  const dialog = page.getByRole("dialog", { name: "Create an account" });
  await dialog.getByLabel("Name").fill(`New Person ${tag}`);
  await dialog.getByLabel("Email").fill(email);
  await dialog.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Save this generated password now")).toBeVisible();
  const generated = (await page.locator("code").filter({ hasText: /^[A-Za-z0-9_-]{32}$/ }).textContent())!;

  // Unverified accounts cannot sign in.
  const login = async () => {
    const context = await (await import("@playwright/test")).request.newContext({ baseURL });
    const response = await context.post("/api/v1/auth/login", { form: { email, password: generated }, headers: await csrf(context) });
    await context.dispose();
    return response.status();
  };
  expect(await login()).toBe(401);

  const record = page.getByRole("region", { name: "Selected record" });
  await record.getByRole("button", { name: "Mark email verified" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Mark verified" }).click();
  await expect(record).toContainText("Verified");
  expect(await login()).toBe(204);

  await record.getByRole("button", { name: "Suspend account" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Suspend account" }).click();
  await expect(record.getByRole("button", { name: "Reactivate account" })).toBeVisible();
  expect(await login()).toBe(401);
  expect((await findAccount(email)).status).toBe("SUSPENDED");

  await record.getByRole("button", { name: "Reactivate account" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Reactivate account" }).click();
  await expect(record.getByRole("button", { name: "Suspend account" })).toBeVisible();

  await record.getByRole("button", { name: "Edit details" }).click();
  const edit = page.getByRole("dialog", { name: /^Edit / });
  await edit.getByLabel("Name").fill(`Renamed Person ${tag}`);
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(record).toContainText(`Renamed Person ${tag}`);
  expect((await findAccount(email)).displayName).toBe(`Renamed Person ${tag}`);

  await record.getByRole("button", { name: "Delete account" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete account" }).click();
  await expect(page.getByRole("status").filter({ hasText: `${email} was deleted.` })).toBeVisible();
  expect(await findAccount(email)).toBeUndefined();

  // Every change is in the audit trail.
  await page.goto("/admin/security");
  for (const label of ["Account created", "Email marked verified", "Account suspended", "Account reactivated", "Account details changed", "Account deleted"]) {
    await expect(page.getByText(label).filter({ visible: true }).first()).toBeVisible();
  }
  await expectFitsAndAccessible(page);
});

test("4. accounts linked to care records are protected from deletion", async ({ page }) => {
  await as(page, superAdmin);
  await page.goto(`/admin/users`);
  await page.getByRole("searchbox", { name: "Search by name, email or public ID" }).fill(patient.email);
  await page.getByRole("button", { name: "Search" }).click();
  await page.getByRole("button", { name: `Open Kebeh Patient ${tag}` }).filter({ visible: true }).click();
  await page.getByRole("button", { name: "Delete account" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete account" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "cannot be deleted" })).toBeVisible();
  expect(await findAccount(patient.email)).toBeDefined();
});

test("5. an administrator's workspace exposes only administrator capabilities", async ({ page }) => {
  await as(page, admin.context);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { level: 1, name: "Administrator" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Daily operations" })).toBeVisible();
  await expectFitsAndAccessible(page);

  for (const path of ["/admin/users", "/admin/verification", "/admin/security", "/admin/configuration"]) {
    await page.goto(path);
    await expect(page.getByText("This page is not part of the administrator workspace")).toBeVisible();
  }

  await page.goto("/admin/onboarding?tab=accounts");
  await page.getByRole("searchbox", { name: "Search by name, email or public ID" }).fill(patient.email);
  await page.getByRole("button", { name: "Search" }).click();
  await page.getByRole("button", { name: `Open Kebeh Patient ${tag}` }).filter({ visible: true }).click();
  const record = page.getByRole("region", { name: "Selected record" });
  await expect(record.getByRole("button", { name: "Suspend account" })).toBeVisible();
  for (const name of ["Edit details", "Mark email verified", "Mark email not verified", "Delete account"]) {
    await expect(record.getByRole("button", { name })).toHaveCount(0);
  }
  await expect(page.getByRole("dialog", { name: "Create an account" })).toHaveCount(0);
});

test("6. the API refuses SUPER_ADMIN-only actions to administrators, patients and anonymous callers", async () => {
  const target = (await findAccount(patient.email)).id as string;
  const superOnly: Array<[method: "PUT" | "PATCH" | "DELETE", url: string, body?: unknown]> = [
    ["PUT", `/api/v1/admin/accounts/${target}`, { displayName: "Changed", email: patient.email, accountType: "PATIENT" }],
    ["PATCH", `/api/v1/admin/accounts/${target}/role`, { accountType: "SUPER_ADMIN" }],
    ["PATCH", `/api/v1/admin/accounts/${target}/verification`, { emailVerified: false }],
    ["DELETE", `/api/v1/admin/accounts/${target}`],
  ];
  for (const [method, url, body] of superOnly) {
    expect((await send(admin.context, method, url, body)).status(), `${method} ${url} as ADMIN`).toBe(403);
  }
  // Administrators cannot create privileged accounts or promote themselves.
  expect(
    (await send(admin.context, "POST", "/api/v1/admin/accounts", { displayName: "X", email: `x-${tag}@mednet.test`, accountType: "SUPER_ADMIN", password })).status(),
  ).toBe(400);
  expect((await send(admin.context, "PATCH", `/api/v1/admin/accounts/${admin.id}/role`, { accountType: "SUPER_ADMIN" })).status()).toBe(403);

  // Patients and anonymous callers cannot read any administration endpoint.
  const anonymous = await (await import("@playwright/test")).request.newContext({ baseURL });
  for (const url of ["/api/v1/admin/overview", "/api/v1/admin/accounts", "/api/v1/admin/audit", "/api/v1/admin/providers"]) {
    expect((await patient.context.get(url)).status(), `${url} as PATIENT`).toBe(403);
    expect((await anonymous.get(url)).status(), `${url} anonymous`).toBe(401);
  }
  await anonymous.dispose();
  // Nothing changed.
  const after = await findAccount(patient.email);
  expect(after).toMatchObject({ accountType: "PATIENT", emailVerified: true, displayName: `Kebeh Patient ${tag}` });
});

test("7. a patient is sent away from /admin", async ({ page }) => {
  await as(page, patient.context);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/patient$/);
});

test("8. home-care request coordination: the administrator assigns, the partner sees it", async ({ page }) => {
  const created = await call(patient.context, "POST", "/api/v1/home-care-requests", {
    serviceDescription: "Wound dressing (synthetic)",
    locationDescription: "Synthetic address, Monrovia",
  });
  const reference = created.id.replaceAll("-", "").slice(0, 8).toUpperCase();
  await as(page, admin.context);
  await page.goto("/admin/tasks");
  await page.getByRole("button", { name: new RegExp(`Request ${reference}`) }).click();
  const record = page.getByRole("region", { name: "Selected record" });
  // Administrators see no requested service or location.
  await expect(record).not.toContainText("Wound dressing");
  await expect(record).not.toContainText("Synthetic address");
  await record.getByLabel("Assign to home-care staff").selectOption({ label: `${homeCare.name} (${homeCare.publicId})` });
  await record.getByRole("button", { name: "Assign request" }).click();
  await expect(page.getByRole("status").filter({ hasText: "The request was assigned." })).toBeVisible();

  const carer = await signedInContext(baseURL, homeCare.email, password);
  const queue = await call(carer, "GET", "/api/v1/partner/service-requests?type=HOME_CARE");
  expect(JSON.stringify(queue)).toContain(created.id);

  // Since Phase 4F the queue reports the assignment, so no second assignment is offered; the server
  // still refuses one.
  await page.reload();
  await page.getByRole("button", { name: new RegExp(`Request ${reference}`) }).click();
  await expect(record).toContainText(homeCare.publicId);
  await expect(record.getByLabel("Assign to home-care staff")).toHaveCount(0);
  expect((await send(admin.context, "PATCH", `/api/v1/admin/service-requests/${created.id}/assignment`, { staffAccountId: homeCare.id })).status()).toBe(409);
});

test("9. signing out removes administrative access", async ({ page }) => {
  const fresh = await signedInContext(baseURL, admin.email, password);
  await as(page, fresh);
  await page.goto("/admin/appointments");
  await expect(page.getByRole("heading", { name: "All appointments" })).toBeVisible();
  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto("/admin/appointments");
  await expect(page.getByRole("link", { name: "Go to sign in" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "All appointments" })).toHaveCount(0);
  expect((await fresh.get("/api/v1/admin/overview")).status()).toBe(401);
});
