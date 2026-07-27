// Reorder core invariants (SF-09 tail / CUJ-09). Run with the api-server tsx loader:
//   cd artifacts/api-server && node --test --import tsx ../storefront/lib/reorder.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { EMPTY_CART, MAX_QTY_PER_LINE, type CartState } from "./cartStore";
import { reorderIntoCart, type ReorderMenuDish } from "./reorder";

const MENU: ReorderMenuDish[] = [
  { id: 1, slug: "quinoa-khichdi", name: "Quinoa Khichdi", price: 24900, isAvailable: true },
  { id: 2, slug: "alfredo-pasta-veg", name: "Alfredo Pasta (Veg)", price: 29900, isAvailable: true },
  { id: 3, slug: "retired-dish", name: "Retired Dish", price: 19900, isAvailable: false },
];

test("re-adds lines at TODAY's menu price, never the stored one", () => {
  const r = reorderIntoCart(EMPTY_CART, [{ id: 1, name: "Quinoa Khichdi", qty: 2, price: 19900 }], MENU);
  assert.equal(r.added, 1);
  assert.deepEqual(r.dropped, []);
  assert.equal(r.cart.lines[0]?.pricePaise, 24900); // today's ₹249, not the old ₹199
  assert.equal(r.cart.lines[0]?.qty, 2);
});

test("off-menu and unavailable lines are dropped BY NAME, never silently", () => {
  const r = reorderIntoCart(
    EMPTY_CART,
    [
      { id: 3, name: "Retired Dish", qty: 1, price: 19900 },
      { id: 99, name: "Gone Forever", qty: 1, price: 9900 },
      { id: 2, name: "Alfredo Pasta (Veg)", qty: 1, price: 29900 },
    ],
    MENU,
  );
  assert.equal(r.added, 1);
  assert.deepEqual(r.dropped, ["Retired Dish", "Gone Forever"]);
  assert.equal(r.cart.lines.length, 1);
  assert.equal(r.cart.lines[0]?.dishId, 2);
});

test("merges into an existing cart and clamps at the per-line max", () => {
  const current: CartState = {
    lines: [{ dishId: 1, kind: "dish", slug: "quinoa-khichdi", name: "Quinoa Khichdi", pricePaise: 24900, qty: 8 }],
  };
  const r = reorderIntoCart(current, [{ id: 1, name: "Quinoa Khichdi", qty: 5, price: 24900 }], MENU);
  assert.equal(r.cart.lines[0]?.qty, MAX_QTY_PER_LINE); // 8 + 5 clamps to 9
  assert.equal(r.added, 1);
});

test("an empty items list is a no-op with zero added and zero dropped", () => {
  const r = reorderIntoCart(EMPTY_CART, [], MENU);
  assert.equal(r.added, 0);
  assert.deepEqual(r.dropped, []);
  assert.deepEqual(r.cart, EMPTY_CART);
});
