// Storefront service worker — narrow, shell-only, money-path-safe.
//
// This replaces the Phase-0 kill switch that shipped at cutover. The EVICTION
// half of that switch is preserved in intent: `activate` still deletes every
// cache key outside the expected set, so a browser that still arrives
// controlled by the legacy SPA's worker (its caches are keyed "tanmatra-v1" /
// "tanmatra-v2") has that stale shell purged on the first load, exactly as
// before. What changed is that this worker then STAYS registered and serves a
// real offline fallback instead of unregistering itself.
//
// ── HARD LINE: the money path is never cached, under any strategy ───────────
// /api/*, /checkout* and /account/* are not intercepted at all — no cache-first,
// no network-first-with-cache-fallback, no stale-while-revalidate. The server
// owns every amount and every availability check in this codebase, so a stale
// price, a stale stock state or a stale session read is a correctness bug, not
// a performance win. With no network these fail natively, which is honest;
// components/NetworkStatusToast.tsx is what tells the user why. Do not
// "improve" this by adding a cache fallback for those paths.
//
// Runtime HTML is never written to a cache either — only the precached shell
// below is ever replayed — so nothing personalised (/order, /track, /login, a
// signed-in header) can end up on disk even indirectly.

const VERSION = "v1";
const SHELL_CACHE = `tnm-shell-${VERSION}`;
const ASSET_CACHE = `tnm-assets-${VERSION}`;
const EXPECTED_CACHES = [SHELL_CACHE, ASSET_CACHE];

const OFFLINE_URL = "/offline";

// The static shell: the offline fallback plus pages that are pure content and
// carry no price, no stock and no session state. Adding a route here is a
// deliberate act — check it against the exclusion list first.
const PRECACHE_ROUTES = [
  OFFLINE_URL,
  "/about",
  "/faq",
  "/legal",
  "/legal/terms",
  "/legal/privacy",
  "/legal/refunds",
  "/legal/shipping",
  "/legal/disclaimer",
  "/legal/grievance",
];

// The money path and anything reading the authenticated session.
// `(\/|$)` so /checkout and /checkout/anything match but /checkout-appointment
// (a redirect to /account/appointments) is not swept in by prefix accident.
const NEVER_CACHE = [/^\/api\//, /^\/checkout(\/|$)/, /^\/account(\/|$)/];

const STATIC_PREFIXES = ["/_next/static/", "/images/", "/icons/", "/fonts/"];
const STATIC_EXTENSIONS = /\.(?:woff2?|ttf|otf|png|jpe?g|webp|avif|gif|svg|ico)$/;

// Next emits the layout stylesheet and the self-hosted next/font files as
// content-hashed hrefs in every document it renders. Read them out of the
// offline page rather than hardcoding hashes that change on every build.
const SHELL_ASSET_HREF = /href="(\/_next\/static\/[^"]+\.(?:css|woff2))"/g;

function isNeverCache(pathname) {
  return NEVER_CACHE.some((pattern) => pattern.test(pathname));
}

function isStaticAsset(pathname) {
  return (
    STATIC_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    STATIC_EXTENSIONS.test(pathname)
  );
}

// ── Install: precache the static shell ──────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(precacheShell().then(() => self.skipWaiting()));
});

async function precacheShell() {
  const cache = await caches.open(SHELL_CACHE);
  // allSettled, not cache.addAll: addAll is atomic, so a single 404 (a route
  // renamed, a legal doc retired) would abort the whole precache and leave the
  // user with no offline page at all.
  await Promise.allSettled(PRECACHE_ROUTES.map((route) => cache.add(route)));
  await precacheOfflineAssets();
}

/**
 * The offline page is HTML that references a hashed stylesheet and hashed font
 * files. Without them it paints unstyled the very first time it is shown: the
 * worker installs on the user's first load, before anything has populated
 * ASSET_CACHE. Fetching it once here and precaching what it links to makes the
 * fallback self-sufficient from the moment it exists.
 */
async function precacheOfflineAssets() {
  try {
    const response = await fetch(OFFLINE_URL, { cache: "no-store" });
    if (!response.ok) return;
    const html = await response.text();
    const hrefs = new Set();
    for (const match of html.matchAll(SHELL_ASSET_HREF)) hrefs.add(match[1]);
    const assets = await caches.open(ASSET_CACHE);
    await Promise.allSettled([...hrefs].map((href) => assets.add(href)));
  } catch {
    // Installed while offline. Not fatal: the shell fills in through the
    // cache-first asset path on the next successful load.
  }
}

// ── Activate: evict every cache outside the expected set ────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Preserved from the kill switch this file replaces. The filter is
      // deliberately an allow-list of the CURRENT version's keys, not a
      // deny-list of known-legacy names: it evicts the legacy SPA's caches for
      // browsers still controlled by its worker AND this worker's own previous
      // versions when VERSION is bumped, without either case needing its own
      // rule.
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => !EXPECTED_CACHES.includes(key))
          .map((key) => caches.delete(key)),
      );
      // skipWaiting (install) + claim (here) so a browser arriving with the
      // legacy worker's stale shell is taken over and purged during THAT page
      // load rather than one navigation later. Immediate takeover is only safe
      // because of the exclusions above — this worker can never substitute a
      // cached response on the money path, so the worst a bad takeover can do
      // is serve a stale static asset or the offline page.
      await self.clients.claim();
    })(),
  );
});

// ── Fetch: one strategy per request class ───────────────────────────────────

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Money path: no interception whatsoever. The request leaves exactly as the
  // browser would have sent it and fails natively when there is no network.
  if (isNeverCache(url.pathname)) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request, url));
    return;
  }

  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
  }

  // Everything else same-origin (RSC payloads, sitemap.xml, …) falls through
  // to the network untouched.
});

/**
 * Navigations: network-first, and on failure the precached shell — never a
 * runtime-cached one, because runtime navigation responses are not stored at
 * all. A route with no precached copy falls through to the offline page.
 */
async function handleNavigation(request, url) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    const matchOptions = { ignoreSearch: true, ignoreVary: true };
    const cached =
      (await cache.match(url.pathname, matchOptions)) ??
      (await cache.match(OFFLINE_URL, matchOptions));
    return cached ?? Response.error();
  }
}

/** Static assets: cache-first. Hashed filenames make them immutable. */
async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request, { ignoreVary: true });
  if (cached) return cached;

  const response = await fetch(request);
  // Only whole, same-origin 200s. A 206 range or an opaque redirect replays
  // badly from cache and is better re-fetched every time.
  if (response.status === 200 && response.type === "basic") {
    await cache.put(request, response.clone());
  }
  return response;
}
