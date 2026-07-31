/**
 * DB-free unit tests for the menu-catalog process cache (OA-DEEP-1.3,
 * TODO_optimization-auditor.md): TTL expiry, single-flight dedup of
 * concurrent cache misses, and the invalidation-during-in-flight-fetch race
 * (a write that invalidates while an older fetch is still resolving must
 * not have that stale fetch repopulate the cache afterward).
 *
 * Run from artifacts/api-server:
 *   node --test --import tsx ./src/lib/menuCatalogCache.test.ts
 */
import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";
import {
  getCachedOrFetch,
  invalidateMenuCatalogCache,
  _resetMenuCatalogCacheForTests,
  _setTtlMsForTests,
} from "./menuCatalogCache";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

beforeEach(() => {
  _resetMenuCatalogCacheForTests();
});

test("caches the fetched value across repeat calls within TTL", async () => {
  let calls = 0;
  const fetcher = async () => {
    calls++;
    return { n: calls };
  };
  const first = await getCachedOrFetch(fetcher);
  const second = await getCachedOrFetch(fetcher);
  assert.equal(calls, 1, "fetcher should only run once");
  assert.deepEqual(first, second);
  assert.deepEqual(first, { n: 1 });
});

test("concurrent cache-miss callers share one in-flight fetch (single-flight)", async () => {
  let calls = 0;
  const fetcher = async () => {
    calls++;
    await sleep(30);
    return { n: calls };
  };
  const [a, b, c] = await Promise.all([
    getCachedOrFetch(fetcher),
    getCachedOrFetch(fetcher),
    getCachedOrFetch(fetcher),
  ]);
  assert.equal(calls, 1, "three concurrent misses should trigger exactly one fetch");
  assert.deepEqual(a, { n: 1 });
  assert.deepEqual(b, { n: 1 });
  assert.deepEqual(c, { n: 1 });
});

test("invalidateMenuCatalogCache forces the next call to refetch", async () => {
  let calls = 0;
  const fetcher = async () => {
    calls++;
    return { n: calls };
  };
  await getCachedOrFetch(fetcher);
  invalidateMenuCatalogCache();
  const after = await getCachedOrFetch(fetcher);
  assert.equal(calls, 2, "expected a second fetch after invalidation");
  assert.deepEqual(after, { n: 2 });
});

test("a fetch already in flight when invalidated does not repopulate the cache with stale data", async () => {
  let calls = 0;
  const fetcher = async () => {
    calls++;
    const myCall = calls;
    await sleep(40); // slow fetch, simulating the write racing ahead of it
    return { n: myCall };
  };

  const staleFetchPromise = getCachedOrFetch(fetcher); // starts fetch #1
  await sleep(10); // let #1 begin before invalidating
  invalidateMenuCatalogCache();

  const staleResult = await staleFetchPromise;
  assert.deepEqual(staleResult, { n: 1 }, "the caller who started the stale fetch still gets its own result");

  // Now that the stale fetch has resolved, a fresh call must trigger a NEW
  // fetch rather than reading whatever the stale one wrote into the cache —
  // if the race were handled wrong, this would return the stale {n:1}
  // without incrementing `calls` again.
  const fresh = await getCachedOrFetch(fetcher);
  assert.equal(calls, 2, "expected the post-invalidation call to trigger its own fetch, not reuse the stale one");
  assert.deepEqual(fresh, { n: 2 });
});

test("expires after the TTL and refetches", async () => {
  _setTtlMsForTests(20);
  let calls = 0;
  const fetcher = async () => {
    calls++;
    return { n: calls };
  };
  const first = await getCachedOrFetch(fetcher);
  assert.equal(calls, 1);

  // Still within TTL — must NOT refetch.
  const stillCached = await getCachedOrFetch(fetcher);
  assert.equal(calls, 1);
  assert.deepEqual(stillCached, first);

  await sleep(30); // past the 20ms TTL
  const afterExpiry = await getCachedOrFetch(fetcher);
  assert.equal(calls, 2, "expected a refetch once the TTL elapsed");
  assert.deepEqual(afterExpiry, { n: 2 });
});
