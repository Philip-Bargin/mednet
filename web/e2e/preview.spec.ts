import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Preview operations workspaces (Phase 4G): fictional data only, under /preview. Every view must fit
 * 390/820/1440, pass WCAG A/AA, keep the "Preview only — Fictional data" notice visible, and make no
 * API request at all (so no preview control can reach a backend record).
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

function recordApiCalls(page: Page) {
  const calls: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/")) calls.push(`${request.method()} ${request.url()}`);
  });
  return calls;
}

const views = [
  { path: "/preview/collection", heading: "Pickup coordination" },
  { path: "/preview/collection/pickup-requests", heading: "Pickup requests" },
  { path: "/preview/collection/pricing-payouts", heading: "Pricing & payouts" },
  { path: "/preview/collection-agent", heading: "Collection agent" },
  { path: "/preview/collection-agent/offline-queue", heading: "Offline queue" },
  { path: "/preview/support", heading: "Service request workspace" },
  { path: "/preview/support/tickets", heading: "Ticket queue" },
  { path: "/preview/finance", heading: "Payments and reconciliation" },
  { path: "/preview/finance/refunds", heading: "Refunds" },
  { path: "/preview/specimen-lifecycle", heading: "Specimen lifecycle" },
  { path: "/preview/specimen-lifecycle/dependencies", heading: "Dependencies" },
  { path: "/preview/permissions-matrix", heading: "Role-based permissions matrix" },
  { path: "/preview/permissions-matrix/audit-requirements", heading: "Audit requirements" },
];

test.describe("preview workspaces", () => {
  test("the index lists every preview and says it is fictional", async ({ page }) => {
    const calls = recordApiCalls(page);
    await page.goto("/preview");
    await expect(page.getByRole("heading", { level: 1, name: "Operations previews" })).toBeVisible();
    await expect(page.getByText("Preview only — Fictional data")).toBeVisible();
    for (const name of ["Collection provider", "Collection agent", "Customer support", "Financial officer", "Specimen lifecycle", "Permissions matrix"]) {
      await expect(page.getByRole("link", { name: new RegExp(name) })).toBeVisible();
    }
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
    expect(calls).toEqual([]);
  });

  for (const { path, heading } of views) {
    test(`${path} is labelled, fits, passes WCAG AA and calls no API`, async ({ page }) => {
      const calls = recordApiCalls(page);
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.getByRole("heading", { level: 2, name: heading }).first()).toBeVisible();
      const notice = page.getByRole("note", { name: "Preview notice" });
      await expect(notice).toContainText("Preview only — Fictional data");
      await page.mouse.wheel(0, 4000);
      await expect(notice).toBeInViewport();
      await expectNoHorizontalScroll(page);
      await expectNoAxeViolations(page);
      expect(calls).toEqual([]);
    });
  }

  test("preview controls take no action and send no request", async ({ page }) => {
    const calls = recordApiCalls(page);
    await page.goto("/preview/finance");
    const refund = page.getByRole("button", { name: "Review full refund" });
    await expect(refund).toHaveAttribute("aria-disabled", "true");
    // aria-disabled: still focusable and announced, activated here by keyboard.
    await refund.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Preview only: no action was taken.")).toBeVisible();
    await page.goto("/preview/collection/pickup-requests");
    await page.getByRole("button", { name: /Congo Town/ }).click();
    await expect(page.getByRole("region", { name: "Selected record" })).toContainText("PU-2081");
    await page.getByRole("button", { name: "Assign pickup" }).focus();
    await page.keyboard.press("Space");
    await expect(page.getByText("Preview only: no action was taken.")).toBeVisible();
    await page.goto("/preview/support");
    await expect(page.getByRole("textbox", { name: "Reply" })).toBeDisabled();
    expect(calls).toEqual([]);
  });

  test("navigation moves between preview sections", async ({ page }) => {
    await page.goto("/preview/support");
    await page.getByRole("navigation", { name: "Customer support workspace" }).getByRole("link", { name: /Templates/ }).click();
    await expect(page).toHaveURL(/\/preview\/support\/templates$/);
    await expect(page.getByRole("heading", { level: 2, name: "Templates" }).first()).toBeVisible();
    await page.getByRole("link", { name: "All previews" }).click();
    await expect(page).toHaveURL(/\/preview$/);
  });

  test("an unknown preview section is not found", async ({ page }) => {
    const response = await page.goto("/preview/finance/payments-live");
    expect(response?.status()).toBe(404);
  });

  test("the permissions preview shows what MedNet enforces, not only the proposal", async ({ page }) => {
    await page.goto("/preview/permissions-matrix");
    await expect(page.getByText("This matrix is a design proposal")).toBeVisible();
    await expect(page.getByText("No such roles exist. These workspaces are previews only.")).toBeVisible();
  });
});
