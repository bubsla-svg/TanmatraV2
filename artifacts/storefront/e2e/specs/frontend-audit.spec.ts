import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { auditPage, type Finding } from "../support/audit/probes";

/**
 * Frontend spatial / layering / component-rendering audit.
 *
 * Drives every customer-reachable route through the probes in
 * ../support/audit/probes.ts and writes a single report. It is a REPORTER by
 * default and a GATE for two classes only — see HARD_GATES below.
 *
 * Why the split. The probes measure things that are defects in context
 * ("this 20px link is too small to tap") and things that are only smells out
 * of it ("this page scrolls 300px past its content"). Failing the build on
 * everything the first run finds would either block on pre-existing debt or
 * push someone to weaken the probe. So the two classes with unambiguous,
 * customer-visible failure modes gate; the rest report and are triaged from
 * the artifact.
 *
 * ENVIRONMENT NOTE, stated rather than buried: with no API base the app
 * serves its static fallback catalog, so dish-detail routes render the
 * bundled 116-dish set rather than the live 145. Geometry, layering, tap
 * targets and control styling are identical either way — those are CSS and
 * DOM structure. What this run CANNOT see is anything gated behind auth or a
 * live order: the checkout "Continue to payment" failure and the post-login
 * state-hydration questions are out of reach here and are called out as
 * unverified in the report rather than silently omitted.
 */

/** Probe classes that fail the build outright. Both are pointer-level
 *  defects: the customer taps a control and something else happens, or
 *  nothing does. */
const HARD_GATES = new Set(["occlusion", "image-collapse"]);

/**
 * WCAG 2.2 AA target-size failures also fail the build — added once the count
 * reached zero, which is the only honest moment to add a gate.
 *
 * The original note here said the reason not to gate everything was that "a
 * gate that blocks on pre-existing debt on day one gets weakened, not
 * obeyed". That reasoning expires when the debt does. The first run measured
 * five sub-24px controls; PR #70 fixed all five; so this gate costs nothing
 * today and is purely a ratchet against the regression that already happened
 * once — a standalone text link with no vertical box of its own, whose
 * rendered height is its line-height and which looks entirely normal in a
 * diff.
 *
 * `lib/tapTargets.test.ts` pins the same five by SOURCE, which is faster and
 * runs without a browser but can only check that a class is still written. It
 * cannot see a control that regresses for a different reason — a changed
 * utility, a new wrapper, a font-size change. This measures rendered pixels,
 * so the two are complements, not duplicates.
 *
 * The 24–44px band stays REPORT-ONLY: 31 findings today, which is exactly the
 * pre-existing debt the paragraph above says a gate must not be built on.
 */
const GATE_AA_TARGET_SIZE = true;

function isGated(f: Finding): boolean {
  if (HARD_GATES.has(f.probe)) return true;
  // `severity: "high"` on a tap-target IS the sub-24px case — the probe sets
  // "medium" for the 24–44 band. Keyed off severity rather than re-deriving
  // the threshold here so there is one definition of "AA failure".
  return GATE_AA_TARGET_SIZE && f.probe === "tap-target" && f.severity === "high";
}

const ROUTES: Array<{ path: string; name: string }> = [
  { path: "/", name: "landing" },
  { path: "/menu", name: "menu" },
  { path: "/plans", name: "plans" },
  { path: "/cart", name: "cart" },
  { path: "/faq", name: "faq" },
  { path: "/account", name: "account" },
  { path: "/styleguide", name: "styleguide" },
  // The two surfaces the reported screenshots came from: the full dish page
  // (its own (focus) shell — no global chrome) and the quick-view drawer
  // opened over /menu. Different layouts, so both are audited.
  { path: "/dish/cheese-omelette", name: "dish-pdp" },
  { path: "/menu?dish=cheese-omelette", name: "dish-drawer" },
];

interface RouteReport {
  route: string;
  name: string;
  ok: boolean;
  status?: number;
  findings: Finding[];
  consoleErrors: string[];
  failedRequests: string[];
}

/**
 * Each test writes its OWN file, and the markdown is assembled afterwards by
 * scripts/audit-report.ts. A module-level accumulator + afterAll does NOT
 * work here: `fullyParallel` gives every test its own worker process, so the
 * array is per-worker and the report silently covers only whatever the last
 * worker happened to run. (Observed: a 7-route run reported 2.)
 */
const OUT_DIR = resolve(process.cwd(), "artifacts/storefront/e2e/audit-report");

function writeRouteReport(r: RouteReport): void {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(resolve(OUT_DIR, `${r.name}.json`), JSON.stringify(r, null, 2) + "\n");
}

