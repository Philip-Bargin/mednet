import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { HOME_CARE_IDS, stubHomeCareApi } from "./support/home-care-stub";

/**
 * Home-care workspace (Phase 5C) with the API stubbed in the browser: layout at 390/820/1440, WCAG
 * A/AA, every write with CSRF, server conflicts, access states and browser storage. The patient →
 * administrator → staff → patient workflow runs against the real API in home-care.live.spec.ts.
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

const reference = (id: string) => `HCR-${id.replaceAll("-", "").slice(0, 8).toUpperCase()}`;
const openVisit = (page: Page, id: string) =>
  page.getByRole("button", { name: `Open ${reference(id)}` }).filter({ visible: true }).click();
/** A visit time well in the future, as a datetime-local value. */
const futureVisit = () => new Date(Date.now() + 3 * 24 * 3_600_000).toISOString().slice(0, 13) + ":30";

const views = [
  { path: "/home-care", ready: "Home-care visits" },
  { path: "/home-care/visits", ready: "Wound dressing change" },
  { path: "/home-care/help", ready: "How do I contact the patient?" },
  { path: "/home-care/profile", ready: "What this account can do" },
];

test.describe("home-care workspace", () => {
  for (const { path, ready } of views) {
    test(`${path} fits the viewport and passes WCAG AA checks`, async ({ page }) => {
      await stubHomeCareApi(page);
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.getByText(ready).filter({ visible: true }).first()).toBeVisible();
      await expectNoHorizontalScroll(page);
      await expectComfortableTargets(page);
      await expectNoAxeViolations(page);
    });
  }

  test("the open visit detail fits and passes WCAG AA checks", async ({ page }) => {
    await stubHomeCareApi(page);
    await page.goto("/home-care/visits");
    await openVisit(page, HOME_CARE_IDS.unscheduled);
    const record = page.getByRole("region", { name: "Selected record" });
    await expect(record).toContainText("Sinkor, 12th Street, blue gate");
    await expectNoHorizontalScroll(page);
    await expectComfortableTargets(page);
    await expectNoAxeViolations(page);
  });

  test("overview counts come from the assigned requests and the sidebar names the workspace", async ({ page }) => {
    await stubHomeCareApi(page);
    await page.goto("/home-care");
    for (const label of ["Need a visit time", "Scheduled", "In progress", "Completed"]) {
      await expect(page.locator("main p").filter({ hasText: new RegExp(`^1\\s*${label}$`) }).first()).toBeVisible();
    }
    await expect(page.getByRole("navigation", { name: "Home-care workspace" })).toBeVisible();
  });

  test("scheduling validates, confirms, sends one request with CSRF and shows the visit time", async ({ page }) => {
    const log = await stubHomeCareApi(page);
    await page.goto("/home-care/visits");
    await openVisit(page, HOME_CARE_IDS.unscheduled);
    const record = page.getByRole("region", { name: "Selected record" });
    await expect(record.getByRole("button", { name: "Start visit" })).toHaveCount(0);
    await record.getByRole("button", { name: "Schedule visit" }).click();
    await expect(record.getByLabel("Visit date and time")).toBeFocused();
    await expect(record).toContainText("Choose the visit date and time.");
    expect(log.requests).toEqual([]);

    const when = futureVisit();
    await record.getByLabel("Visit date and time").fill(when);
    await record.getByRole("button", { name: "Schedule visit" }).click();
    await expect(page.getByRole("dialog")).toContainText("cannot be changed in MedNet afterwards");
    await page.getByRole("dialog").getByRole("button", { name: "Schedule visit" }).click();
    await expect(page.getByRole("status").filter({ hasText: "visit scheduled" })).toBeVisible();
    await expect(record.getByText("Visit scheduled").first()).toBeVisible();
    await expect(record.getByRole("button", { name: "Start visit" })).toBeVisible();
    expect(log.requests).toEqual([
      {
        method: "PATCH",
        path: `/partner/service-requests/${HOME_CARE_IDS.unscheduled}/schedule`,
        body: { scheduledAt: new Date(`${when}:00Z`).toISOString() },
        csrf: "test-token",
      },
    ]);
  });

  test("a past visit time is refused before anything is sent", async ({ page }) => {
    const log = await stubHomeCareApi(page);
    await page.goto("/home-care/visits");
    await openVisit(page, HOME_CARE_IDS.unscheduled);
    const record = page.getByRole("region", { name: "Selected record" });
    await record.getByLabel("Visit date and time").fill("2020-01-01T09:00");
    await record.getByRole("button", { name: "Schedule visit" }).click();
    await expect(record).toContainText("Choose a time in the future.");
    expect(log.requests).toEqual([]);
  });

  test("starting and completing a visit each ask first and send one request with CSRF", async ({ page }) => {
    const log = await stubHomeCareApi(page);
    await page.goto("/home-care/visits");
    await openVisit(page, HOME_CARE_IDS.scheduled);
    const record = page.getByRole("region", { name: "Selected record" });
    await record.getByRole("button", { name: "Start visit" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
    expect(log.requests).toEqual([]);
    await record.getByRole("button", { name: "Start visit" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Start visit" }).click();
    await expect(page.getByRole("status").filter({ hasText: "visit started" })).toBeVisible();
    await record.getByRole("button", { name: "Mark visit completed" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Mark completed" }).click();
    await expect(page.getByRole("status").filter({ hasText: "visit completed" })).toBeVisible();
    await expect(record.getByRole("button")).toHaveCount(0);
    expect(log.requests).toEqual([
      { method: "PATCH", path: `/partner/service-requests/${HOME_CARE_IDS.scheduled}/status`, body: { status: "IN_PROGRESS" }, csrf: "test-token" },
      { method: "PATCH", path: `/partner/service-requests/${HOME_CARE_IDS.scheduled}/status`, body: { status: "RESOLVED" }, csrf: "test-token" },
    ]);
  });

  test("a request cancelled elsewhere refreshes instead of pretending to start", async ({ page }) => {
    await stubHomeCareApi(page, { cancelledElsewhere: [HOME_CARE_IDS.scheduled] });
    await page.goto("/home-care/visits");
    await openVisit(page, HOME_CARE_IDS.scheduled);
    await page.getByRole("button", { name: "Start visit" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Start visit" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Cannot move HOME_CARE request from CANCELLED" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Selected record" })).toContainText("Do not visit.");
  });

  test("scheduling a request cancelled elsewhere explains why and shows it cancelled", async ({ page }) => {
    await stubHomeCareApi(page, { cancelledElsewhere: [HOME_CARE_IDS.unscheduled] });
    await page.goto("/home-care/visits");
    await openVisit(page, HOME_CARE_IDS.unscheduled);
    const record = page.getByRole("region", { name: "Selected record" });
    await record.getByLabel("Visit date and time").fill(futureVisit());
    await record.getByRole("button", { name: "Schedule visit" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Schedule visit" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Only unscheduled open home-care requests can be scheduled" })).toBeVisible();
    await expect(record).toContainText("Do not visit.");
    await expect(record.getByLabel("Visit date and time")).toHaveCount(0);
  });

  test("opening a request moves focus to its details, which scroll into view on small screens", async ({ page }) => {
    await stubHomeCareApi(page);
    await page.goto("/home-care/visits");
    await expect(page.getByText("Wound dressing change").filter({ visible: true }).first()).toBeVisible();
    // Nothing is focused or scrolled on arrival.
    await expect(page.getByRole("heading", { name: reference(HOME_CARE_IDS.unscheduled) })).toHaveCount(0);
    for (const id of [HOME_CARE_IDS.unscheduled, HOME_CARE_IDS.completed]) {
      await openVisit(page, id);
      const heading = page.getByRole("region", { name: "Selected record" }).getByRole("heading", { name: reference(id) });
      await expect(heading).toBeFocused();
      await expect(heading).toBeInViewport();
    }
  });

  test("completed and cancelled requests offer no actions", async ({ page }) => {
    await stubHomeCareApi(page);
    await page.goto("/home-care/visits");
    for (const id of [HOME_CARE_IDS.completed, HOME_CARE_IDS.cancelled]) {
      await openVisit(page, id);
      const record = page.getByRole("region", { name: "Selected record" });
      await expect(record.getByRole("button")).toHaveCount(0);
      await expect(record.getByRole("textbox")).toHaveCount(0);
    }
  });

  test("an empty queue explains how requests arrive", async ({ page }) => {
    await stubHomeCareApi(page, { empty: true });
    await page.goto("/home-care/visits");
    await expect(page.getByText("No home-care requests are assigned to you")).toBeVisible();
    await expect(page.getByText("A MedNet administrator assigns patients' home-care requests to your account.")).toBeVisible();
  });

  test("nothing about a request is kept in browser storage", async ({ page }) => {
    await stubHomeCareApi(page);
    await page.goto("/home-care/visits");
    await openVisit(page, HOME_CARE_IDS.unscheduled);
    await expect(page.getByRole("region", { name: "Selected record" })).toContainText("Wound dressing change");
    const stored = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
    expect(stored).not.toMatch(/Wound|Sinkor|HCR-|4e1d2c3b/);
  });
});

test.describe("home-care access", () => {
  test("signed-out visitors get a sign-in prompt and no requests", async ({ page }) => {
    await stubHomeCareApi(page, { signedOut: true });
    await page.goto("/home-care/visits");
    await expect(page.getByRole("link", { name: "Go to sign in" })).toHaveAttribute("href", "/sign-in?redirect=%2Fhome-care%2Fvisits");
    await expect(page.getByText("Wound dressing change")).toHaveCount(0);
  });

  for (const [role, destination] of [
    ["PATIENT", /\/patient$/],
    ["LABORATORY", /\/laboratory$/],
    ["ADMIN", /\/admin$/],
  ] as const) {
    test(`a ${role} session is sent away and never loads home-care requests`, async ({ page }) => {
      const log = await stubHomeCareApi(page, { role });
      const homeCareCalls: string[] = [];
      page.on("request", (request) => request.url().includes("type=HOME_CARE") && homeCareCalls.push(request.url()));
      await page.goto("/home-care");
      await expect(page).toHaveURL(destination);
      expect(homeCareCalls).toEqual([]);
      expect(log.requests).toEqual([]);
    });
  }

  test("an expired session removes requests from the page", async ({ page }) => {
    const log = await stubHomeCareApi(page);
    await page.goto("/home-care/visits");
    await openVisit(page, HOME_CARE_IDS.scheduled);
    await expect(page.getByText("Paynesville, Red Light area").filter({ visible: true }).first()).toBeVisible();
    log.expireSession();
    await page.getByRole("button", { name: "Start visit" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Start visit" }).click();
    await expect(page.getByText("Your session has ended")).toBeVisible();
    await expect(page.getByText("Paynesville, Red Light area")).toHaveCount(0);
    await expect(page.getByText("Blood pressure check")).toHaveCount(0);
  });

  test("sign-out returns to sign-in", async ({ page }) => {
    const log = await stubHomeCareApi(page);
    await page.goto("/home-care");
    await page.getByRole("button", { name: "Account" }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    expect(log.requests).toContainEqual(expect.objectContaining({ method: "POST", path: "/auth/logout" }));
  });
});
