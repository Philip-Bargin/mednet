import { expect, test, type Locator, type Page } from "@playwright/test";
import { stubAdminApi } from "./support/admin-stub";
import { stubPatientApi } from "./support/patient-stub";

/**
 * Phase 5E keyboard-only workflows. The component showcase proves the primitives; these drive real
 * workspace flows with the keyboard alone: a dialog's first focus, focus staying inside it, Escape,
 * focus returning to the control that opened it, the account menu and form errors.
 */
/**
 * A modal `<dialog>` makes the page behind it inert. Tab past its last control may leave for the
 * browser's own toolbar (the document then reports `body` as active), which is the platform's
 * behaviour and not a trap; focus must never reach page content behind the dialog.
 */
async function expectFocusTrapped(page: Page, dialog: Locator) {
  const stops: string[] = [];
  for (const key of ["Tab", "Tab", "Tab", "Tab", "Tab", "Tab", "Shift+Tab", "Shift+Tab", "Shift+Tab", "Shift+Tab"]) {
    await page.keyboard.press(key);
    const where = await dialog.evaluate((el) => {
      const active = document.activeElement;
      if (!active || active === document.body) return "browser";
      return el.contains(active) ? "dialog" : `page: ${active.tagName} ${(active.textContent ?? "").trim().slice(0, 40)}`;
    });
    stops.push(where);
  }
  expect(stops.filter((stop) => stop.startsWith("page"))).toEqual([]);
  expect(stops).toContain("dialog");
}

test.describe("keyboard-only workflows", () => {
  test("patient cancels an appointment with the keyboard", async ({ page }) => {
    const log = await stubPatientApi(page);
    await page.goto("/patient/appointments");
    const trigger = page.getByRole("button", { name: "Cancel appointment with Dr. Mariama Cole" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Cancel this appointment?" });
    // The safe choice comes first, so a stray Enter does not cancel.
    await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
    await expectFocusTrapped(page, dialog);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    expect(log.requests.filter((r) => r.method === "PATCH")).toEqual([]);

    await page.keyboard.press("Enter");
    await dialog.getByRole("button", { name: "Cancel appointment" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status").filter({ hasText: "Appointment cancelled" })).toBeVisible();
    expect(log.requests).toContainEqual({ method: "PATCH", path: "/appointments/apt-next", body: { action: "CANCEL" }, csrf: "test-token" });
  });

  test("super administrator opens a record and backs out of a high-impact action", async ({ page }) => {
    const log = await stubAdminApi(page);
    await page.goto("/admin/users");
    await page.getByRole("button", { name: "Open Peer Administrator" }).filter({ visible: true }).focus();
    await page.keyboard.press("Enter");
    const record = page.getByRole("region", { name: "Selected record" });
    // Choosing a record moves focus to its details.
    await expect(record.getByRole("heading", { level: 3 })).toBeFocused();
    const suspend = record.getByRole("button", { name: "Suspend account" });
    await suspend.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
    await expectFocusTrapped(page, dialog);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(suspend).toBeFocused();
    expect(log.requests).toEqual([]);
  });

  test("the account menu opens, moves and closes with the keyboard", async ({ page }) => {
    await stubPatientApi(page);
    await page.goto("/patient");
    const button = page.getByRole("button", { name: "Account" });
    await button.focus();
    await page.keyboard.press("Enter");
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem").first()).toBeFocused();
    await page.keyboard.press("ArrowDown");
    expect(await menu.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(button).toBeFocused();
  });

  test("form errors are announced, linked to their fields and focused", async ({ page }) => {
    await stubPatientApi(page, { noProfile: true });
    await page.goto("/patient/profile");
    await page.getByRole("button", { name: "Save profile" }).focus();
    await page.keyboard.press("Enter");
    const name = page.getByLabel("Full name");
    await expect(name).toBeFocused();
    await expect(name).toHaveAttribute("aria-invalid", "true");
    const describedBy = (await name.getAttribute("aria-describedby")) ?? "";
    expect(describedBy).not.toBe("");
    const message = await page.evaluate((ids) => ids.split(" ").map((id) => document.getElementById(id)?.textContent ?? "").join(" "), describedBy);
    expect(message.trim()).not.toBe("");
  });
});
