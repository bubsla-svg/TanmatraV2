/**
 * Short-TTL process cache for menuResolver.getMergedCatalog(). The merged
 * catalog (static DISHES + menu_items overrides + review summaries) is the
 * highest-traffic uncached read in the API — every /menu/* request plus
 * every checkout/subscription/loyalty/coach-agent call that resolves
 * dishes re-runs it — yet it changes far less often than it's read: CMS
 * edits and RD review-state changes, not per-request. See
 * lib/userBrief/cache.ts for the two-layer cache pattern this borrows the
 * process-cache half of; no per-user keying is needed here since the
 * catalog is global.
 *
 * Single-flight: concurrent cache-miss callers share one in-flight fetch
 * instead of each issuing their own DB round trip (cache-stampede guard).
 *
 * TTL is intentionally short (30s) because this surface carries price and
 * the rdReviewState patient-safety filter — staleness has a real ceiling.
 */

const DEFAULT_TTL_MS = 30_000;
let ttlMs = DEFAULT_TTL_MS;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

let cached: CacheEntry<unknown> | null = null;
let inFlight: Promise<unknown> | null = null;
// Bumped on every invalidation. A fetch that was already in flight when an
// invalidation happens must not repopulate the cache with what is now
// stale data once it resolves — it only writes back if the generation it
// started under is still current.
let generation = 0;

export async function getCachedOrFetch<T>(fetcher: () => Promise<T>): Promise<T> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.value as T;
  if (inFlight) return inFlight as Promise<T>;

  const startedGeneration = generation;
  const promise = fetcher()
    .then((value) => {
      if (generation === startedGeneration) {
        cached = { value, expiresAt: Date.now() + ttlMs };
      }
      return value;
    })
    .finally(() => {
      if (inFlight === promise) inFlight = null;
    });
  inFlight = promise;
  return promise;
}

/** Call from any write path that mutates data the merged catalog reads:
 * menu-item CRUD (lib/menu.ts), dish-review-summary writes
 * (lib/dishReviews.ts), and the inbound Petpooja POS webhooks
 * (routes/petpooja.ts's push-menu, item_stock, item_stock_off — these
 * write price_paise/isAvailable directly via drizzle, bypassing lib/menu.ts). */
export function invalidateMenuCatalogCache(): void {
  generation++;
  cached = null;
  inFlight = null;
}

/** Test-only — wipe cache state between test cases. */
export function _resetMenuCatalogCacheForTests(): void {
  generation++;
  cached = null;
  inFlight = null;
  ttlMs = DEFAULT_TTL_MS;
}

/** Test-only — shrink the TTL so expiry can be exercised deterministically
 * instead of sleeping 30s in a unit test. */
export function _setTtlMsForTests(ms: number): void {
  ttlMs = ms;
}
