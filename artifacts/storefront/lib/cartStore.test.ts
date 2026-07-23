/**
 * Pure cart-core tests (SF-02). DB-free, DOM-free.
 * Run: node --test --import tsx ./lib/cartStore.test.ts (from artifacts/api-server
 * for the tsx loader, per the storefront lib test convention).
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_CART,
  MAX_QTY_PER_LINE,
  addLine,
  setQty,
  itemCount,
  subtotalPaise,
  qtyOf,
  parseStoredCart,
} from "./cartStore";

const dish = { dishId: 7, slug: "quinoa-khichdi", name: "Quinoa Khichdi", pricePaise: 19900 };

test("addLine adds at qty 1, re-add increments the same line", () => {
  let s = addLine(EMPTY_CART, dish);
  assert.equal(itemCount(s), 1);
  s = addLine(s, dish);
  assert.equal(s.lines.length, 1);
  assert.equal(qtyOf(s, 7), 2);
});

test("subtotal is servers-price × qty, display-only arithmetic", () => {
  let s = addLine(EMPTY_CART, dish);
  s = addLine(s, { dishId: 9, slug: "hummus-pita-classic", name: "Hummus Pita", pricePaise: 24900 });
  s = setQty(s, 7, 3);
  assert.equal(subtotalPaise(s), 3 * 19900 + 24900);
});

test("setQty clamps to [0, MAX]; zero removes the line", () => {
  let s = addLine(EMPTY_CART, dish);
  s = setQty(s, 7, 99);
  assert.equal(qtyOf(s, 7), MAX_QTY_PER_LINE);
  s = setQty(s, 7, 0);
  assert.equal(s.lines.length, 0);
});

test("immutability: operations never mutate the input state", () => {
  const before = addLine(EMPTY_CART, dish);
  const snapshot = JSON.stringify(before);
  setQty(before, 7, 5);
  addLine(before, dish);
  assert.equal(JSON.stringify(before), snapshot);
});

test("parseStoredCart survives garbage, wrong shapes, and hostile values", () => {
  assert.deepEqual(parseStoredCart(null), EMPTY_CART);
  assert.deepEqual(parseStoredCart("not json {"), EMPTY_CART);
  assert.deepEqual(parseStoredCart('{"lines":"nope"}'), EMPTY_CART);
  const mixed = JSON.stringify({
    lines: [
      { dishId: 7, slug: "a", name: "A", pricePaise: 100, qty: 2 },
      { dishId: "bad", slug: 1, qty: -5 },
      { dishId: 8, slug: "b", name: "B", pricePaise: -1, qty: 1 },
      { dishId: 9, slug: "c", name: "C", pricePaise: 100, qty: 999 },
    ],
  });
  const s = parseStoredCart(mixed);
  assert.equal(s.lines.length, 1);
  assert.equal(s.lines[0]?.dishId, 7);
});
