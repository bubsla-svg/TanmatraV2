// Run: cd artifacts/storefront && node --test --import tsx ./lib/trialBundle.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { EMPTY_CART } from "./cartStore";
import { menuHrefWithSrc, trioCartLines, trioTotalPaise, withTrioInCart } from "./trialBundle";
import type { TrioDish } from "./trialTrio";

const trio: TrioDish[] = [
  { id: 1, pricePaise: 19900, isAvailable: true, slug: "a", name: "A", image: "/a.jpg", macros: { calories: 500, protein: 30 }, macrosEstimated: false },
  { id: 2, pricePaise: 24900, isAvailable: true, slug: "b", name: "B", image: "/b.jpg" },
  { id: 3, pricePaise: 22900, isAvailable: false, slug: "c", name: "C", image: "/c.jpg" },
];

test("the trio total is the sum of the catalog prices — never a restated ₹399", () => {
  assert.equal(trioTotalPaise(trio), 19900 + 24900 + 22900);
  assert.equal(trioTotalPaise([]), 0);
});

test("cart lines carry id, slug, name and the catalog price snapshot, plus macros only when vouched for", () => {
  const lines = trioCartLines(trio);
  assert.deepEqual(
    lines.map((l) => [l.dishId, l.kind, l.slug, l.pricePaise]),
    [[1, "dish", "a", 19900], [2, "dish", "b", 24900], [3, "dish", "c", 22900]],
  );
  assert.deepEqual(lines[0]!.macros, { calories: 500, protein: 30, estimated: false });
  assert.equal(lines[1]!.macros, undefined);
});

test("withTrioInCart adds one line per available dish and skips an unavailable one (D-19 backstop)", () => {
  const cart = withTrioInCart(EMPTY_CART, trio);
  assert.deepEqual(cart.lines.map((l) => [l.slug, l.qty]), [["a", 1], ["b", 1]]);
  // Adding the trio twice bumps quantities rather than duplicating lines.
  const again = withTrioInCart(cart, trio);
  assert.deepEqual(again.lines.map((l) => [l.slug, l.qty]), [["a", 2], ["b", 2]]);
  // Pure: the input cart is untouched.
  assert.equal(EMPTY_CART.lines.length, 0);
});

test("menuHrefWithSrc forwards the placement and nothing else", () => {
  assert.equal(menuHrefWithSrc("?src=gym12&ref=ABC"), "/menu?src=gym12");
  assert.equal(menuHrefWithSrc(""), "/menu");
  assert.equal(menuHrefWithSrc("?ref=ABC"), "/menu");
});
