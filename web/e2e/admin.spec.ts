import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { stubAdminApi } from "./support/admin-stub";

/**
 * Administration (Phase 4E) with the API stubbed in the browser: both role workspaces at
 * 390/820/1440, WCAG A/AA, permission-aware controls, confirmations, CSRF on every write, and the
 * UI's response when the server refuses. Real integration is in admin.live.spec.ts.
 */
async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "page should not scroll horizontally").toBeLessThanOrEqual(0);
}

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .exclude("nextjs-portal")
    .analyze();
  expect(results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
}

async function expectComfortableTargets(page: Page) {
  const small = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("main a, main button, main input:not([type=radio]), main select, header button")]
      .filter((el) => el.offsetParent !== null)
      .map((el) => ({ text: el.textContent?.trim() || el.getAttribute("aria-label") || el.tagName, h: el.getBoundingClientRect().height }))
      .filter(({ h }) => h < 40),
  );
  expect(small).toEqual([]);
}

const superViews = [
  { path: "/admin", ready: "Platform control centre" },
  { path: "/admin/users", ready: "James Brown" },
  { path: "/admin/providers", ready: "Dr. Mariama Cole" },
  { path: "/admin/verification", ready: "Unverified Person" },
  { path: "/admin/security", ready: "Account suspended" },
  { path: "/admin/configuration", ready: "Video and voice consultations" },
  { path: "/admin/tasks", ready: "Home-care requests" },
  { path: "/admin/appointments", ready: "All appointments" },
];

const adminViews = [
  { path: "/admin", ready: "Daily operations" },
  { path: "/admin/tasks", ready: "Home-care requests" },
  { path: "/admin/onboarding", ready: "Dr. Mariama Cole" },
  { path: "/admin/onboarding?tab=accounts", ready: "James Brown" },
  { path: "/admin/appointments", ready: "All appointments" },
  { path: "/admin/escalations", ready: "Escalations are not available yet" },
  { path: "/admin/reports", ready: "Recent administrative activity" },
];

for (const [role, views, title] of [
  ["SUPER_ADMIN", superViews, "Super administrator"],
  ["ADMIN", adminViews, "Administrator"],
] as const) {
  test.describe(`${title} workspace`, () => {
    for (const { path, ready } of views) {
      test(`${path} fits the viewport and passes WCAG AA checks`, async ({ page }) => {
        await stubAdminApi(page, { role });
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
        await expect(page.getByText(ready).filter({ visible: true }).first()).toBeVisible();
        await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
        await expectNoHorizontalScroll(page);
        await expectComfortableTargets(page);
        await expectNoAxeViolations(page);
      });
    }
  });
}

