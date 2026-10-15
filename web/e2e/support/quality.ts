import { expect, type Page } from "@playwright/test";

/**
 * Page-level quality checks shared by the Phase 5E sweep (`audit.spec.ts`) and its self-test
 * (`audit-self-test.spec.ts`). `inspect` runs inside the page via `page.evaluate`, so it must stay
 * self-contained (no imports or outer variables).
 */

/** Wait until the page has rendered its data (no spinner, skeleton or "Loading" status left). */
export async function settle(page: Page) {
  await expect(page.locator("main").first()).toBeVisible();
  await expect(page.locator('[aria-busy="true"], [data-skeleton]')).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByRole("status").filter({ hasText: /^Loading/ })).toHaveCount(0, { timeout: 15_000 });
}

/** Page structure, overflow, clipping, link targets and target sizes, gathered in one pass in the page. */
export function inspect() {
  const visible = (el: Element) => {
    const box = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return box.width > 0 && box.height > 0 && style.visibility !== "hidden" && !el.closest("[hidden], [inert], [aria-hidden=true]");
  };
  const label = (el: Element) =>
    (el.getAttribute("aria-label") || (el as HTMLElement).innerText || el.getAttribute("title") || el.tagName).trim().replace(/\s+/g, " ").slice(0, 50);

  const mains = [...document.querySelectorAll("main")].filter(visible).length;
  const h1s = document.querySelectorAll("h1").length;

  const links = [...document.querySelectorAll<HTMLAnchorElement>("a[href]")]
    .map((a) => a.getAttribute("href") ?? "")
    .filter((href) => href.startsWith("/") || href === "" || href === "#");

  // A target smaller than 24×24 fails SC 2.5.8 unless it is a link inside a sentence, or a 24px circle
  // centred on it overlaps no other target (the spacing exception).
  const targets = [...document.querySelectorAll<HTMLElement>("a[href], button, input:not([type=hidden]), select, textarea, [role=tab], [role=switch], summary")].filter(visible);
  const spaced = (el: HTMLElement) => {
    const box = el.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    return targets.every((other) => {
      if (other === el || other.contains(el) || el.contains(other)) return true;
      const o = other.getBoundingClientRect();
      const dx = Math.max(o.left - cx, 0, cx - o.right);
      const dy = Math.max(o.top - cy, 0, cy - o.bottom);
      return Math.hypot(dx, dy) >= 12;
    });
  };
  const small = targets
    .filter((el) => {
      const box = el.getBoundingClientRect();
      if (box.width >= 24 && box.height >= 24) return false;
      if (spaced(el)) return false;
      if (el.tagName === "A" && getComputedStyle(el).display === "inline" && el.parentElement?.closest("p, li, dd, td")) return false;
      // Native radios and checkboxes take their target size from the wrapping label.
      if (el instanceof HTMLInputElement && (el.type === "radio" || el.type === "checkbox")) {
        const host = el.closest("label")?.getBoundingClientRect();
        if (host && host.width >= 24 && host.height >= 24) return false;
      }
      // The sr-only "Skip to content" link is 1px until focused.
      if (el.matches(".sr-only, [class*=sr-only]")) return false;
      return true;
    })
    .map((el) => `${label(el)} (${Math.round(el.getBoundingClientRect().width)}×${Math.round(el.getBoundingClientRect().height)})`);

  // Text cut off by an overflow box. An intentional ellipsis must keep the full text available.
  const clipped = [...document.querySelectorAll<HTMLElement>("body *")]
    .filter((el) => el.children.length === 0 && (el.textContent ?? "").trim().length > 0 && visible(el))
    .filter((el) => {
      const style = getComputedStyle(el);
      const hides = ["hidden", "clip"].includes(style.overflowX) || ["hidden", "clip"].includes(style.overflow);
      if (!hides || el.scrollWidth <= el.clientWidth + 1) return false;
      if (el.matches(".sr-only, [class*=sr-only]")) return false;
      const fullTextAvailable = el.title || el.getAttribute("aria-label") || el.closest("[title], [aria-label]");
      return !(style.textOverflow === "ellipsis" && fullTextAvailable);
    })
    .map((el) => `${label(el)} (${el.scrollWidth}>${el.clientWidth})`);

  return {
    mains,
    h1s,
    title: document.title,
    lang: document.documentElement.lang,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    links,
    small,
    clipped,
  };
}

/** Tab through the page; every stop must be visible, unhidden and show a focus indicator. */
export async function keyboardWalk(page: Page, limit = 120) {
  // Smooth scrolling would still be animating when the focused control is measured.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator("body").focus();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const problems: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < limit; i++) {
    await page.keyboard.press("Tab");
    const stop = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      if (el.tagName === "NEXTJS-PORTAL") return { key: "dev-overlay", skip: true, name: "", hidden: false, offscreen: false, indicator: true };
      const box = el.getBoundingClientRect();
      const key = `${el.tagName}|${el.id}|${el.getAttribute("href")}|${el.getAttribute("aria-label")}|${Math.round(box.x)},${Math.round(box.y + window.scrollY)}`;
      const name = (el.getAttribute("aria-label") || el.innerText || el.getAttribute("placeholder") || el.tagName).trim().replace(/\s+/g, " ").slice(0, 50);
      const hidden = !!el.closest("[hidden], [inert], [aria-hidden=true]") || getComputedStyle(el).visibility === "hidden";
      const offscreen = box.width === 0 || box.height === 0 || box.bottom < 0 || box.top > window.innerHeight || box.right < 0 || box.left > window.innerWidth;
      // A ring on the element itself or on a wrapper that styles :has(:focus-visible).
      const ringed = (node: Element | null) => {
        if (!node) return false;
        const s = getComputedStyle(node);
        return (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) >= 2) || (s.boxShadow !== "none" && s.boxShadow !== "");
      };
      let indicator = false;
      for (let node: Element | null = el, depth = 0; node && depth < 4 && !indicator; node = node.parentElement, depth++) indicator = ringed(node);
      return { key, name, hidden, offscreen, indicator };
    });
    if (!stop) {
      if (i > 0) break; // left the document: the walk is complete
      continue;
    }
    if ("skip" in stop) continue; // next dev's overlay button, absent from production builds
    if (seen.has(stop.key)) break; // wrapped around
    seen.add(stop.key);
    if (stop.hidden) problems.push(`focus on hidden content: ${stop.name}`);
    if (stop.offscreen) problems.push(`focused control not scrolled into view: ${stop.name}`);
    if (!stop.indicator) problems.push(`no visible focus indicator: ${stop.name}`);
  }
  return { problems, stops: seen.size };
}
