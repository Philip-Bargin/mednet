import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { LAB_IDS, stubLaboratoryApi } from "./support/laboratory-stub";

/**
 * Laboratory workspace (Phase 4F) with the API stubbed in the browser: layout at 390/820/1440, WCAG
 * A/AA, every write with CSRF, server conflicts, and access states. The laboratory → doctor → patient
 * workflow is verified against the real API in laboratory.live.spec.ts, not here.
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
    [...document.querySelectorAll<HTMLElement>("main a, main button, main input:not([type=radio]):not([type=checkbox]), main select, header button")]
      .filter((el) => el.offsetParent !== null)
      .map((el) => ({ text: el.textContent?.trim() || el.getAttribute("aria-label") || el.tagName, h: el.getBoundingClientRect().height }))
      .filter(({ h }) => h < 40),
  );
  expect(small).toEqual([]);
}

const views = [
  { path: "/laboratory", ready: "Order operations" },
  { path: "/laboratory/orders", ready: "Full blood count" },
  { path: "/laboratory/results", ready: "Released to the patient" },
  { path: "/laboratory/specimens", ready: "Specimen tracking is not available in MedNet yet" },
  { path: "/laboratory/test-catalogue", ready: "A test catalogue is not available in MedNet yet" },
  { path: "/laboratory/pricing-payouts", ready: "Pricing and payouts are not available on MedNet" },
  { path: "/laboratory/audit-history", ready: "Laboratory audit history is not available yet" },
  { path: "/laboratory/profile", ready: "What this account can do" },
];

const openOrder = (page: Page, id: string) =>
  page.getByRole("button", { name: `Open LAB-${id.replaceAll("-", "").slice(0, 8).toUpperCase()}` }).filter({ visible: true }).click();

test.describe("laboratory workspace", () => {
  for (const { path, ready } of views) {
    test(`${path} fits the viewport and passes WCAG AA checks`, async ({ page }) => {
      await stubLaboratoryApi(page);
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.getByText(ready).filter({ visible: true }).first()).toBeVisible();
      await expectNoHorizontalScroll(page);
      await expectComfortableTargets(page);
      await expectNoAxeViolations(page);
    });
  }

  test("overview counts come from the assigned orders, and presentation pages are labelled", async ({ page }) => {
    await stubLaboratoryApi(page);
    await page.goto("/laboratory");
    for (const [value, label] of [["1", "Not started"], ["1", "Processing"], ["1", "Released"], ["1", "Cancelled"]]) {
      await expect(page.locator("main").getByText(label, { exact: true }).first()).toBeVisible();
      await expect(page.locator("main p").filter({ hasText: new RegExp(`^${value}\\s*${label}$`) }).first()).toBeVisible();
    }
    for (const path of ["/laboratory/specimens", "/laboratory/test-catalogue", "/laboratory/pricing-payouts", "/laboratory/audit-history"]) {
      await page.goto(path);
      await expect(page.getByText("Fictional data").first()).toBeVisible();
    }
    await page.goto("/laboratory/specimens");
    for (const box of await page.getByRole("checkbox").all()) await expect(box).toBeDisabled();
  });

  test("starting an order asks first and sends one request with CSRF", async ({ page }) => {
    const log = await stubLaboratoryApi(page);
    await page.goto("/laboratory/orders");
    await openOrder(page, LAB_IDS.open);
    const record = page.getByRole("region", { name: "Selected record" });
    await expect(record).toContainText("Full blood count");
    await expect(record.getByRole("textbox", { name: "Result" })).toHaveCount(0);
    await record.getByRole("button", { name: "Start processing" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
    expect(log.requests).toEqual([]);
    await record.getByRole("button", { name: "Start processing" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Start processing" }).click();
    await expect(page.getByRole("status").filter({ hasText: "is processing" })).toBeVisible();
    await expect(record.getByRole("textbox", { name: "Result" })).toBeVisible();
    expect(log.requests).toEqual([{ method: "PATCH", path: `/partner/service-requests/${LAB_IDS.open}/status`, body: { status: "IN_PROGRESS" }, csrf: "test-token" }]);
  });

  test("submitting a result validates, confirms, and is never shown as released", async ({ page }) => {
    const log = await stubLaboratoryApi(page);
    await page.goto("/laboratory/orders");
    await openOrder(page, LAB_IDS.processing);
    const record = page.getByRole("region", { name: "Selected record" });
    await record.getByRole("button", { name: "Submit for doctor review" }).click();
    await expect(record.getByRole("textbox", { name: "Result" })).toBeFocused();
    expect(log.requests).toEqual([]);
    await record.getByRole("textbox", { name: "Result" }).fill("Synthetic glucose result");
    await record.getByRole("button", { name: "Submit for doctor review" }).click();
    await expect(page.getByRole("dialog")).toContainText("A doctor caring for the patient reviews it");
    await page.getByRole("dialog").getByRole("button", { name: "Submit result" }).click();
    await expect(record.getByText("Result awaiting doctor review")).toBeVisible();
    await expect(record).not.toContainText("Result released");
    await expect(record.getByRole("list", { name: /^Progress of / }).getByRole("listitem").last()).toContainText("Doctor decides");
    expect(log.requests).toEqual([
      { method: "POST", path: `/partner/service-requests/${LAB_IDS.processing}/lab-result`, body: { summary: "Synthetic glucose result" }, csrf: "test-token" },
    ]);
    await page.getByRole("link", { name: "Results" }).click();
    await expect(page.getByRole("list", { name: "Awaiting doctor review" })).toContainText("Fasting blood glucose");
  });

  test("a result awaiting review on the server is shown from the server, with no second form", async ({ page }) => {
    await stubLaboratoryApi(page, { pendingOnServer: [LAB_IDS.processing] });
    await page.goto("/laboratory/orders");
    await expect(page.getByText("Awaiting doctor review").filter({ visible: true }).first()).toBeVisible();
    await openOrder(page, LAB_IDS.processing);
    const record = page.getByRole("region", { name: "Selected record" });
    await expect(record.getByText("Result awaiting doctor review")).toBeVisible();
    await expect(record.getByRole("textbox")).toHaveCount(0);
  });

  test("a returned result shows the doctor's decision and asks for a correction", async ({ page }) => {
    const log = await stubLaboratoryApi(page, { returnedOnServer: [LAB_IDS.processing] });
    await page.goto("/laboratory/results");
    await expect(page.getByRole("list", { name: "Returned by a doctor" })).toContainText("Fasting blood glucose");
    await page.goto("/laboratory/orders");
    await openOrder(page, LAB_IDS.processing);
    const record = page.getByRole("region", { name: "Selected record" });
    await expect(record.getByText("A doctor returned your result")).toBeVisible();
    await expect(record.getByRole("list", { name: /^Progress of / })).toContainText("Returned · submit a correction");
    await record.getByRole("textbox", { name: "Corrected result" }).fill("Synthetic corrected result");
    await record.getByRole("button", { name: "Submit for doctor review" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Submit result" }).click();
    await expect(record.getByText("Result awaiting doctor review")).toBeVisible();
    expect(log.requests.map((r) => `${r.method} ${r.path}`)).toEqual([`POST /partner/service-requests/${LAB_IDS.processing}/lab-result`]);
  });

  test("an order cancelled elsewhere refreshes instead of pretending to start", async ({ page }) => {
    await stubLaboratoryApi(page, { cancelledElsewhere: [LAB_IDS.open] });
    await page.goto("/laboratory/orders");
    await openOrder(page, LAB_IDS.open);
    await page.getByRole("button", { name: "Start processing" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Start processing" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Cannot move LABORATORY request from CANCELLED" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Selected record" })).toContainText("This order was cancelled");
  });

  test("released and cancelled orders offer no actions", async ({ page }) => {
    await stubLaboratoryApi(page);
    await page.goto("/laboratory/orders");
    for (const id of [LAB_IDS.released, LAB_IDS.cancelled]) {
      await openOrder(page, id);
      const record = page.getByRole("region", { name: "Selected record" });
      await expect(record.getByRole("button")).toHaveCount(0);
      await expect(record.getByRole("textbox")).toHaveCount(0);
    }
  });

  test("an empty queue explains how orders arrive", async ({ page }) => {
    await stubLaboratoryApi(page, { empty: true });
    await page.goto("/laboratory/orders");
    await expect(page.getByText("No orders are assigned to you")).toBeVisible();
    await expect(page.getByText("A MedNet administrator assigns laboratory requests to your account.")).toBeVisible();
  });
});

test.describe("laboratory access", () => {
  test("signed-out visitors get a sign-in prompt and no orders", async ({ page }) => {
    await stubLaboratoryApi(page, { signedOut: true });
    await page.goto("/laboratory/orders");
    await expect(page.getByRole("link", { name: "Go to sign in" })).toHaveAttribute("href", "/sign-in?redirect=%2Flaboratory%2Forders");
    await expect(page.getByText("Full blood count")).toHaveCount(0);
  });

  for (const [role, destination] of [
    ["PATIENT", /\/patient$/],
    ["ADMIN", /\/admin$/],
    ["HOME_CARE", /\/home-care$/],
  ] as const) {
    test(`a ${role} session is sent away and never loads orders`, async ({ page }) => {
      const log = await stubLaboratoryApi(page, { role });
      const partnerCalls: string[] = [];
      // Laboratory data only; a home-care session loads its own queue after the redirect.
      page.on("request", (request) => /\/partner\/(lab-results|service-requests\?type=LABORATORY)/.test(request.url()) && partnerCalls.push(request.url()));
      await page.goto("/laboratory");
      await expect(page).toHaveURL(destination);
      expect(partnerCalls).toEqual([]);
      expect(log.requests).toEqual([]);
    });
  }

  test("an expired session removes orders from the page", async ({ page }) => {
    const log = await stubLaboratoryApi(page);
    await page.goto("/laboratory/orders");
    await openOrder(page, LAB_IDS.processing);
    await expect(page.getByText("Fasting blood glucose").filter({ visible: true }).first()).toBeVisible();
    log.expireSession();
    await page.getByRole("region", { name: "Selected record" }).getByRole("textbox", { name: "Result" }).fill("x");
    await page.getByRole("button", { name: "Submit for doctor review" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Submit result" }).click();
    await expect(page.getByText("Your session has ended")).toBeVisible();
    await expect(page.getByText("Fasting blood glucose")).toHaveCount(0);
  });

  test("sign-out returns to sign-in", async ({ page }) => {
    const log = await stubLaboratoryApi(page);
    await page.goto("/laboratory");
    await page.getByRole("button", { name: "Account" }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    expect(log.requests).toContainEqual(expect.objectContaining({ method: "POST", path: "/auth/logout" }));
  });
});