/**
 * Scroll the whole page so lazy / `content-visibility: auto` rows actually lay
 * out — without this the probes only ever see the first viewport.
 *
 * SETTLE_MS is load-bearing and was tuned against a false positive, not
 * guessed. The header condenses/retreats on scroll (a 200ms transform plus a
 * settle window), so probing too soon after returning to the top catches the
 * chrome MID-ANIMATION: measured on /menu, a 400ms settle reported five
 * `critical` collisions — the sticky controls block sitting over the header's
 * logo, search and filter controls — every one of which was gone 2s later. An
 * audit that reports animation frames as defects is worse than no audit,
 * because the real one in the same run (the bottom nav covering a button,
 * which reproduces on a never-scrolled load) gets buried in the noise.
 */
const SETTLE_MS = 2000;

async function fullScroll(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const step = window.innerHeight;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 80));
    }
    // Deliberately END at the bottom, not back at the top: the occlusion
    // probe only reports at maximum scroll, because that is the only position
    // where "covered" means "unreachable" rather than "scroll a bit more".
    window.scrollTo(0, document.body.scrollHeight);
  });
  await page.waitForTimeout(SETTLE_MS);
}

/**
 * OPT-IN, deliberately. `storefront.yml`'s e2e step runs the whole `specs/`
 * directory with `--project=mobile` and no filter, so simply adding this file
 * would have made it a merge gate nobody chose — and a geometry audit is
 * exactly the kind of check that goes flaky on a slower runner (the settle
 * window is wall-clock) and then gets deleted rather than fixed.
 *
 * So it runs only when asked:
 *   RUN_FRONTEND_AUDIT=1 E2E_BASE_URL=... pnpm exec playwright test \
 *     --config artifacts/storefront/e2e/playwright.config.ts \
 *     --project=mobile frontend-audit
 *
 * Promoting it to a standing gate is a deliberate decision (see the PR), not
 * a side effect of the file existing.
 */
const AUDIT_ENABLED = process.env["RUN_FRONTEND_AUDIT"] === "1";

test.describe("frontend audit", () => {
  for (const route of ROUTES) {
    test(`audit ${route.name} (${route.path})`, async ({ page }, testInfo) => {
      // Guard in the BODY, not as a describe-level condition: the
      // `({}, testInfo)` conditional form is unsupported under the strip-only
      // type stripping Playwright loads these files with (see
      // menu-image-integrity.spec.ts for the same note).
      test.skip(!AUDIT_ENABLED, "set RUN_FRONTEND_AUDIT=1 to run the audit");
      const consoleErrors: string[] = [];
      const failedRequests: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200));
      });
      page.on("requestfailed", (r) => {
        failedRequests.push(`${r.method()} ${r.url().slice(0, 120)}`);
      });

      const resp = await page.goto(route.path, { waitUntil: "domcontentloaded" });
      const status = resp?.status();
      // A route that does not render is its own finding — record and move on
      // rather than failing the whole audit on one bad path.
      if (!resp || status == null || status >= 400) {
        writeRouteReport({
          route: route.path,
          name: route.name,
          ok: false,
          ...(status != null ? { status } : {}),
          findings: [],
          consoleErrors,
          failedRequests,
        });
        return;
      }

      await page.waitForTimeout(600);
      await fullScroll(page);

      const raw = await page.evaluate(auditPage);
      // Occlusion candidates are VERIFIED individually before they count.
      // "Covered right now" is not a defect — pinned chrome covers whatever is
      // under it at the current scroll offset, which is what pinning means.
      // The defect is "covered at EVERY scroll offset". So each candidate is
      // scrolled to the vertical centre of the viewport (the position furthest
      // from both the top and bottom bars) and hit-tested again; only an
      // element still stealing the pointer there is genuinely unreachable.
      // Without this, a top sticky bar at max scroll and a bottom nav mid-page
      // both read as critical — measured, that was 8 false criticals.
      const findings: Finding[] = [];
      for (const f of raw) {
        if (f.probe !== "occlusion" || !f.selector) {
          findings.push(f);
          continue;
        }
        const stillStuck = await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (!(el instanceof HTMLElement)) return false;
          el.scrollIntoView({ block: "center" });
          const r = el.getBoundingClientRect();
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return hit != null && !el.contains(hit) && hit !== el;
        }, f.selector);
        if (stillStuck) findings.push(f);
      }
      writeRouteReport({
        route: route.path,
        name: route.name,
        ok: true,
        status,
        findings,
        consoleErrors,
        failedRequests,
      });

      await testInfo.attach(`${route.name}-findings.json`, {
        body: JSON.stringify(findings, null, 2),
        contentType: "application/json",
      });

      const gated = findings.filter(isGated);
      expect(
        gated,
        `blocking defects on ${route.path}:\n${gated.map((g) => `  - [${g.severity}] ${g.probe} — ${g.detail}`).join("\n")}`,
      ).toEqual([]);
    });
  }

});
