import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function openShowcase(page: Page) {
  await page.goto("/foundation");
  await page.addStyleTag({ content: "html{scroll-behavior:auto!important}" });
}

test.describe("component showcase layout", () => {
  test("has no horizontal scroll and no clipped controls", async ({ page }) => {
    await openShowcase(page);
    const report = await page.evaluate(() => {
      const viewport = document.documentElement.clientWidth;
      const overflow = document.documentElement.scrollWidth - viewport;
      const clipped = [...document.querySelectorAll<HTMLElement>("main button, main a, main [role=status], main td, main dd")]
        .filter((el) => el.offsetParent !== null && !el.closest("[hidden]") && !el.matches(".sr-only, .sr-only *"))
        .filter((el) => el.scrollWidth - el.clientWidth > 1 && getComputedStyle(el).overflowX !== "visible")
        .map((el) => el.textContent?.trim().slice(0, 40));
      const outside = [...document.querySelectorAll<HTMLElement>("main *")]
        .filter((el) => {
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.right > viewport + 1 && !el.closest("[hidden], dialog, .sr-only") && !el.matches(".sr-only");
        })
        .map((el) => `${el.tagName}.${String(el.className).slice(0, 40)}`);
      return { overflow, clipped, outside: outside.slice(0, 5) };
    });
    expect(report.overflow).toBeLessThanOrEqual(0);
    expect(report.clipped).toEqual([]);
    expect(report.outside).toEqual([]);
  });

  test("meets target sizes: 44px buttons and fields, 40px professional controls", async ({ page }) => {
    await openShowcase(page);
    const heights = await Promise.all([
      page.getByRole("button", { name: "Primary action" }).boundingBox(),
      page.getByRole("button", { name: "Small (professional)" }).boundingBox(),
      page.getByRole("textbox", { name: /Patient name/ }).boundingBox(),
      page.getByRole("button", { name: "Search", exact: true }).boundingBox(),
    ]);
    expect(heights[0]!.height).toBeGreaterThanOrEqual(44);
    expect(heights[1]!.height).toBeGreaterThanOrEqual(40);
    expect(heights[2]!.height).toBeGreaterThanOrEqual(44);
    expect(Math.min(heights[3]!.width, heights[3]!.height)).toBeGreaterThanOrEqual(40);
  });

  test("tables switch to stacked rows below 768px", async ({ page }) => {
    await openShowcase(page);
    const width = page.viewportSize()!.width;
    const table = page.getByRole("table", { name: "Laboratory order queue" });
    const stacked = page.getByRole("list", { name: "Laboratory order queue" });
    if (width < 768) {
      await expect(table).toBeHidden();
      await expect(stacked).toBeVisible();
    } else {
      await expect(table).toBeVisible();
      await expect(stacked).toBeHidden();
    }
  });
});

