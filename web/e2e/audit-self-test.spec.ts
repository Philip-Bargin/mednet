import { expect, test } from "@playwright/test";
import { inspect, keyboardWalk } from "./support/quality";

/**
 * The Phase 5E sweep passes every route, so prove its checks can fail: a page with one planted defect
 * of each kind must be reported, and the same page without them must not be.
 */
const page = (defects: boolean) => `<!doctype html>
<html lang="en"><head><title>Self-test</title><style>
  body { font: 16px sans-serif; margin: 24px; }
  :focus-visible { outline: 3px solid green; outline-offset: 2px; }
  .plain:focus-visible { outline: none; }
  .row { display: flex; gap: 2px; }
  .tiny { width: 16px; height: 16px; padding: 0; }
  .cut { display: block; width: 60px; overflow: hidden; white-space: nowrap; }
</style></head><body>
<main><h1>Self-test</h1>
  <p>Read <a href="/about">About</a>.</p>
  ${defects ? `
  <p>A <a href="/no-such-route">dead link</a>.</p>
  <div class="row"><button class="tiny" aria-label="First"></button><button class="tiny" aria-label="Second"></button></div>
  <span class="cut">A label far too long for its box</span>
  <button class="plain">No ring</button>
  <div aria-hidden="true"><button>Hidden but focusable</button></div>` : ""}
</main></body></html>`;

test.describe("quality sweep self-test", () => {
  test.skip(({ viewport }) => viewport?.width !== 1440, "layout-independent; runs once");

  test("reports each planted defect", async ({ page: p }) => {
    await p.setContent(page(true));
    const found = await p.evaluate(inspect);
    expect(found.links).toContain("/no-such-route");
    expect(found.small).toEqual(["First (16×16)", "Second (16×16)"]);
    expect(found.clipped).toEqual([expect.stringContaining("A label far too long")]);
    const walk = await keyboardWalk(p);
    expect(walk.problems).toContain("no visible focus indicator: No ring");
    expect(walk.problems).toContain("focus on hidden content: Hidden but focusable");
  });

  test("passes the same page without them", async ({ page: p }) => {
    await p.setContent(page(false));
    const found = await p.evaluate(inspect);
    expect(found).toMatchObject({ mains: 1, h1s: 1, lang: "en", small: [], clipped: [], links: ["/about"] });
    expect((await keyboardWalk(p)).problems).toEqual([]);
  });
});
