/**
 * Synthetic production check — runs in GitHub Actions (which, unlike the
 * development sandbox, can reach production) on a schedule and on demand.
 *
 * Checks the REAL deployed site in REAL browser engines — including WebKit,
 * where the cross-site-cookie login bug lived undetected. Fails the workflow
 * (red) on any regression so problems surface before customers report them.
 *
 * Usage: node scripts/synthetic-check.mjs   (requires `playwright` installed)
 * Env:   PROD_URL (default https://tanmatra.food)
 */
import { chromium, webkit } from "playwright";

const CANDIDATES = [
  process.env.PROD_URL,
  "https://tanmatra.food",
  "https://tanmatra-475157072474.asia-south2.run.app",
].filter(Boolean);

const results = [];
let failed = 0;
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed++;
}

// ---- candidate diagnostics: catch a stale domain serving an old build ----
let BASE = null;
for (const url of CANDIDATES) {
  try {
    const r = await fetch(url, { redirect: "follow" });
    const html = await r.text();
    const title = (html.match(/<title>([^<]*)</) || [, "—"])[1];
    let locs = -1;
    try {
      const sm = await fetch(`${url.replace(/\/+$/, "")}/sitemap.xml`).then((x) => x.text());
      locs = (sm.match(/<loc>/g) || []).length;
    } catch { /* no sitemap */ }
    console.log(`candidate ${url}: status=${r.status} title=${JSON.stringify(title)} sitemapLocs=${locs} bytes=${html.length}`);
    if (r.ok && !BASE) BASE = url.replace(/\/+$/, "");
  } catch (e) {
    console.log(`candidate ${url}: UNREACHABLE ${String(e).slice(0, 120)}`);
  }
}
if (!BASE) {
  console.error("FATAL: no production URL reachable:", CANDIDATES.join(", "));
  process.exit(1);
}
console.log("Checking:", BASE, "\n");