test.describe("component behaviour in a real browser", () => {
  test("form validation marks invalid fields and clears when fixed", async ({ page }) => {
    await openShowcase(page);
    await page.getByRole("button", { name: "Review details" }).click();
    const name = page.getByRole("textbox", { name: /Patient name/ });
    await expect(name).toHaveAttribute("aria-invalid", "true");
    await expect(name).toHaveAccessibleDescription(/Enter the patient name/);
    await expect(page.getByRole("textbox", { name: /Mobile number/ })).toHaveAccessibleDescription("Enter a complete mobile number.");

    await name.fill("James Brown");
    await page.getByRole("textbox", { name: /Mobile number/ }).fill("+231 770 000 000");
    await page.getByRole("combobox", { name: /Specialty/ }).selectOption("general");
    await page.getByRole("button", { name: "Review details" }).click();
    await expect(name).not.toHaveAttribute("aria-invalid");
    await expect(page.getByText("Details look complete.")).toBeVisible();
  });

  test("keyboard focus is visible with the 3px action ring", async ({ page }) => {
    await openShowcase(page);
    await page.getByRole("button", { name: "Primary action" }).focus();
    await page.keyboard.press("Tab");
    // Poll: the colour transition on buttons also eases the outline colour in (~150ms).
    await expect
      .poll(() =>
        page.evaluate(() => {
          const style = getComputedStyle(document.activeElement!);
          return { width: style.outlineWidth, style: style.outlineStyle, color: style.outlineColor };
        }),
      )
      .toEqual({ width: "3px", style: "solid", color: "rgb(20, 116, 83)" });
  });

  test("dialog traps focus, closes on Escape and returns focus", async ({ page }) => {
    await openShowcase(page);
    const trigger = page.getByRole("button", { name: "Open dialog" });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Prepare for your visit" });
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 4; i += 1) await page.keyboard.press("Tab");
    expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("confirmation dialog starts on Cancel so Enter cannot confirm by accident", async ({ page }) => {
    await openShowcase(page);
    await page.getByRole("button", { name: "Suspend selected account" }).click();
    const dialog = page.getByRole("dialog", { name: "Suspend this account?" });
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(dialog).toBeHidden();
  });

  test("drawer opens as a labelled dialog", async ({ page }) => {
    await openShowcase(page);
    await page.getByRole("button", { name: "Open detail drawer" }).click();
    const drawer = page.getByRole("dialog", { name: "Order LAB-1042" });
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText("Complete blood count");
    await drawer.getByRole("button", { name: "Close" }).first().click();
    await expect(drawer).toBeHidden();
  });

  test("menu works with the keyboard", async ({ page }) => {
    await openShowcase(page);
    const trigger = page.getByRole("button", { name: "Escalate to…" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menuitem", { name: "Administration" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitem", { name: "Finance" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Selected: Finance")).toBeVisible();
    // Disabled items stay reachable (aria-disabled) but do nothing when activated.
    await trigger.focus();
    await page.keyboard.press("ArrowUp");
    await expect(page.getByRole("menuitem", { name: /Clinical review/ })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
  });

  test("toast announces success and can be dismissed", async ({ page }) => {
    await openShowcase(page);
    await page.getByRole("button", { name: "Show success toast" }).click();
    const toast = page.locator("[data-toast]").filter({ hasText: "Action recorded" });
    await expect(toast).toBeVisible();
    await toast.getByRole("button", { name: "Dismiss notification" }).click();
    await expect(toast).toBeHidden();
  });

  test("filters narrow the table and update the count", async ({ page }) => {
    await openShowcase(page);
    await page.getByRole("searchbox", { name: "Search orders" }).fill("glucose");
    await expect(page.getByText("1 of 4 orders")).toBeVisible();
    await page.getByRole("button", { name: "Remove filter: Search: glucose" }).click();
    await expect(page.getByText("4 of 4 orders")).toBeVisible();
  });
});

test.describe("accessibility review regressions", () => {
  test("dialog stays open when a press starts inside it and ends on the backdrop", async ({ page }) => {
    await openShowcase(page);
    await page.getByRole("button", { name: "Open dialog" }).click();
    const dialog = page.getByRole("dialog", { name: "Prepare for your visit" });
    const box = (await dialog.boundingBox())!;
    await page.mouse.move(box.x + 40, box.y + 40);
    await page.mouse.down();
    await page.mouse.move(4, 4);
    await page.mouse.up();
    await expect(dialog).toBeVisible();
    await page.mouse.click(4, 4);
    await expect(dialog).toBeHidden();
  });

  test("dismissing a toast from the keyboard returns focus", async ({ page }) => {
    await openShowcase(page);
    const trigger = page.getByRole("button", { name: "Show success toast" });
    await trigger.click();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Dismiss notification" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(trigger).toBeFocused();
  });

  test("rail navigation shows a visible label on keyboard focus below 1200px", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "wide", "the full sidebar shows labels at 1440px");
    await page.goto("/foundation/workspace/patient");
    await page.getByRole("link", { name: "Skip to content" }).focus();
    await page.keyboard.press("Tab"); // wordmark
    await page.keyboard.press("Tab"); // Overview
    const label = page.locator("aside a:focus-visible > span[aria-hidden]").last();
    await expect(label).toBeVisible();
    await expect(label).toHaveText("Overview");
  });

  test("focus ring on the dark sidebar uses the light ring colour", async ({ page }) => {
    await page.goto("/foundation/workspace/patient");
    await page.getByRole("link", { name: "Skip to content" }).focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.activeElement!).outlineColor))
      .toBe("rgb(220, 239, 231)");
  });
});

test.describe("accessibility scan", () => {
  test("showcase has no axe violations (WCAG 2.2 A/AA)", async ({ page }) => {
    await openShowcase(page);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .exclude("nextjs-portal")
      .analyze();
    const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} — ${v.nodes[0]?.target.join(" ")}`);
    expect(summary).toEqual([]);
  });
});
