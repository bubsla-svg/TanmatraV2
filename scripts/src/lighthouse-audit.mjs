/**
 * Storefront Lighthouse audit — accessibility, best-practices, and gzipped
 * JS/CSS transfer-size budgets, one run per route.
 *
 * WHAT CHANGED AND WHY (WEB-APP-ENHANCEMENT-PLAN Tier 2 #14)
 * ---------------------------------------------------------
 * This script used to point at `http://localhost:80` and audit `/cart` — both
 * artefacts of the LEGACY app (`artifacts/tanmatra`). On the storefront,
 * `/cart` is a 308 redirect to `/checkout` (`next.config.ts` redirects()), so
 * that route measured a redirect hop, not a page. It was also wired into no
 * workflow at all, so nothing ever ran it. It now targets the storefront's
 * real routes and is wired into `.github/workflows/storefront.yml` as an
 * explicitly NON-BLOCKING step (`continue-on-error: true`) so it accumulates a
 * baseline before it is allowed to gate anything.
 *
 * NO HARDCODED ABSOLUTE PATHS (AGENT_WORKING_AGREEMENT §4)
 * -------------------------------------------------------
 * Everything resolves from `import.meta.url`. The old `/nix/store/...chromium`
 * default is gone: the browser is resolved from env first, then by PATH probe.
 *
 * USAGE
 *   node scripts/src/lighthouse-audit.mjs
 *
 * ENV
 *   LH_BASE        origin under test           (default http://127.0.0.1:3000)
 *   LH_OUT         report dir, repo-relative   (default .local/lighthouse-reports)
 *   LH_DISH_SLUG   PDP slug to audit           (default quinoa-khichdi)
 *   LH_MIN_A11Y    accessibility floor, 0-100  (default 95)
 *   LH_PERF        "1" adds the full performance category (LCP/CLS/TBT).
 *                  Default OFF — see PERF_CATEGORY_NOTE below.
 *   LH_ENFORCE     "1" makes budget/a11y breaches exit non-zero.
 *                  Default OFF — baseline mode, always exits 0.
 *   CHROME_PATH / LH_CHROME_PATH / E2E_CHROMIUM_PATH — browser binary override.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import lighthouse from "lighthouse";

// scripts/src/<this file> -> scripts/ -> repo root. Never an absolute literal:
// this has to run on a CI runner and on any developer checkout alike.
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..", "..");

const BASE = process.env.LH_BASE || "http://127.0.0.1:3000";
// `resolve` honours an absolute LH_OUT and treats a relative one as repo-relative.
const OUT = resolve(REPO_ROOT, process.env.LH_OUT || ".local/lighthouse-reports");

const MIN_A11Y = Number(process.env.LH_MIN_A11Y ?? 95);
const ENFORCE = /^(1|true|yes)$/i.test(process.env.LH_ENFORCE ?? "");
const WITH_PERF = /^(1|true|yes)$/i.test(process.env.LH_PERF ?? "");

const KB = 1024;

/**
 * Starting budgets, verbatim from WEB-APP-ENHANCEMENT-PLAN's "Performance CI
 * gate" section, which in turn follows this repo's `web/performance.md`
 * convention. Both numbers are TRANSFER size (over the wire, i.e. gzip/brotli
 * compressed), which is what Lighthouse's `resource-summary` reports.
 *
 * These are a STARTING POINT, not measured truth. The plan requires 2-3 weeks
 * of real baseline data before they are allowed to gate a merge; until then
 * `LH_ENFORCE` stays off and the workflow step stays `continue-on-error`.
 */
const BUDGETS = {
  // Landing / marketing surfaces: mostly static content, minimal interactivity.
  landing: { jsKB: 150, cssKB: 30 },
  // App surfaces: carry real interactive islands (cart, forms, auth, maps).
  app: { jsKB: 300, cssKB: 50 },
};

