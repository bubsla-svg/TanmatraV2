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

const dish = { dishId: 7, kind: "dish" as const, slug: "quinoa-khichdi", name: "Quinoa Khichdi", pricePaise: 19900 };

test("addLine adds at qty 1, re-add increments the same line", () => {
  let s = addLine(EMPTY_CART, dish);
  assert.equal(itemCount(s), 1);
  s = addLine(s, dish);
  assert.equal(s.lines.length, 1);
  assert.equal(qtyOf(s, 7, "dish"), 2);
});

test("subtotal is servers-price × qty, display-only arithmetic", () => {
  let s = addLine(EMPTY_CART, dish);
  s = addLine(s, { dishId: 9, kind: "dish", slug: "hummus-pita-classic", name: "Hummus Pita", pricePaise: 24900 });
  s = setQty(s, 7, "dish", 3);
  assert.equal(subtotalPaise(s), 3 * 19900 + 24900);
});

test("setQty clamps to [0, MAX]; zero removes the line", () => {
  let s = addLine(EMPTY_CART, dish);
  s = setQty(s, 7, "dish", 99);
  assert.equal(qtyOf(s, 7, "dish"), MAX_QTY_PER_LINE);
  s = setQty(s, 7, "dish", 0);
  assert.equal(s.lines.length, 0);
});

test("immutability: operations never mutate the input state", () => {
  const before = addLine(EMPTY_CART, dish);
  const snapshot = JSON.stringify(before);
  setQty(before, 7, "dish", 5);
  addLine(before, dish);
  assert.equal(JSON.stringify(before), snapshot);
});

test("parseStoredCart survives garbage, wrong shapes, and hostile values", () => {
  assert.deepEqual(parseStoredCart(null), EMPTY_CART);
  assert.deepEqual(parseStoredCart("not json {"), EMPTY_CART);
  assert.deepEqual(parseStoredCart('{"lines":"nope"}'), EMPTY_CART);
  const mixed = JSON.stringify({
    lines: [
      { dishId: 7, kind: "dish", slug: "a", name: "A", pricePaise: 100, qty: 2 },
      { dishId: "bad", slug: 1, qty: -5 },
      { dishId: 8, kind: "dish", slug: "b", name: "B", pricePaise: -1, qty: 1 },
      { dishId: 9, kind: "dish", slug: "c", name: "C", pricePaise: 100, qty: 999 },
    ],
  });
  const s = parseStoredCart(mixed);
  assert.equal(s.lines.length, 1);
  assert.equal(s.lines[0]?.dishId, 7);
});

// ── D-19: availability defense-in-depth ─────────────────────────────────────

test("addLine refuses a line explicitly marked unavailable", () => {
  const s = addLine(EMPTY_CART, dish, { isAvailable: false });
  assert.deepEqual(s, EMPTY_CART, "an unavailable dish must not enter the cart");
});

test("addLine still adds when isAvailable is true or omitted", () => {
  let s = addLine(EMPTY_CART, dish, { isAvailable: true });
  assert.equal(itemCount(s), 1);
  s = addLine(EMPTY_CART, dish); // no opts at all — every pre-existing call site
  assert.equal(itemCount(s), 1);
});

test("an unavailable re-add does not bump the qty of an already-present line", () => {
  let s = addLine(EMPTY_CART, dish); // legitimately added while available
  s = addLine(s, dish, { isAvailable: false }); // dish paused before the next tap
  assert.equal(qtyOf(s, 7, "dish"), 1, "a refused add must not touch the existing line");
});

// ── Customised lines: identity must not collide with a plain line ──────────

const customBread = {
  dishId: 121,
  kind: "dish" as const,
  slug: "grilled-veggie-sandwich-ranch-yoghurt",
  name: "Grilled Veggie Sandwich",
  pricePaise: 27500,
  customizations: ["Multigrain Bread"],
};

test("a customised add does not merge into a plain line for the same dish", () => {
  let s = addLine(EMPTY_CART, { dishId: 121, kind: "dish", slug: customBread.slug, name: "Grilled Veggie Sandwich", pricePaise: 26000 });
  s = addLine(s, customBread);
  assert.equal(s.lines.length, 2, "plain and customised are separate lines");
  assert.equal(qtyOf(s, 121, "dish"), 1, "the PLAIN line's qty is untouched");
  assert.equal(qtyOf(s, 121, "dish", customBread.customizations), 1);
});

test("two different customisations of the same dish stay as separate lines", () => {
  const other = { ...customBread, customizations: ["Extra Chipotle Sauce"] };
  let s = addLine(EMPTY_CART, customBread);
  s = addLine(s, other);
  assert.equal(s.lines.length, 2);
  assert.equal(qtyOf(s, 121, "dish", customBread.customizations), 1);
  assert.equal(qtyOf(s, 121, "dish", other.customizations), 1);
});

test("re-adding the SAME customisation increments that line, not a new one", () => {
  let s = addLine(EMPTY_CART, customBread);
  s = addLine(s, customBread);
  assert.equal(s.lines.length, 1);
  assert.equal(qtyOf(s, 121, "dish", customBread.customizations), 2);
});

test("customisation label order does not create a duplicate line (signature is order-independent)", () => {
  const a = { ...customBread, customizations: ["Multigrain Bread", "Extra Sauce"] };
  const b = { ...customBread, customizations: ["Extra Sauce", "Multigrain Bread"] };
  let s = addLine(EMPTY_CART, a);
  s = addLine(s, b);
  assert.equal(s.lines.length, 1);
  assert.equal(qtyOf(s, 121, "dish", a.customizations), 2);
});

test("setQty on a customised line's signature only clears that line, leaving the plain one intact", () => {
  let s = addLine(EMPTY_CART, { dishId: 121, kind: "dish", slug: customBread.slug, name: "Grilled Veggie Sandwich", pricePaise: 26000 });
  s = addLine(s, customBread);
  s = setQty(s, 121, "dish", 0, customBread.customizations);
  assert.equal(s.lines.length, 1);
  assert.equal(qtyOf(s, 121, "dish"), 1, "plain line survives");
  assert.equal(qtyOf(s, 121, "dish", customBread.customizations), 0);
});

test("existing 3-arg setQty/qtyOf call sites keep targeting the plain line only (back-compat)", () => {
  let s = addLine(EMPTY_CART, customBread);
  // No caller anywhere in the app can accidentally touch a customised line by
  // omitting the 4th argument — every pre-existing 3-arg call site must keep
  // behaving exactly as it did before this field existed. setQty only ever
  // updates an EXISTING matching line, so with no plain line present this is
  // a no-op — it must not touch the customised line, and must not fabricate
  // a plain line either.
  assert.equal(qtyOf(s, 121, "dish"), 0);
  s = setQty(s, 121, "dish", 5);
  assert.equal(s.lines.length, 1, "no plain line existed to update — nothing created");
  assert.equal(qtyOf(s, 121, "dish", customBread.customizations), 1, "customised line untouched");
});
