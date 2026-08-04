/**
 * Integration test for the getMergedCatalog() caching wired in for
 * OA-DEEP-1.3 (TODO_optimization-auditor.md): pure cache-logic correctness
 * is covered by menuCatalogCache.test.ts; this proves the wiring itself
 * against real Postgres — a cached read genuinely skips the DB, and the
 * real write paths (updatePrice, setAvailability, allergenReviewState via
 * updateItem) genuinely invalidate it.
 *
 * Run from artifacts/api-server:
 *   DATABASE_URL=... node --test --test-force-exit --import tsx ./src/lib/menuResolver.cache.test.ts
 */
import assert from "node:assert/strict";
import { test, before, after, beforeEach } from "node:test";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, menuItemsTable } from "@workspace/db";
import { getMergedCatalog } from "./menuResolver";
import { updatePrice, setAvailability, updateItem } from "./menu";
import { _resetMenuCatalogCacheForTests, _setTtlMsForTests } from "./menuCatalogCache";

const SLUG = `cache-test-dish-${randomUUID().slice(0, 8)}`;

before(async () => {
  await db.insert(menuItemsTable).values({
    slug: SLUG,
    name: "Cache Test Dish",
    pricePaise: 10_000,
    category: "mains",
    isAvailable: true,
  });
});

after(async () => {
  await db.delete(menuItemsTable).where(eq(menuItemsTable.slug, SLUG));
});

beforeEach(() => {
  _resetMenuCatalogCacheForTests();
  _setTtlMsForTests(60_000); // long enough that nothing in this file expires mid-test
});

function findTestDish(catalog: Awaited<ReturnType<typeof getMergedCatalog>>) {
  return catalog.find((d) => d.slug === SLUG);
}

test("a cached read does not see a write made directly against the DB (proves it's actually cached, not just consistent)", async () => {
  const first = await getMergedCatalog();
  assert.equal(findTestDish(first)?.price, 10_000);

  // Bypass the invalidating write path entirely — a raw DB write, exactly
  // like an external process or a migration would do.
  await db.update(menuItemsTable).set({ pricePaise: 99_999 }).where(eq(menuItemsTable.slug, SLUG));

  const second = await getMergedCatalog();
  assert.equal(
    findTestDish(second)?.price,
    10_000,
    "expected the cached (stale) price — the raw write bypassed invalidation, proving getMergedCatalog() is actually serving from cache",
  );

  // Restore for subsequent tests via the real write path (which invalidates).
  await updatePrice(SLUG, 10_000);
});

test("updatePrice invalidates the cache — the next read sees the new price", async () => {
  const before_ = await getMergedCatalog();
  assert.equal(findTestDish(before_)?.price, 10_000);

  await updatePrice(SLUG, 45_000);

  const after_ = await getMergedCatalog();
  assert.equal(findTestDish(after_)?.price, 45_000, "expected the new price immediately after updatePrice");

  await updatePrice(SLUG, 10_000); // restore
});

test("setAvailability invalidates the cache", async () => {
  await getMergedCatalog(); // warm the cache
  await setAvailability(SLUG, false, "test", null);

  const after_ = await getMergedCatalog();
  assert.equal(findTestDish(after_)?.isAvailable, false);

  await setAvailability(SLUG, true, null, null); // restore
});

test("updateItem invalidates the cache (allergenReviewState demotion on a safety-relevant edit)", async () => {
  await updateItem(SLUG, { allergenReviewState: "reviewed" });
  await getMergedCatalog(); // warm the cache with rdReviewState="reviewed"

  // Editing isVeg (a SAFETY_RELEVANT_FIELDS entry) with no explicit
  // allergenReviewState must demote the row back to pending_review — and
  // that demotion must be visible on the very next catalog read.
  await updateItem(SLUG, { isVeg: false });

  const after_ = await getMergedCatalog();
  const dish = findTestDish(after_);
  assert.equal(dish?.isVeg, false);
  assert.equal(dish?.rdReviewState, "pending_review");
});
