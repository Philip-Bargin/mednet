import { expect, test, type Locator } from "@playwright/test";

/**
 * Design fidelity: computed styles of implemented components compared with values measured
 * from the approved Figma reference on 2026-10-10 (see docs/DESIGN_SYSTEM.md §12).
 * Documented deviations are asserted as the approved token values, not the raw reference value.
 */
// Measured at the reference's 1440px desktop width; run once, in the "wide" project.

async function styles(locator: Locator, props: string[]) {
  return locator.evaluate(
    (el, keys) => Object.fromEntries(keys.map((key) => [key, getComputedStyle(el).getPropertyValue(key)])),
    props,
  );
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "wide", "desktop fidelity check");
  await page.goto("/foundation");
});

test("primary button matches the reference", async ({ page }) => {
  const button = page.getByRole("button", { name: "Primary action" });
  expect(await styles(button, ["background-color", "color", "font-size", "font-weight", "padding-left", "border-radius"])).toEqual({
    "background-color": "rgb(20, 116, 83)",
    color: "rgb(255, 255, 255)",
    "font-size": "15px",
    "font-weight": "700",
    "padding-left": "20px",
    "border-radius": "8px", // reference 9px → approved 8px token
  });
  expect((await button.boundingBox())!.height).toBe(44);
});

test("secondary and destructive buttons match the reference borders and text", async ({ page }) => {
  expect(await styles(page.getByRole("button", { name: "Secondary", exact: true }), ["border-top-color", "color", "background-color"])).toEqual({
    "border-top-color": "rgb(185, 210, 200)",
    color: "rgb(18, 96, 72)",
    "background-color": "rgb(255, 255, 255)",
  });
  expect(await styles(page.getByRole("button", { name: "Cancel appointment" }), ["border-top-color", "color"])).toEqual({
    "border-top-color": "rgb(224, 183, 183)",
    color: "rgb(168, 67, 67)",
  });
  expect(await styles(page.getByRole("button", { name: "Disabled" }), ["opacity"])).toEqual({ opacity: "0.42" });
});

test("status badges match the reference pills", async ({ page }) => {
  const confirmed = page.locator("#badges-alerts").getByText("Confirmed", { exact: true }).first().locator("..");
  expect(await styles(confirmed, ["background-color", "color", "font-size", "font-weight", "border-radius"])).toEqual({
    "background-color": "rgb(237, 247, 243)",
    color: "rgb(18, 96, 72)",
    "font-size": "12px",
    "font-weight": "700",
    "border-radius": "999px",
  });
  expect((await confirmed.boundingBox())!.height).toBe(28);
  const review = page.locator("#badges-alerts").getByText("Doctor review", { exact: true }).first().locator("..");
  expect(await styles(review, ["background-color", "color"])).toEqual({
    "background-color": "rgb(251, 241, 221)",
    color: "rgb(148, 91, 23)",
  });
});

test("alerts match the reference tones and padding", async ({ page }) => {
  const alertBox = (text: string) => page.locator("#badges-alerts div.rounded-sm").filter({ hasText: text }).first();
  const info = alertBox("Your appointment time is shown");
  expect(await styles(info, ["background-color", "color", "padding-top", "border-radius"])).toEqual({
    "background-color": "rgb(232, 242, 246)",
    color: "rgb(51, 106, 130)",
    "padding-top": "14px",
    "border-radius": "8px", // reference 9px → approved 8px token
  });
  const critical = alertBox("Connection interrupted");
  expect(await styles(critical, ["background-color", "color"])).toEqual({
    "background-color": "rgb(249, 234, 234)",
    color: "rgb(168, 67, 67)",
  });
});

test("text fields match the reference control", async ({ page }) => {
  const input = page.getByRole("textbox", { name: /Patient name/ });
  expect(await styles(input, ["border-top-color", "border-radius", "padding-left", "background-color"])).toEqual({
    "border-top-color": "rgb(133, 146, 140)", // reference #aebbb5 darkened to meet 3:1 (deviation 10)
    "border-radius": "8px",
    "padding-left": "12px",
    "background-color": "rgb(255, 255, 255)",
  });
  expect((await input.boundingBox())!.height).toBeGreaterThanOrEqual(44);
});

test("cards match the reference panel", async ({ page }) => {
  const card = page.locator("#healthcare section").filter({ hasText: "Next appointment" }).first();
  const { "box-shadow": shadow, ...rest } = await styles(card, ["border-radius", "padding-top", "border-top-color", "box-shadow", "background-color"]);
  expect(rest).toEqual({
    "border-radius": "12px",
    "padding-top": "24px",
    "border-top-color": "rgb(220, 228, 224)",
    "background-color": "rgb(255, 255, 255)",
  });
  // Tailwind prefixes transparent ring layers; the visible layer must be the reference shadow.
  expect(shadow).toContain("rgba(15, 49, 38, 0.05) 0px 1px 2px 0px");
  const title = card.getByRole("heading", { name: "Today at 2:30 PM" });
  expect(await styles(title, ["font-size", "font-weight"])).toEqual({ "font-size": "21px", "font-weight": "400" });
});

test("welcome band and avatar match the reference", async ({ page }) => {
  const band = page.locator("#cards section").filter({ hasText: "Everything is ready" }).first();
  expect(await styles(band, ["background-color", "color"])).toEqual({
    "background-color": "rgb(16, 76, 59)",
    color: "rgb(255, 255, 255)",
  });
  const avatar = page.locator("#healthcare article").first().locator("span[aria-hidden]").first();
  expect(await styles(avatar, ["background-color", "color", "border-radius"])).toEqual({
    "background-color": "rgb(220, 239, 231)",
    color: "rgb(16, 76, 59)",
    "border-radius": "999px",
  });
  expect((await avatar.boundingBox())!.width).toBe(50);
});

test("activity row titles use the reference's 16px bold (Phase 5E)", async ({ page }) => {
  // Measured on the reference dashboards: "Visit summary", "Reply to your doctor", "Laboratory result" are 16px/700.
  const title = page.getByText("Provider onboarding review", { exact: true });
  expect(await styles(title, ["font-size", "font-weight"])).toEqual({ "font-size": "16px", "font-weight": "700" });
});

test("audit event titles use the reference's 16px bold (Phase 5E)", async ({ page }) => {
  // Reference super-administrator "Recent access events": "Role assignment changed" is 16px/700.
  const title = page.getByText("Role assignment changed", { exact: true }).first();
  expect(await styles(title, ["font-size", "font-weight"])).toEqual({ "font-size": "16px", "font-weight": "700" });
});

test("table cells are vertically centred like the reference order queue (Phase 5E)", async ({ page }) => {
  const cell = page.locator("table tbody td").first();
  expect(await styles(cell, ["vertical-align"])).toEqual({ "vertical-align": "middle" });
});
