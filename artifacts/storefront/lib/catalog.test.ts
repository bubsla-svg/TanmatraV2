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
import { toProxiedImage, normalizeDishImages } from "./catalog";

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
