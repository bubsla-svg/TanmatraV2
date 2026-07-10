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

  const menu = await fetch(`${BASE}/menu`).then((r) => r.text());
  check("menu: prerendered content", /Clinical Menu/i.test(menu) && menu.length > 20000, `${menu.length}B`);

  const dish = await fetch(`${BASE}/dish/signature-quinoa-salad`).then((r) => r.text());
  check("dish PDP: prerendered + structured data", /application\/ld\+json/.test(dish) && /Signature Quinoa/i.test(dish));

  const sitemap = await fetch(`${BASE}/sitemap.xml`).then((r) => r.text());
  const locs = (sitemap.match(/<loc>/g) || []).length;
  check("sitemap: >100 URLs", locs > 100, `${locs} URLs`);

  const robots = await fetch(`${BASE}/robots.txt`).then((r) => r.text());
  check("robots.txt: disallows private surfaces", /Disallow: \/admin/.test(robots) && /Sitemap:/.test(robots));
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
  const dishCards = await page.evaluate(() => document.querySelectorAll(".dcard,.card").length);
  check(`${engineName}: menu renders dish cards`, dishCards >= 5, `${dishCards} cards`);

  // Login page: typed digits must survive (guards the hydration-wipe bug).
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.keyboard.type("9876543210", { delay: 40 });
  await page.waitForTimeout(800);
  const typed = await page.evaluate(() => {
    const el = document.querySelector('input[inputmode="numeric"]');
    return el ? el.value.replace(/\D/g, "") : "";
  });
  check(`${engineName}: login input keeps typed digits`, typed.includes("9876543210") || typed.length >= 10, `value="${typed}"`);

  // Playwright's WebKit build has no service-worker support and logs the
  // sw.js load rejection as a page error even though the app's register()
  // call catches it — known harness artifact, not real-iOS behavior.
  const fatal = errors.filter((e) => !/ResizeObserver|Loading chunk|sw\.js.*access control|access control.*sw\.js/i.test(e));
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