// A real slug from the catalogue, not an invented one:
// `quinoa-khichdi` is an a-la-carte-orderable hero dish in
// `lib/menu-catalog/src/index.ts` and is already the canonical PDP fixture the
// e2e suite uses (`artifacts/storefront/e2e/fixtures.ts` -> ORDERABLE_DISH).
// Using the same slug in both places means one dish going away breaks both
// loudly instead of silently measuring a 404 page.
const DISH_SLUG = process.env.LH_DISH_SLUG || "quinoa-khichdi";

/**
 * SCOPE BOUND, STATED EXPLICITLY (AGENT_WORKING_AGREEMENT §6 — no silent
 * truncation): this audits FIVE routes, not the whole ~60-route storefront.
 * They are the plan's named set — the funnel entry, the browse surface, a real
 * PDP, the money path, and the account hub. Everything else is uncovered.
 * Adding a route here costs ~30-45 s of CI time per run.
 *
 * `budget` selects which BUDGETS profile applies.
 */
const ROUTES = [
  { name: "home", path: "/", budget: "landing" },
  { name: "menu", path: "/menu", budget: "app" },
  // The PDP is classified `app`, not `landing`, because it ships real
  // interactive islands (AddToCart, DishGallery, DishReviews, DishBuyBar) on
  // top of its marketing content. This classification is provisional and
  // should be revisited once the baseline exists — it is the one route the
  // plan does not explicitly assign to a profile.
  { name: "dish", path: `/dish/${DISH_SLUG}`, budget: "app" },
  { name: "checkout", path: "/checkout", budget: "app" },
  { name: "account", path: "/account", budget: "app" },
];

/**
 * PERF_CATEGORY_NOTE — another explicit scope bound. By default this runs the
 * `accessibility` and `best-practices` categories plus two diagnostic audits
 * (`resource-summary`, `network-requests`) that carry the byte accounting the
 * budgets need. The full `performance` category (LCP/CLS/TBT/SI) is NOT run by
 * default: it roughly doubles per-route runtime and its lab metrics are noisy
 * on a shared GitHub runner, which is exactly the kind of flake that gets a
 * young gate disabled. Opt in with LH_PERF=1 once the byte baseline is stable.
 * Byte budgets are deterministic and are what the plan actually names.
 */
const CATEGORIES = WITH_PERF
  ? ["performance", "accessibility", "best-practices"]
  : ["accessibility", "best-practices"];
// `onlyAudits` is a UNION with `onlyCategories` in Lighthouse's config filter
// (core/config/filters.js), so these run even when `performance` is excluded.
const EXTRA_AUDITS = ["resource-summary", "network-requests"];

// ---------------------------------------------------------------------------
// Browser resolution
// ---------------------------------------------------------------------------

const CHROME_ENV_KEYS = [
  "LH_CHROME_PATH",
  "CHROME_PATH",
  "E2E_CHROMIUM_PATH",
  "PUPPETEER_EXECUTABLE_PATH",
];
// Probed on PATH, in order. GitHub's ubuntu runner images ship
// `google-chrome-stable`; most dev boxes have one of the rest.
const CHROME_CANDIDATES = [
  "google-chrome-stable",
  "google-chrome",
  "chromium",
  "chromium-browser",
  "chrome",
];

function resolveChrome() {
  for (const key of CHROME_ENV_KEYS) {
    const value = process.env[key];
    if (value) return value;
  }
  for (const candidate of CHROME_CANDIDATES) {
    const probe = spawnSync(candidate, ["--version"], { stdio: "ignore" });
    if (!probe.error && probe.status === 0) return candidate;
  }
  throw new Error(
    `No Chrome/Chromium found on PATH (tried ${CHROME_CANDIDATES.join(", ")}). ` +
      `Set CHROME_PATH to a browser binary.`,
  );
}

function pickPort() {
  return 9222 + Math.floor(Math.random() * 200);
}