test.describe("administration access", () => {
  test("signed-out visitors see a sign-in prompt that returns to the page, and no admin data", async ({ page }) => {
    await stubAdminApi(page, { signedOut: true });
    await page.goto("/admin/users");
    await expect(page.getByRole("link", { name: "Go to sign in" })).toHaveAttribute("href", "/sign-in?redirect=%2Fadmin%2Fusers");
    await expect(page.getByText("James Brown")).toHaveCount(0);
  });

  for (const [role, destination] of [
    ["PATIENT", /\/patient$/],
    ["PROVIDER", /\/provider$/],
  ] as const) {
    test(`a ${role} session is sent to its own workspace`, async ({ page }) => {
      await stubAdminApi(page, { role });
      await page.goto("/admin");
      await expect(page).toHaveURL(destination);
    });
  }

  test("an administrator cannot open super-administrator pages from the URL", async ({ page }) => {
    await stubAdminApi(page, { role: "ADMIN" });
    for (const path of ["/admin/users", "/admin/verification", "/admin/security", "/admin/configuration"]) {
      await page.goto(path);
      await expect(page.getByText("This page is not part of the administrator workspace")).toBeVisible();
      await expect(page.locator("main").getByRole("button", { name: /^Open / })).toHaveCount(0);
    }
    await expect(page.getByRole("navigation", { name: "Administrator workspace" }).getByRole("link")).toHaveText([
      /Overview/,
      /Task queue/,
      /Onboarding/,
      /Appointments/,
      /Escalations/,
      /Reports/,
    ]);
  });

  test("an administrator sees only suspend and reactivate on accounts", async ({ page }) => {
    await stubAdminApi(page, { role: "ADMIN" });
    await page.goto("/admin/onboarding?tab=accounts");
    await page.getByRole("button", { name: "Open James Brown" }).filter({ visible: true }).click();
    const record = page.getByRole("region", { name: "Selected record" });
    await expect(record.getByRole("button", { name: "Suspend account" })).toBeVisible();
    for (const name of ["Edit details", "Mark email verified", "Mark email not verified", "Delete account"]) {
      await expect(record.getByRole("button", { name })).toHaveCount(0);
    }
    await expect(record).toContainText("Editing details, verification and deletion are for super administrators.");
  });

  test("an administrator gets no status actions on administrator accounts", async ({ page }) => {
    await stubAdminApi(page, { role: "ADMIN" });
    await page.goto("/admin/onboarding?tab=accounts");
    await page.getByRole("button", { name: "Open Peer Administrator" }).filter({ visible: true }).click();
    const record = page.getByRole("region", { name: "Selected record" });
    await expect(record.getByRole("button")).toHaveCount(0);
    await expect(record).toContainText("Only a super administrator can suspend, reactivate or change administrator accounts.");
  });

  test("a super administrator can still suspend an administrator account", async ({ page }) => {
    const log = await stubAdminApi(page);
    await page.goto("/admin/users");
    await page.getByRole("button", { name: "Open Peer Administrator" }).filter({ visible: true }).click();
    await page.getByRole("region", { name: "Selected record" }).getByRole("button", { name: "Suspend account" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Suspend account" }).click();
    await expect(page.getByRole("region", { name: "Selected record" }).getByRole("button", { name: "Reactivate account" })).toBeVisible();
    expect(log.requests).toEqual([{ method: "PATCH", path: "/admin/accounts/acc-peer/status", body: { status: "SUSPENDED" }, csrf: "test-token" }]);
  });

  test("the request queue shows who holds a request and offers no second assignment", async ({ page }) => {
    await stubAdminApi(page, { role: "ADMIN" });
    await page.goto("/admin/tasks");
    await page.getByRole("tab", { name: "Laboratory requests" }).click();
    await expect(page.getByRole("button", { name: /Request 6D2F3A00/ }).first()).toContainText("Assigned to LB-LAB000000000");
    await page.getByRole("button", { name: /Assigned to LB-LAB000000000/ }).click();
    const record = page.getByRole("region", { name: "Selected record" });
    await expect(record).toContainText("LB-LAB000000000");
    await expect(record.getByLabel("Assign to laboratory staff")).toHaveCount(0);
    await expect(record.getByRole("button", { name: "Mark in progress" })).toHaveCount(0);
    await expect(record.getByRole("button", { name: "Cancel request" })).toBeVisible();
  });

  test("a refusal from the server is shown and nothing changes", async ({ page }) => {
    await stubAdminApi(page, { role: "ADMIN", forbidden: ["/admin/accounts/acc-james/status"] });
    await page.goto("/admin/onboarding?tab=accounts");
    await page.getByRole("button", { name: "Open James Brown" }).filter({ visible: true }).click();
    await page.getByRole("button", { name: "Suspend account" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Suspend account" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "You do not have permission" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Selected record" })).toContainText("Active");
  });

  test("an expired session hides administrative data and offers sign-in", async ({ page }) => {
    const log = await stubAdminApi(page);
    await page.goto("/admin/users");
    await expect(page.getByText("James Brown").filter({ visible: true }).first()).toBeVisible();
    log.expireSession();
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByText("Your session has ended")).toBeVisible();
    await expect(page.getByText("James Brown")).toHaveCount(0);
  });

  test("your own account has no actions", async ({ page }) => {
    await stubAdminApi(page);
    await page.goto("/admin/users");
    await page.getByRole("button", { name: "Open Platform Admin" }).filter({ visible: true }).click();
    const record = page.getByRole("region", { name: "Selected record" });
    await expect(record).toContainText("This is your own account");
    await expect(record.getByRole("button")).toHaveCount(0);
  });
});

