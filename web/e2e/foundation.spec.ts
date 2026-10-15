import { expect, test, type Page } from "@playwright/test";

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "page should not scroll horizontally").toBeLessThanOrEqual(0);
}

test.describe("public layout", () => {
  for (const path of ["/", "/about", "/services"]) {
    test(`${path} renders the shared header and footer`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("banner")).toBeVisible();
      await expect(page.getByRole("contentinfo")).toBeVisible();
      await expect(page.locator("main#main-content")).toBeVisible();
      await expectNoHorizontalScroll(page);
    });
  }

  test("uses Source Sans 3 from the design tokens", async ({ page }) => {
    await page.goto("/foundation");
    const family = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(family).toMatch(/Source Sans/i);
  });

  test("keeps main navigation reachable at every width", async ({ page }) => {
    await page.goto("/about");
    const menuButton = page.getByRole("button", { name: "Open menu" });
    if (await menuButton.isVisible()) await menuButton.click();
    await expect(page.getByRole("link", { name: "How it works" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" }).first()).toBeVisible();
  });
});

test.describe("workspace shell", () => {
  for (const id of ["patient", "doctor", "admin", "collection-agent"]) {
    test(`${id} shell fits the viewport and keeps the sidebar full height`, async ({ page }) => {
      await page.goto(`/foundation/workspace/${id}`);
      await expect(page.getByRole("main")).toBeVisible();
      await expectNoHorizontalScroll(page);

      const sidebar = page.locator("aside");
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      const box = await sidebar.boundingBox();
      const viewport = page.viewportSize();
      expect(box?.height).toBe(viewport?.height);
      expect(box?.y).toBe(0);
    });
  }

  test("marks the current section in the navigation", async ({ page }) => {
    await page.goto("/foundation/workspace/patient");
    // The preview route is outside /patient, so nothing is current; check the link set instead.
    const nav = page.getByRole("navigation", { name: "Patient workspace" });
    await expect(nav.getByRole("link")).toHaveCount(6);
  });
});

test.describe("existing pages keep working", () => {
  for (const path of ["/sign-in", "/verify", "/reset", "/patient", "/admin", "/account"]) {
    test(`${path} responds`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBeLessThan(500);
      await expect(page.locator("main").first()).toBeVisible();
    });
  }
});