async function launchChrome(chromePath) {
  const port = pickPort();
  const args = [
    `--remote-debugging-port=${port}`,
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--no-default-browser-check",
    // OS temp dir, not a hardcoded "/tmp".
    `--user-data-dir=${join(tmpdir(), `lh-${port}-${Date.now()}`)}`,
    "about:blank",
  ];
  const proc = spawn(chromePath, args, { stdio: ["ignore", "pipe", "pipe"] });
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return { proc, port };
    } catch {}
  }
  proc.kill("SIGKILL");
  throw new Error("Chrome did not start");
}

// ---------------------------------------------------------------------------
// Byte accounting
// ---------------------------------------------------------------------------

/**
 * Transfer bytes (compressed, over the wire) by resource type.
 * Prefers `resource-summary`; falls back to summing `network-requests` so a
 * future Lighthouse that drops the summary audit degrades instead of dying.
 */
function transferBytes(lhr) {
  const summary = lhr.audits?.["resource-summary"]?.details?.items;
  if (Array.isArray(summary) && summary.length) {
    const pick = (type) =>
      Number(summary.find((i) => i.resourceType === type)?.transferSize) || 0;
    return { js: pick("script"), css: pick("stylesheet"), total: pick("total") };
  }
  const requests = lhr.audits?.["network-requests"]?.details?.items;
  if (!Array.isArray(requests)) return null;
  let js = 0;
  let css = 0;
  let total = 0;
  for (const r of requests) {
    const size = Number(r.transferSize) || 0;
    total += size;
    const type = String(r.resourceType ?? "").toLowerCase();
    if (type === "script") js += size;
    else if (type === "stylesheet") css += size;
  }
  return { js, css, total };
}

const kb = (bytes) => Math.round((bytes / KB) * 10) / 10;

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

