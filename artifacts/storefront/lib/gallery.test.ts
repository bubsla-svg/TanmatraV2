/**
 * PDP gallery image-set assembly. Locks: the hero always leads; companions
 * follow in the fixed delivered→ingredient→lifestyle→packaging order; repeated
 * photos are de-duplicated; a dish with no companions renders exactly one frame.
 * Run: node --test --import tsx ./lib/gallery.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { DISHES } from "@workspace/menu-catalog";
import { galleryImages } from "./gallery";

type G = Parameters<typeof galleryImages>[0];
function g(overrides: Partial<G>): G {
  return { image: "/hero.jpg", ...overrides } as G;
}

test("single-image dish yields exactly the hero", () => {
  assert.deepEqual(galleryImages(g({})), ["/hero.jpg"]);
});

test("companions follow the hero in delivered→ingredient→lifestyle→packaging order", () => {
  const out = galleryImages(
    g({
      imageLifestyle: "/life.jpg",
      imagePackaging: "/pack.jpg",
      imageDelivered: "/deliv.jpg",
      imageIngredient: "/ingr.jpg",
    }),
  );
  assert.deepEqual(out, ["/hero.jpg", "/deliv.jpg", "/ingr.jpg", "/life.jpg", "/pack.jpg"]);
});

test("a photo reused across fields is rendered once (hero wins)", () => {
  const out = galleryImages(g({ imageDelivered: "/hero.jpg", imageIngredient: "/ingr.jpg" }));
  assert.deepEqual(out, ["/hero.jpg", "/ingr.jpg"]);
});

test("absent/empty companion fields are skipped, order preserved", () => {
  const out = galleryImages(g({ imageIngredient: "/ingr.jpg", imagePackaging: "" as unknown as string }));
  assert.deepEqual(out, ["/hero.jpg", "/ingr.jpg"]);
});

test("works on a real catalog dish without throwing", () => {
  const out = galleryImages(DISHES[0]!);
  assert.ok(out.length >= 1);
  assert.equal(out[0], DISHES[0]!.image);
});
