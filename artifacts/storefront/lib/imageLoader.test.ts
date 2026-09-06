/**
 * The custom next/image loader. Pinned because every <Image> in the app routes
 * through it and the failure mode is silent: a malformed URL still renders a
 * box, it just 404s the photo.
 * Run: node --test --import tsx ./lib/imageLoader.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import imageLoader from "./imageLoader";

test("maps a bare dish jpeg to its nearest pre-generated derivative", () => {
  assert.equal(
    imageLoader({ src: "/images/dishes/paneer-tikka.jpg", width: 256 }),
    "/images/dishes/paneer-tikka-400.jpg",
  );
});

test("maps a dish jpeg below the smallest bucket to -200", () => {
  assert.equal(
    imageLoader({ src: "/images/dishes/paneer-tikka.jpg", width: 96 }),
    "/images/dishes/paneer-tikka-200.jpg",
  );
});

test("maps a dish jpeg above the largest bucket to -800, never the full-size original", () => {
  assert.equal(
    imageLoader({ src: "/images/dishes/paneer-tikka.jpg", width: 1920 }),
    "/images/dishes/paneer-tikka-800.jpg",
  );
});

test("quality is irrelevant to dish derivative selection — the upstream ignores it either way", () => {
  assert.equal(
    imageLoader({ src: "/images/dishes/paneer-tikka.jpg", width: 400, quality: 90 }),
    "/images/dishes/paneer-tikka-400.jpg",
  );
});

test("non-dish paths keep the original passthrough — no confirmed derivative exists for them", () => {
  assert.equal(
    imageLoader({ src: "/images/landing/hero.png", width: 640, quality: 90 }),
    "/images/landing/hero.png?w=640&q=90",
  );
});

test("a dish path that already carries a query string is not re-matched as a bare jpeg", () => {
  assert.equal(
    imageLoader({ src: "/images/dishes/a.jpg?v=3", width: 128 }),
    "/images/dishes/a.jpg?v=3&w=128&q=75",
  );
});

test("a dish path with a non-jpg extension keeps the passthrough — no derivative for it", () => {
  assert.equal(
    imageLoader({ src: "/images/dishes/a.png", width: 128 }),
    "/images/dishes/a.png?w=128&q=75",
  );
});

test("leaves a data: URI untouched — a query string would corrupt the payload", () => {
  const src = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
  assert.equal(imageLoader({ src, width: 96 }), src);
});

test("stays same-origin — never rewrites the path onto another host", () => {
  const out = imageLoader({ src: "/images/dishes/a.jpg", width: 384 });
  assert.ok(out.startsWith("/images/"));
  assert.ok(!out.includes("//"));
});

// ── remote URLs that already carry sizing params ────────────────────────────
// 49 of the 95 live dishes are `https://images.unsplash.com/…?w=800&q=80`, and
// imgix honours the FIRST `w`. Appending a second pair produced
// `?w=800&q=80&w=48&q=75`, which the CDN answered with the 800px file:
// measured 104,874 bytes for a 48px thumbnail, vs 4,195 for a clean `?w=48`
// (2026-09-06 audit). Every candidate in a srcset collapsed to the same file.

test("REPLACES an existing w/q rather than appending a second pair", () => {
  const out = imageLoader({ src: "https://images.unsplash.com/photo-1?w=800&q=80", width: 48, quality: 75 });
  assert.equal(out, "https://images.unsplash.com/photo-1?w=48&q=75");
  assert.equal(out.match(/[?&]w=/g)?.length, 1);
  assert.equal(out.match(/[?&]q=/g)?.length, 1);
});

test("keeps every other query param on a remote URL", () => {
  assert.equal(
    imageLoader({ src: "https://images.unsplash.com/photo-1?fm=jpg&w=800&fit=crop", width: 400 }),
    "https://images.unsplash.com/photo-1?fm=jpg&w=400&fit=crop&q=75",
  );
});

test("adds w/q to a remote URL that has none", () => {
  assert.equal(
    imageLoader({ src: "https://images.unsplash.com/photo-1", width: 640, quality: 80 }),
    "https://images.unsplash.com/photo-1?w=640&q=80",
  );
});

test("a same-origin non-dish path stays relative — never absolutised", () => {
  // A leading-slash src must not come back as https://placeholder.invalid/...
  assert.equal(imageLoader({ src: "/brand/hero.jpg", width: 320 }), "/brand/hero.jpg?w=320&q=75");
  assert.equal(imageLoader({ src: "/images/team/chef.png?v=2", width: 96 }), "/images/team/chef.png?v=2&w=96&q=75");
});

test("a data: URI is returned untouched", () => {
  const uri = "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=";
  assert.equal(imageLoader({ src: uri, width: 48 }), uri);
});

