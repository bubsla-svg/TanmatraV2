/**
 * The custom next/image loader. Pinned because every <Image> in the app routes
 * through it and the failure mode is silent: a malformed URL still renders a
 * box, it just 404s the photo.
 * Run: node --test --import tsx ./lib/imageLoader.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import imageLoader from "./imageLoader";

test("appends w + default q to a bare /images path", () => {
  assert.equal(
    imageLoader({ src: "/images/dishes/paneer-tikka.jpg", width: 256 }),
    "/images/dishes/paneer-tikka.jpg?w=256&q=75",
  );
});

test("honours an explicit quality", () => {
  assert.equal(
    imageLoader({ src: "/images/landing/hero.png", width: 640, quality: 90 }),
    "/images/landing/hero.png?w=640&q=90",
  );
});

test("keeps an existing query string and joins with &", () => {
  assert.equal(
    imageLoader({ src: "/images/dishes/a.jpg?v=3", width: 128 }),
    "/images/dishes/a.jpg?v=3&w=128&q=75",
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
