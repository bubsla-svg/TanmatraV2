import { test, expect, type Page } from "@playwright/test";

/**
 * Core Web Vitals on the three browse-path routes (plan item 3.1).
 *
 * WHAT 3.1 TURNED OUT TO BE. Measured against a local production build with
 * `API_BASE_URL` pointed at the live API, on a Pixel 7 profile with a cold
 * cache, five runs per route:
 *
 *     /                     TTFB 364   FCP 536   LCP 592-616   CLS 0
 *     /menu                 TTFB 735   FCP 904   LCP 904-924   CLS 0
 *     /dish/[slug]          TTFB 426   FCP 548   LCP 548-552   CLS 0
 *
 * Every LCP is inside Google's 2500 ms "good" band with room to spare, and
 * those numbers INCLUDE ~390 ms of cross-continent API latency that production
 * does not pay (its storefront and api run in the same region). CLS is a clean
 * zero on all three. There was no LCP or CLS defect to fix.
 *
 * So the deliverable is not an optimisation, it is this: the good state,
 * written down and checked, so it cannot rot quietly. An unsized image or a
 * font swap that pushes content around does not fail any existing test — the
 * page still renders, every assertion still passes, and the only symptom is a
 * number nobody is measuring.
 *
 * WHY CLS BLOCKS AND LCP DOES NOT. CLS is a ratio of layout movement to
 * viewport, so it is close to machine-independent: a CI runner and a phone
 * disagree about how FAST an element arrived, not about whether it shoved the
 * page. LCP is wall-clock and moves with whatever else the runner is doing —
 * a threshold tight enough to catch a real regression would flake on a noisy
 * box, and a gate that flakes gets disabled, taking the CLS check with it.
 * LCP is therefore recorded into the run output for a human to read, and only
 * an absurd ceiling (10 s) fails, which catches a page that has stopped
 * rendering rather than one that got slower.
 *
 * NOTE ON CI's NUMBERS: the e2e job serves the built app with no API, so
 * `fetchMenu()` falls back to the static catalog and TTFB is BETTER than
 * production. That is fine for what this spec is for — it is a regression
 * detector for layout stability, not a production performance measurement.
 */

/** Google's "good" threshold. We currently measure 0 on every route. */
const CLS_BUDGET = 0.1;
/** Not a performance target — a "did this page stop rendering" ceiling. */
const LCP_CEILING_MS = 10_000;

interface Vitals {
  lcp: number;
  lcpElement: string | null;
  cls: number;
  ttfb: number | null;
  shifts: { value: number; sources: string[] }[];
}

/**
 * Collect after the page has settled. The 2.5 s window is deliberately longer
 * than the header's retreat animation: an earlier read catches chrome that is
 * still moving and reports a shift no customer experiences as one.
 */
async function collectVitals(page: Page): Promise<Vitals> {
  return page.evaluate(
    () =>
      new Promise<Vitals>((resolve) => {
        const out: Vitals = { lcp: 0, lcpElement: null, cls: 0, ttfb: null, shifts: [] };
        const describe = (node: Element | null): string =>
          node
            ? node.tagName + (node.className ? `.${String(node.className).split(" ").slice(0, 2).join(".")}` : "")
            : "?";

        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const e = entry as PerformanceEntry & { element?: Element };
            out.lcp = e.startTime;
            out.lcpElement = describe(e.element ?? null);
          }
        }).observe({ type: "largest-contentful-paint", buffered: true });

        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const e = entry as PerformanceEntry & {
              value: number;
              hadRecentInput: boolean;
              sources?: { node?: Element }[];
            };
            // A shift the customer caused by tapping is not a layout defect.
            if (e.hadRecentInput) continue;
            out.cls += e.value;
            if (e.value > 0.005) {
              out.shifts.push({
                value: Number(e.value.toFixed(4)),
                sources: (e.sources ?? []).slice(0, 3).map((s) => describe(s.node ?? null)),
              });
            }
          }
        }).observe({ type: "layout-shift", buffered: true });

        setTimeout(() => {
          const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
          out.ttfb = nav ? Math.round(nav.responseStart) : null;
          out.lcp = Math.round(out.lcp);
          out.cls = Number(out.cls.toFixed(4));
          resolve(out);
        }, 2500);
      }),
  );
}