async function audit(route, chromePath) {
  const url = BASE + route.path;
  const { proc, port } = await launchChrome(chromePath);
  try {
    const result = await lighthouse(
      url,
      {
        port,
        output: ["json", "html"],
        logLevel: "error",
        onlyCategories: CATEGORIES,
        onlyAudits: EXTRA_AUDITS,
        formFactor: "mobile",
        screenEmulation: {
          mobile: true,
          width: 412,
          height: 823,
          deviceScaleFactor: 1.75,
          disabled: false,
        },
        throttling: {
          rttMs: 150,
          throughputKbps: 1638.4,
          cpuSlowdownMultiplier: 4,
          requestLatencyMs: 0,
          downloadThroughputKbps: 0,
          uploadThroughputKbps: 0,
        },
        emulatedUserAgent:
          "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36 Lighthouse",
      },
      undefined,
    );
    const lhr = result.lhr;
    const a11y = Math.round((lhr.categories.accessibility?.score ?? 0) * 100);
    const bp = Math.round((lhr.categories["best-practices"]?.score ?? 0) * 100);
    const perf = lhr.categories.performance
      ? Math.round((lhr.categories.performance.score ?? 0) * 100)
      : null;
    writeFileSync(join(OUT, `${route.name}.report.json`), result.report[0]);
    writeFileSync(join(OUT, `${route.name}.report.html`), result.report[1]);

    const failing = (categoryId) =>
      (lhr.categories[categoryId]?.auditRefs ?? [])
        .map((ref) => lhr.audits[ref.id])
        .filter((a) => a && a.score !== null && a.score < 1)
        .map((a) => ({
          id: a.id,
          title: a.title,
          score: a.score,
          items: a.details?.items ? a.details.items.length : 0,
        }));

    const bytes = transferBytes(lhr);
    const budget = BUDGETS[route.budget];
    const budgetReport = bytes
      ? {
          profile: route.budget,
          jsKB: kb(bytes.js),
          jsBudgetKB: budget.jsKB,
          jsOver: bytes.js > budget.jsKB * KB,
          cssKB: kb(bytes.css),
          cssBudgetKB: budget.cssKB,
          cssOver: bytes.css > budget.cssKB * KB,
          totalKB: kb(bytes.total),
        }
      : null;

    return {
      name: route.name,
      path: route.path,
      url,
      a11y,
      bp,
      perf,
      budget: budgetReport,
      a11yAudits: failing("accessibility"),
      bpAudits: failing("best-practices"),
    };
  } finally {
    proc.kill("SIGKILL");
  }
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

mkdirSync(OUT, { recursive: true });
const chromePath = resolveChrome();

console.log(`base   = ${BASE}`);
console.log(`chrome = ${chromePath}`);
console.log(`out    = ${OUT}`);
console.log(`mode   = ${ENFORCE ? "ENFORCING" : "BASELINE (non-blocking)"}`);
console.log(`routes = ${ROUTES.length} (${ROUTES.map((r) => r.path).join(", ")})`);

const summary = [];
for (const route of ROUTES) {
  process.stdout.write(`\n>> ${route.name} ${route.path}\n`);
  try {
    const r = await audit(route, chromePath);
    summary.push(r);
    console.log(
      `   a11y=${r.a11y}  best-practices=${r.bp}` +
        (r.perf === null ? "" : `  perf=${r.perf}`),
    );
    if (r.budget) {
      console.log(
        `   [${r.budget.profile}] js=${r.budget.jsKB}KB/${r.budget.jsBudgetKB}KB ` +
          `${r.budget.jsOver ? "OVER" : "ok"}  ` +
          `css=${r.budget.cssKB}KB/${r.budget.cssBudgetKB}KB ` +
          `${r.budget.cssOver ? "OVER" : "ok"}  total=${r.budget.totalKB}KB`,
      );
    } else {
      console.log("   budget: NOT MEASURED (no resource-summary/network-requests)");
    }
    for (const a of r.a11yAudits) {
      console.log(`     a11y  - ${a.id}: ${a.title} (items=${a.items})`);
    }
    for (const a of r.bpAudits) {
      console.log(`     bp    - ${a.id}: ${a.title}`);
    }
  } catch (e) {
    console.error(`   FAILED: ${e.message}`);
    summary.push({ name: route.name, path: route.path, error: e.message });
  }
}

writeFileSync(
  join(OUT, "summary.json"),
  JSON.stringify(
    { base: BASE, ranAt: new Date().toISOString(), budgets: BUDGETS, routes: summary },
    null,
    2,
  ),
);

console.log("\n=== SUMMARY ===");
const violations = [];
for (const r of summary) {
  if (r.error) {
    console.log(`${r.name.padEnd(9)} ERROR ${r.error}`);
    violations.push(`${r.name}: audit failed — ${r.error}`);
    continue;
  }
  const b = r.budget;
  console.log(
    `${r.name.padEnd(9)} a11y=${String(r.a11y).padStart(3)}  bp=${String(r.bp).padStart(3)}` +
      (b ? `  js=${b.jsKB}/${b.jsBudgetKB}KB  css=${b.cssKB}/${b.cssBudgetKB}KB` : "  (no bytes)"),
  );
  if (r.a11y < MIN_A11Y) {
    violations.push(`${r.name}: accessibility ${r.a11y} < ${MIN_A11Y}`);
  }
  if (b?.jsOver) violations.push(`${r.name}: JS ${b.jsKB}KB > ${b.jsBudgetKB}KB (${b.profile})`);
  if (b?.cssOver) violations.push(`${r.name}: CSS ${b.cssKB}KB > ${b.cssBudgetKB}KB (${b.profile})`);
}

if (violations.length) {
  console.log("\n=== VIOLATIONS ===");
  for (const v of violations) console.log(`  - ${v}`);
} else {
  console.log("\nNo budget or accessibility violations.");
}

if (!ENFORCE) {
  console.log(
    "\nBASELINE MODE (LH_ENFORCE unset) — reporting only, exiting 0.\n" +
      "The plan requires 2-3 weeks of real baseline data before these numbers\n" +
      "are allowed to fail a build. Set LH_ENFORCE=1 to make them blocking.",
  );
  process.exit(0);
}
process.exit(violations.length ? 1 : 0);
