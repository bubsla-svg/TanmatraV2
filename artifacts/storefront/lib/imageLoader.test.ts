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