test.describe("super administrator actions", () => {
  test("approving a provider asks first, sends one request with CSRF, and never says verified", async ({ page }) => {
    const log = await stubAdminApi(page);
    await page.goto("/admin/providers");
    await page.getByRole("button", { name: /Dr\. Mariama Cole/ }).click();
    await page.getByRole("button", { name: "Approve" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("does not independently verify credentials");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    expect(log.requests).toEqual([]);

    await page.getByRole("button", { name: "Approve" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Approve" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Dr. Mariama Cole is approved." })).toBeVisible();
    expect(log.requests).toEqual([{ method: "PATCH", path: "/admin/providers/app-cole/status", body: { status: "APPROVED" }, csrf: "test-token" }]);
    await expect(page.getByRole("region", { name: "Selected record" }).getByRole("button", { name: "Suspend" })).toBeVisible();
    await expect(page.locator("main").getByText(/\bverified\b/i)).toHaveCount(0);
  });

  test("suspending, verifying, editing and deleting accounts", async ({ page }) => {
    const log = await stubAdminApi(page);
    await page.goto("/admin/users");
    await page.getByRole("button", { name: "Open James Brown" }).filter({ visible: true }).click();
    const record = page.getByRole("region", { name: "Selected record" });

    await record.getByRole("button", { name: "Suspend account" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Suspend account" }).click();
    await expect(record).toContainText("Suspended");
    await expect(record.getByRole("button", { name: "Reactivate account" })).toBeVisible();

    await record.getByRole("button", { name: "Edit details" }).click();
    const edit = page.getByRole("dialog", { name: /Edit PT-JAMES/ });
    await edit.getByLabel("Name").fill("James K. Brown");
    await edit.getByRole("button", { name: "Save changes" }).click();
    await expect(record).toContainText("James K. Brown");

    await record.getByRole("button", { name: "Delete account" }).click();
    await expect(page.getByRole("dialog")).toContainText("cannot be undone");
    await page.getByRole("dialog").getByRole("button", { name: "Delete account" }).click();
    await expect(page.getByRole("status").filter({ hasText: "james@example.test was deleted." })).toBeVisible();

    expect(log.requests.map(({ method, path, csrf }) => `${method} ${path} ${csrf}`)).toEqual([
      "PATCH /admin/accounts/acc-james/status test-token",
      "PUT /admin/accounts/acc-james test-token",
      "DELETE /admin/accounts/acc-james test-token",
    ]);
    expect(log.requests[1].body).toEqual({ displayName: "James K. Brown", email: "james@example.test", accountType: "PATIENT" });
  });

  test("creating an account validates, then shows a generated password once", async ({ page }) => {
    const log = await stubAdminApi(page);
    await page.goto("/admin/users");
    await page.getByRole("button", { name: "Create account" }).click();
    const dialog = page.getByRole("dialog", { name: "Create an account" });
    await expect(dialog.getByLabel("Account type").locator("option")).toHaveText(["Patient", "Provider", "Laboratory staff", "Home-care staff"]);
    await dialog.getByRole("button", { name: "Create account" }).click();
    await expect(dialog.getByLabel("Name")).toBeFocused();
    expect(log.requests).toEqual([]);

    await dialog.getByLabel("Name").fill("Amara Kollie");
    await dialog.getByLabel("Email").fill("amara@example.test");
    await dialog.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Save this generated password now")).toBeVisible();
    const shown = await page.locator("code").filter({ hasText: /^[A-Za-z0-9_-]{32}$/ }).textContent();
    expect(log.requests[0]).toMatchObject({ method: "POST", path: "/admin/accounts", csrf: "test-token", body: { accountType: "PATIENT", password: shown } });
  });

  test("the verification queue lists only unverified email addresses", async ({ page }) => {
    await stubAdminApi(page);
    await page.goto("/admin/verification");
    await expect(page.getByText("Unverified Person").filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText("James Brown")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Create account" })).toHaveCount(0);
  });

  test("assigning and cancelling patient service requests", async ({ page }) => {
    const log = await stubAdminApi(page);
    await page.goto("/admin/tasks");
    await page.getByRole("button", { name: /Request 5C1E2F00/ }).click();
    await page.getByLabel("Assign to home-care staff").selectOption({ label: "Peter Care (HC-HOME00000000)" });
    await page.getByRole("button", { name: "Assign request" }).click();
    await expect(page.getByRole("status").filter({ hasText: "The request was assigned." })).toBeVisible();

    await page.getByRole("tab", { name: "Laboratory requests" }).click();
    await page.getByRole("button", { name: /Request 5C1E2F00/ }).click();
    await page.getByRole("button", { name: "Cancel request" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Cancel request" }).click();
    await expect(page.getByRole("status").filter({ hasText: "cancelled" })).toBeVisible();

    expect(log.requests).toEqual([
      { method: "PATCH", path: "/admin/service-requests/5c1e2f00-aaaa-4bbb-8ccc-000000000001/assignment", body: { staffAccountId: "acc-hc" }, csrf: "test-token" },
      { method: "PATCH", path: "/admin/service-requests/5c1e2f00-aaaa-4bbb-8ccc-000000000002/status", body: { status: "CANCELLED" }, csrf: "test-token" },
    ]);
  });

  test("escalations are labelled presentation-only", async ({ page }) => {
    await stubAdminApi(page, { role: "ADMIN" });
    await page.goto("/admin/escalations");
    await expect(page.getByText("Fictional data").first()).toBeVisible();
  });

  test("empty queues show empty states", async ({ page }) => {
    await stubAdminApi(page, { empty: true });
    await page.goto("/admin/providers");
    await expect(page.getByText("No applications are waiting for review")).toBeVisible();
    await page.goto("/admin/appointments");
    await expect(page.getByText("No appointments yet")).toBeVisible();
  });
});
