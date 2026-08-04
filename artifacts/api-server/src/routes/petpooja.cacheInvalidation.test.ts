/**
 * Proves the Petpooja inbound webhooks actually invalidate
 * menuCatalogCache — found missing by a post-merge audit of OA-DEEP-1.3
 * (menuCatalogCache.ts / #474): push-menu and item_stock(_off) write
 * price_paise/isAvailable via raw drizzle and never called
 * invalidateMenuCatalogCache(), so a stock-out or price push from the POS
 * could take up to the cache's 30s TTL to reach getMergedCatalog() readers
 * (storefront /menu, checkout's availability gate).
 *
 * Uses a real HTTP server + real Postgres (unlike petpooja.test.ts's mocked
 * db) — mocking would prove the route branches correctly, not that the
 * cache actually clears.
 *
 * Run from artifacts/api-server:
 *   DATABASE_URL=... node --test --test-force-exit --import tsx ./src/routes/petpooja.cacheInvalidation.test.ts
 */
import assert from "node:assert/strict";
import { test, before, after, beforeEach } from "node:test";
import http from "node:http";
import { type AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import express, { type Express } from "express";
import { eq } from "drizzle-orm";

process.env.PETPOOJA_APP_KEY = "key-abc";
process.env.PETPOOJA_APP_SECRET = "secret-xyz";
process.env.PETPOOJA_ACCESS_TOKEN = "token-123";
process.env.PETPOOJA_RESTAURANT_ID = "rest-42";
const AUTH = { "x-petpooja-app-secret": "secret-xyz" } as const;

const { db, menuItemsTable } = await import("@workspace/db");
const { getMergedCatalog } = await import("../lib/menuResolver");
const { _resetMenuCatalogCacheForTests, _setTtlMsForTests } = await import("../lib/menuCatalogCache");
const { default: petpoojaRouter } = await import("./petpooja");

const SLUG = `petpooja-cache-test-${randomUUID().slice(0, 8)}`;
const PETPOOJA_ID = `pp-${randomUUID().slice(0, 8)}`;

let server: http.Server;
let baseUrl = "";

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    req.log = { info: () => {}, warn: () => {}, error: () => {} };
    next();
  });
  app.use(petpoojaRouter);
  return app;
}

before(async () => {
  const app = makeApp();
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;

  await db.insert(menuItemsTable).values({
    slug: SLUG,
    name: "Petpooja Cache Test Dish",
    pricePaise: 10_000,
    category: "mains",
    isAvailable: true,
    tags: [`petpooja:${PETPOOJA_ID}`],
  });
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await db.delete(menuItemsTable).where(eq(menuItemsTable.slug, SLUG));
});

beforeEach(() => {
  _resetMenuCatalogCacheForTests();
  _setTtlMsForTests(60_000); // long enough that nothing here expires mid-test
});

function findTestDish(catalog: Awaited<ReturnType<typeof getMergedCatalog>>) {
  return catalog.find((d) => d.slug === SLUG);
}

test("item_stock invalidates the catalog cache — availability flips immediately, not after the TTL", async () => {
  const warm = await getMergedCatalog();
  assert.equal(findTestDish(warm)?.isAvailable, true);

  const res = await fetch(`${baseUrl}/integrations/petpooja/item_stock`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...AUTH },
    body: JSON.stringify({ restID: "rest-42", type: "item", inStock: false, itemID: [PETPOOJA_ID] }),
  });
  assert.equal(res.status, 200);

  const after_ = await getMergedCatalog();
  assert.equal(
    findTestDish(after_)?.isAvailable,
    false,
    "expected the 86'd item to disappear from the cached catalog immediately — a stale cache here means checkout keeps accepting orders for a dish the kitchen just ran out of",
  );
});

test("item_stock_off invalidates the catalog cache", async () => {
  await getMergedCatalog(); // warm

  const res = await fetch(`${baseUrl}/integrations/petpooja/item_stock_off`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...AUTH },
    body: JSON.stringify({ restID: "rest-42", type: "item", inStock: false, itemID: [PETPOOJA_ID] }),
  });
  assert.equal(res.status, 200);

  const after_ = await getMergedCatalog();
  assert.equal(findTestDish(after_)?.isAvailable, false);

  // Restore for the next test via the same real write path.
  const restore = await fetch(`${baseUrl}/integrations/petpooja/item_stock`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...AUTH },
    body: JSON.stringify({ restID: "rest-42", type: "item", inStock: true, itemID: [PETPOOJA_ID] }),
  });
  assert.equal(restore.status, 200);
});

test("push-menu invalidates the catalog cache — a POS name/description push is visible immediately", async () => {
  // TNM-ADM-01 ADM-28: push-menu no longer writes price_paise on an existing
  // row (the catalog is the sole price authority — see priceBands.ts and
  // routes/petpooja.ts's push-menu handler), so this no longer exercises
  // cache invalidation via a price change. It still exercises the #474
  // regression this file exists for — push-menu writes bypassing cache
  // invalidation — via a field push-menu still legitimately owns (name).
  const warm = await getMergedCatalog();
  assert.equal(findTestDish(warm)?.name, "Petpooja Cache Test Dish");
  assert.equal(findTestDish(warm)?.price, 10_000);

  const payload = {
    success: "1",
    restaurants: [{ restaurantid: "rest-42", details: { restaurantname: "Wellness Foods" } }],
    categories: [{ categoryid: "1", active: "1", categoryname: "Mains" }],
    items: [
      {
        itemid: PETPOOJA_ID,
        item_categoryid: "1",
        active: "1",
        in_stock: "1",
        // itemname must slugify() back to SLUG — push-menu upserts on the
        // slug conflict target, not the petpooja tag, so this is what makes
        // the payload land on the same row instead of inserting a new one.
        // The pushed itemname also becomes the new `name` — see below.
        itemname: SLUG,
        item_attributeid: "1",
        // Deliberately mismatched vs. the seeded 10000 paise, to assert
        // push-menu does NOT apply it (ADM-28), in the same request that
        // proves the cache still invalidates for the fields it does own.
        price: "250",
      },
    ],
    addongroups: [],
    attributes: [{ attributeid: "1", attribute: "veg", active: "1" }],
  };

  const res = await fetch(`${baseUrl}/integrations/petpooja/push-menu`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...AUTH },
    body: JSON.stringify(payload),
  });
  assert.equal(res.status, 200);

  const after_ = await getMergedCatalog();
  assert.equal(
    findTestDish(after_)?.name,
    SLUG,
    "expected the pushed name immediately — a stale cache here means the storefront shows stale POS-sourced fields",
  );
  assert.equal(
    findTestDish(after_)?.price,
    10_000,
    "push-menu must never overwrite an existing item's price (ADM-28) — a stale cache is not the concern here, an unauthorized price write is",
  );

  // Restore.
  await db.update(menuItemsTable).set({ name: "Petpooja Cache Test Dish" }).where(eq(menuItemsTable.slug, SLUG));
  _resetMenuCatalogCacheForTests();
});
