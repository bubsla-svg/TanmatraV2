import assert from "node:assert/strict";
import { test } from "node:test";
import { computeBundleDiscountPaise, type BundleDef } from "./bundlePricing";

// Ids: 1 = Peri Peri Paneer Fiesta Rice Bowl, 2 = Tomato Basil Soup,
//      3 = a light salad (for the Wellness Light combo).
const LUNCH_BALANCE: BundleDef = {
  slug: "lunch-balance-combo",
  dishIds: [1, 2],
  originalPricePaise: 26000, // ₹260 standalone total
  pricePaise: 23500, // ₹235 combo price → ₹25 saving
};
const WELLNESS_LIGHT: BundleDef = {
  slug: "wellness-light-combo",
  dishIds: [1, 3],
  originalPricePaise: 18500,
  pricePaise: 16500, // ₹20 saving
};

// ── Scenario 1 (the reported exploit) ────────────────────────────────────────
test("SCENARIO 1: dropping the soup but keeping the combo slug forfeits the discount", () => {
  const discount = computeBundleDiscountPaise({
    requestedSlugs: ["lunch-balance-combo"], // combo still claimed
    bundles: [LUNCH_BALANCE],
    items: [{ id: 1, qty: 1 }], // soup (id 2) deleted from the payload
    grossPaise: 22000, // Rice Bowl standalone price
  });
  // Fail-closed: no discount → the cart is charged the standalone total.
  assert.equal(discount, 0);
});

test("the complete combo earns exactly the server-defined saving", () => {
  const discount = computeBundleDiscountPaise({
    requestedSlugs: ["lunch-balance-combo"],
    bundles: [LUNCH_BALANCE],
    items: [{ id: 1, qty: 1 }, { id: 2, qty: 1 }],
    grossPaise: 26000,
  });
  assert.equal(discount, 2500); // ₹25, from originalPricePaise - pricePaise
});

// ── Related tamper vectors ───────────────────────────────────────────────────
test("insufficient quantity of a component is treated as missing", () => {
  // Two combos claimed, but only one soup in the cart → second combo unsatisfiable.
  const discount = computeBundleDiscountPaise({
    requestedSlugs: ["lunch-balance-combo", "lunch-balance-combo"],
    bundles: [LUNCH_BALANCE],
    items: [{ id: 1, qty: 2 }, { id: 2, qty: 1 }],
    grossPaise: 52000,
  });
  assert.equal(discount, 2500); // only one instance is satisfiable
});

test("two fully-stocked instances of the same combo earn two savings", () => {
  const discount = computeBundleDiscountPaise({
    requestedSlugs: ["lunch-balance-combo", "lunch-balance-combo"],
    bundles: [LUNCH_BALANCE],
    items: [{ id: 1, qty: 2 }, { id: 2, qty: 2 }],
    grossPaise: 52000,
  });
  assert.equal(discount, 5000); // 2 × ₹25
});

test("overlapping combos share a per-dish budget (one line can't satisfy both)", () => {
  // Cart has one Rice Bowl (shared component) + one soup + one salad. Both combos
  // need the Rice Bowl, so only the higher-saving one (Lunch Balance, ₹25) applies.
  const discount = computeBundleDiscountPaise({
    requestedSlugs: ["lunch-balance-combo", "wellness-light-combo"],
    bundles: [LUNCH_BALANCE, WELLNESS_LIGHT],
    items: [{ id: 1, qty: 1 }, { id: 2, qty: 1 }, { id: 3, qty: 1 }],
    grossPaise: 40000,
  });
  assert.equal(discount, 2500); // Lunch Balance wins; Wellness Light starved
});

test("an unknown / stale combo slug contributes nothing", () => {
  const discount = computeBundleDiscountPaise({
    requestedSlugs: ["does-not-exist"],
    bundles: [],
    items: [{ id: 1, qty: 1 }, { id: 2, qty: 1 }],
    grossPaise: 26000,
  });
  assert.equal(discount, 0);
});

test("the discount can never exceed the gross (no negative orders)", () => {
  const discount = computeBundleDiscountPaise({
    requestedSlugs: ["lunch-balance-combo"],
    bundles: [{ ...LUNCH_BALANCE, originalPricePaise: 100000, pricePaise: 0 }],
    items: [{ id: 1, qty: 1 }, { id: 2, qty: 1 }],
    grossPaise: 26000,
  });
  assert.equal(discount, 26000); // capped at grossPaise
});