const ROUTES: { name: string; path: string }[] = [
  { name: "landing", path: "/" },
  { name: "menu", path: "/menu" },
];

for (const route of ROUTES) {
  test(`web vitals — ${route.name} does not shift its layout`, async ({ page }, testInfo) => {
    await page.goto(route.path, { waitUntil: "commit" });
    const v = await collectVitals(page);

    // Attached rather than only asserted: when this does fail, the number and
    // the element that moved are what makes it fixable, and a bare
    // "expected 0.14 to be below 0.1" is not.
    await testInfo.attach(`vitals-${route.name}`, {
      body: JSON.stringify(v, null, 2),
      contentType: "application/json",
    });

    expect(
      v.cls,
      `${route.path} shifted its layout (${v.cls}). Worst offenders: ${
        v.shifts
          .sort((a, b) => b.value - a.value)
          .slice(0, 3)
          .map((s) => `${s.value} from ${s.sources.join(", ")}`)
          .join(" | ") || "none recorded"
      }`,
    ).toBeLessThanOrEqual(CLS_BUDGET);

    expect(v.lcp, `${route.path} rendered nothing within ${LCP_CEILING_MS}ms`).toBeGreaterThan(0);
    expect(v.lcp).toBeLessThan(LCP_CEILING_MS);
  });
}

test("web vitals — a dish page does not shift its layout", async ({ page }, testInfo) => {
  // The slug is READ FROM THE MENU rather than hard-coded: the catalogue
  // changes, and a spec pinned to one dish quietly stops testing the dish page
  // the day that dish is retired.
  //
  // Menu cards link to `/menu?dish=<slug>` — the card opens the drawer, and
  // the full page is a step further in (that is the surface 3.2's "Open full
  // page" link sits on). So the slug comes from the card's query parameter,
  // and the spec then loads /dish/<slug> as a cold navigation, which is what a
  // shared link or a search result actually does.
  await page.goto("/menu", { waitUntil: "domcontentloaded" });
  const firstCard = page.locator('a[href*="/menu?dish="]').first();
  await expect(firstCard).toBeVisible();
  const cardHref = await firstCard.getAttribute("href");
  const slug = cardHref ? new URL(cardHref, "http://x").searchParams.get("dish") : null;
  expect(slug, "the menu offers no dish cards at all").toBeTruthy();
  const href = `/dish/${slug}`;

  await page.goto(href, { waitUntil: "commit" });
  const v = await collectVitals(page);
  await testInfo.attach("vitals-dish", {
    body: JSON.stringify({ href, ...v }, null, 2),
    contentType: "application/json",
  });

  expect(
    v.cls,
    `${href} shifted its layout (${v.cls}). Worst offenders: ${
      v.shifts
        .sort((a, b) => b.value - a.value)
        .slice(0, 3)
        .map((s) => `${s.value} from ${s.sources.join(", ")}`)
        .join(" | ") || "none recorded"
    }`,
  ).toBeLessThanOrEqual(CLS_BUDGET);
  expect(v.lcp).toBeGreaterThan(0);
  expect(v.lcp).toBeLessThan(LCP_CEILING_MS);
});

test("web vitals — the collector actually detects a shift", async ({ page }) => {
  // Guard against a vacuous suite. Every assertion above passes because CLS is
  // 0, and a collector that always returned 0 — a mistyped entry type, an
  // observer registered too late, a dropped `buffered` flag — would look
  // exactly the same. This forces a real shift on a real page of ours and
  // requires the instrument to see it, so "0" above means measured-zero rather
  // than nothing-measured.
  await page.goto("/menu", { waitUntil: "commit" });
  const collecting = collectVitals(page);
  // After first paint, insert a tall block ABOVE the content so everything
  // below it moves. No user input is involved, so this is not excluded by
  // `hadRecentInput` — it is exactly the shape of an unsized image or a late
  // banner arriving.
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const shove = document.createElement("div");
    shove.style.height = "400px";
    document.body.prepend(shove);
  });
  const v = await collecting;
  expect(v.cls, "the collector reported no shift for a 400px shove").toBeGreaterThan(CLS_BUDGET);
  expect(v.shifts.length, "a shift was counted but not attributed to any element").toBeGreaterThan(0);
});
