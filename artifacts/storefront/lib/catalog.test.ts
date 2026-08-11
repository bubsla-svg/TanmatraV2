/**
 * The live menu API references dish photos two ways — absolute Unsplash URLs
 * and legacy `/dishes/<f>` paths. The storefront only proxies `/images/*`, so
 * the `/dishes/` form 404s and the card blanks. These lock the normalization
 * that maps `/dishes/` onto the proxied `/images/dishes/` path while leaving
 * absolute and already-proxied URLs alone.
 * Run: node --test --import tsx ./lib/catalog.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import type { DishData } from "@workspace/menu-catalog";
import { toProxiedImage, normalizeDishImages, fetchMenu, checkMenuSource } from "./catalog";

test("toProxiedImage maps legacy /dishes/ onto the proxied /images/dishes/ path", () => {
  assert.equal(
    toProxiedImage("/dishes/barbeque-chicken-burrito-wrap.jpg"),
    "/images/dishes/barbeque-chicken-burrito-wrap.jpg",
  );
});

test("toProxiedImage leaves absolute (Unsplash) URLs untouched", () => {
  const url = "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&q=80";
  assert.equal(toProxiedImage(url), url);
});

test("toProxiedImage leaves already-proxied /images/ paths untouched", () => {
  const url = "/images/dishes/aglio-olio-veg.jpg";
  assert.equal(toProxiedImage(url), url);
});

const baseDish = {
  slug: "barbeque-chicken-burrito-wrap",
  name: "Barbeque Chicken Burrito Wrap",
  image: "/dishes/barbeque-chicken-burrito-wrap.jpg",
  imageDelivered: "/dishes/barbeque-chicken-burrito-wrap-delivered.jpg",
} as unknown as DishData;

test("normalizeDishImages fixes primary + companion image fields", () => {
  const out = normalizeDishImages(baseDish);
  assert.equal(out.image, "/images/dishes/barbeque-chicken-burrito-wrap.jpg");
  assert.equal(out.imageDelivered, "/images/dishes/barbeque-chicken-burrito-wrap-delivered.jpg");
});

test("normalizeDishImages is a pure copy — the input dish is not mutated", () => {
  const input = { ...baseDish };
  normalizeDishImages(input);
  assert.equal(input.image, "/dishes/barbeque-chicken-burrito-wrap.jpg");
});

test("normalizeDishImages leaves an already-correct dish unchanged", () => {
  const ok = { slug: "x", name: "X", image: "https://cdn.example/x.jpg" } as unknown as DishData;
  assert.equal(normalizeDishImages(ok).image, "https://cdn.example/x.jpg");
});

/**
 * D-06: fetchMenu()/checkMenuSource() call the platform `fetch` directly
 * (server-only, not fetchImpl-injectable), so these stub globalThis.fetch
 * and restore it afterwards — same convention as marketplaceApi.test.ts.
 */
const jsonRes = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const LIVE_DISH = {
  slug: "live-dish",
  name: "Live Dish",
  image: "/dishes/live-dish.jpg",
} as unknown as DishData;

test("fetchMenu returns the live catalog, normalized, and reports nothing on success", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => jsonRes({ dishes: [LIVE_DISH] })) as unknown as typeof fetch;
  let reportedCount = 0;
  try {
    const result = await fetchMenu(() => { reportedCount += 1; });
    assert.equal(result.source, "api");
    assert.equal(result.dishes[0]?.image, "/images/dishes/live-dish.jpg");
    assert.equal(reportedCount, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchMenu falls back and reports the reason when the live fetch throws", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => { throw new Error("network down"); }) as unknown as typeof fetch;
  const reported: unknown[] = [];
  try {
    const result = await fetchMenu((error) => reported.push(error));
    assert.equal(result.source, "fallback");
    assert.ok(result.dishes.length > 0);
    assert.equal(reported.length, 1);
    assert.equal((reported[0] as Error).message, "network down");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchMenu falls back and reports the reason on a non-OK response", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => jsonRes({}, 503)) as unknown as typeof fetch;
  const reported: unknown[] = [];
  try {
    const result = await fetchMenu((error) => reported.push(error));
    assert.equal(result.source, "fallback");
    assert.equal((reported[0] as Error).message, "menu 503");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchMenu falls back and reports the reason on an empty dishes array", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => jsonRes({ dishes: [] })) as unknown as typeof fetch;
  const reported: unknown[] = [];
  try {
    const result = await fetchMenu((error) => reported.push(error));
    assert.equal(result.source, "fallback");
    assert.equal((reported[0] as Error).message, "empty menu");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchMenu falls back cleanly through the real default reporter (no DSN in tests)", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => { throw new Error("network down"); }) as unknown as typeof fetch;
  try {
    const result = await fetchMenu();
    assert.equal(result.source, "fallback");
    assert.ok(result.dishes.length > 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("checkMenuSource mirrors fetchMenu's source determination on success", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => jsonRes({ dishes: [LIVE_DISH] })) as unknown as typeof fetch;
  try {
    assert.equal(await checkMenuSource(), "api");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("checkMenuSource reports fallback when the live API is unreachable", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => { throw new Error("network down"); }) as unknown as typeof fetch;
  try {
    assert.equal(await checkMenuSource(), "fallback");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("checkMenuSource reports fallback on a non-OK response", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => jsonRes({}, 500)) as unknown as typeof fetch;
  try {
    assert.equal(await checkMenuSource(), "fallback");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