// ---- 1. static/SEO surface ----------------------------------------------
{
  const home = await fetch(`${BASE}/`).then((r) => r.text());
  check("home: served with real content", home.length > 5000, `${home.length}B`);
  check("home: title present", /<title>[^<]*Tanmatra/i.test(home));
  check("home: not the bare fallback", !/^<title>Loading/.test(home));

  // Count dish links, not a headline string. tanmatra.food serves the
  // storefront now, whose menu heading is copy that marketing rewrites (it was
  // "Clinical Menu", it is "The menu"); asserting on it made this check fail
  // for a page that was serving 71 dishes perfectly. Cards link either to the
  // PDP (/dish/<slug>) or to the on-page quick view (/menu?dish=<slug>) — both
  // count, because what matters is that the menu came back with dishes in it.
  const menu = await fetch(`${BASE}/menu`).then((r) => r.text());
  const menuDishLinks = new Set(
    [...menu.matchAll(/href="\/(?:dish\/|menu\?dish=)([a-z0-9-]+)"/g)].map((m) => m[1]),
  ).size;
  check(
    "menu: prerendered with dishes",
    menuDishLinks >= 5 && menu.length > 20000,
    `${menuDishLinks} dishes, ${menu.length}B`,
  );

  const dish = await fetch(`${BASE}/dish/signature-quinoa-salad`).then((r) => r.text());
  check("dish PDP: prerendered + structured data", /application\/ld\+json/.test(dish) && /Signature Quinoa/i.test(dish));

  const sitemap = await fetch(`${BASE}/sitemap.xml`).then((r) => r.text());
  const locs = (sitemap.match(/<loc>/g) || []).length;
  check("sitemap: >100 URLs", locs > 100, `${locs} URLs`);

  // The storefront's contract (app/robots.ts): allow the whole public site,
  // Disallow only /api/, and de-index session surfaces per-route via
  // `robots: { index: false }` — a Disallowed URL can never be crawled to see
  // its noindex. The old assertion wanted "Disallow: /admin", which belongs to
  // the legacy SPA; the storefront has no /admin route to disallow.
  const robots = await fetch(`${BASE}/robots.txt`).then((r) => r.text());
  check("robots.txt: shields /api and points at the sitemap", /Disallow: \/api\//.test(robots) && /Sitemap:/.test(robots));
}

// ---- 2. same-origin API proxy (the login-fix load-bearing wall) ---------
{
  let apiOk = false, apiDetail = "";
  try {
    const r = await fetch(`${BASE}/api/auth/user`, { headers: { accept: "application/json" } });
    const ct = r.headers.get("content-type") || "";
    // Any JSON response (200 with null user or 401) proves the proxy routes
    // /api to the API server. HTML here would mean the proxy regressed and
    // cookies went third-party again.
    apiOk = ct.includes("application/json");
    apiDetail = `status=${r.status} content-type=${ct}`;
  } catch (e) { apiDetail = String(e); }
  check("API proxy: /api/* served same-origin as JSON", apiOk, apiDetail);
}

// ---- 3. real-browser checks, Chromium AND WebKit -------------------------
for (const [engineName, engine] of [["chromium", chromium], ["webkit", webkit]]) {
  const browser = await engine.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));

  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.evaluate(() => localStorage.setItem("tanmatra:softgate:v1", JSON.stringify({ v: 1, at: 1, outcome: "skip" })));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const homeText = await page.evaluate(() => document.body.innerText.length);
  check(`${engineName}: home hydrates with content`, homeText > 800, `${homeText} chars`);

  await page.goto(`${BASE}/menu`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2500);
  // Structure, not class names. ".dcard,.card" were the legacy SPA's hand-written
  // classes; the storefront's cards are Astryx primitives whose StyleX classes are
  // content-hashed, so that selector reported "0 cards" against a menu rendering 71.
  // An <article> containing a dish link is the framework-independent shape of a card.
  const dishCards = await page.evaluate(
    () =>
      [...document.querySelectorAll("article")].filter((a) =>
        a.querySelector('a[href*="/dish/"], a[href*="?dish="]'),
      ).length,
  );
  check(`${engineName}: menu renders dish cards`, dishCards >= 5, `${dishCards} cards`);

  // Login page: typed digits must survive (guards the hydration-wipe bug).
  // Two changes from the legacy version, both because /login is now an island:
  //  1. WAIT for the field. The storefront ships no input in the server HTML —
  //     LoginCard probes the session and mounts PhoneAuth after it resolves. A
  //     fixed 2s sleep raced that and read an element that did not exist yet.
  //  2. CLICK before typing. The legacy page autofocused its phone field;
  //     PhoneAuth does not, so unfocused keystrokes went to <body> and this
  //     reported value="" on a login page that works.
  // A field that never mounts still fails here, which is the regression we care
  // about — it just fails as "no phone input" instead of an empty value.
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
  const phoneSel = '#pa-phone, input[type="tel"], input[inputmode="numeric"]';
  let typed = "";
  try {
    const field = await page.waitForSelector(phoneSel, { timeout: 15000, state: "visible" });
    await field.click();
    await page.keyboard.type("9876543210", { delay: 40 });
    await page.waitForTimeout(600);
    typed = (await field.inputValue()).replace(/\D/g, "");
  } catch {
    typed = "";
    console.log(`  (${engineName}: no phone input mounted on /login within 15s)`);
  }
  check(`${engineName}: login input keeps typed digits`, typed.includes("9876543210") || typed.length >= 10, `value="${typed}"`);

  // Benign, WebKit-specific harness artifacts — NOT real user-facing errors:
  //  - ResizeObserver / chunk-load: standard noise.
  //  - sw.js "access control checks": Playwright's WebKit has no
  //    service-worker support and logs the register() rejection even though
  //    the app catches it.
  //  - /api/* "access control checks": when a guest lands on a page whose
  //    widgets fetch an auth-gated endpoint (e.g. /api/addresses,
  //    /api/wellness/week), WebKit surfaces the caught 401 as a page error
  //    with its generic "access control checks" phrasing. These are
  //    same-origin (VITE_API_BASE=/api) and handled in-app. A REAL
  //    cross-origin/cookie regression is still caught by the dedicated
  //    "API proxy: /api/* served same-origin as JSON" and login checks above,
  //    which fail loudly and independently — so filtering this class here does
  //    not blind us to that regression.
  const isBenignPageError = (e) =>
    /ResizeObserver|Loading chunk/i.test(e) ||
    (/access control checks/i.test(e) && /(\/api\/|sw\.js)/i.test(e));
  const fatal = errors.filter((e) => !isBenignPageError(e));
  check(`${engineName}: no fatal page errors`, fatal.length === 0, fatal[0] || "");
  await browser.close();
}

// ---- summary --------------------------------------------------------------
console.log(`\n${results.length - failed}/${results.length} checks passed`);
// Persist a machine-readable report for the workflow to publish (commit
// comment + step summary) — CI log storage isn't always reachable from
// every operator environment.
try {
  const fs = await import("node:fs");
  const lines = results.map((r) => `${r.ok ? "✅" : "❌"} ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
  const report = [`### Synthetic prod check — ${BASE}`, "", ...lines, "", `**${results.length - failed}/${results.length} passed**`].join("\n");
  fs.writeFileSync("synthetic-report.md", report);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + "\n");
} catch { /* reporting is best-effort */ }
if (failed > 0) process.exit(1);
