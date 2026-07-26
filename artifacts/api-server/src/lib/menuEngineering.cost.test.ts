/**
 * Regression: an unknown food cost must not be read as free food.
 *
 * `loadDynamicRecipeCosts` matches recipe ingredients to inventory rows by
 * fuzzy substring, so misses are routine. It used to record a miss as `0`, and
 * `aggregateDishStats` then did:
 *
 *     const costPaiseUnit = lookup.foodCostPaise ?? defaultEstimate;
 *
 * `??` only falls back on null/undefined, so a recorded 0 was taken as a real
 * measurement — the dish cost nothing to make, therefore 100% margin. Margin is
 * one of the two axes of the star/plowhorse/puzzle/dog matrix, so the dish we
 * knew the LEAST about outranked dishes with real costings, was classified a
 * star, and drew a +5% pricing suggestion. Approving that suggestion writes
 * menu_items.price_paise, which is the price the customer actually pays at
 * checkout. Missing data raised a real price.
 *
 * DB-free: only pure functions are exercised.
 * Run from artifacts/api-server:
 *   node --test --import tsx ./src/lib/menuEngineering.cost.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";

process.env["DATABASE_URL"] ||= "postgresql://dummy:dummy@localhost:5432/dummy";

const { classifyDishes, costPerUnitPaise, DEFAULT_MARGIN_PCT } = await import(
  "./menuEngineering"
);

const PRICE = 30_000; // ₹300.00 in paise
const REAL_COST = 18_000; // ₹180.00 — a dish we have actually costed

test("a known positive cost is used as measured", () => {
  const r = costPerUnitPaise(REAL_COST, PRICE, DEFAULT_MARGIN_PCT);
  assert.deepEqual(r, { costPaise: REAL_COST, estimated: false });
});

test("null / 0 / negative all mean UNKNOWN, and all fall back identically", () => {
  const expected = {
    costPaise: Math.round(PRICE * (1 - DEFAULT_MARGIN_PCT)),
    estimated: true,
  };
  for (const unknown of [null, 0, -1, -500]) {
    assert.deepEqual(
      costPerUnitPaise(unknown, PRICE, DEFAULT_MARGIN_PCT),
      expected,
      `food cost ${unknown} must be treated as unknown, not as a measurement`,
    );
  }
});

test("a zero cost never yields 100% margin", () => {
  const { costPaise } = costPerUnitPaise(0, PRICE, DEFAULT_MARGIN_PCT);
  assert.ok(
    costPaise > 0,
    "cost of zero must not survive into the margin calculation — food is not free",
  );
  assert.equal(PRICE - costPaise, 10_500, "35% of ₹300 is ₹105");
});

test("the estimate never exceeds the price (no negative cost from a free item)", () => {
  const { costPaise } = costPerUnitPaise(null, 0, DEFAULT_MARGIN_PCT);
  assert.equal(costPaise, 0);
});

// ── the consequence the fix exists to prevent ────────────────────────────────
//
// Two dishes, same price, same volume. One is costed; the other's ingredients
// failed to match inventory. Under the old arithmetic the uncosted one booked
// the entire ticket as margin and took the star slot away from the dish that
// actually earns it.
test("an uncosted dish does not steal the star ranking from a costed one", () => {
  const UNITS = 10;
  const costed = costPerUnitPaise(REAL_COST, PRICE, DEFAULT_MARGIN_PCT);
  const uncosted = costPerUnitPaise(null, PRICE, DEFAULT_MARGIN_PCT);

  const stats = [
    {
      slug: "costed-bowl",
      name: "Costed Bowl",
      ordersCount: UNITS,
      unitsSold: UNITS,
      revenuePaise: PRICE * UNITS,
      marginPaise: (PRICE - costed.costPaise) * UNITS,
    },
    {
      slug: "uncosted-bowl",
      name: "Uncosted Bowl",
      ordersCount: UNITS,
      unitsSold: UNITS,
      revenuePaise: PRICE * UNITS,
      marginPaise: (PRICE - uncosted.costPaise) * UNITS,
    },
  ];

  const byslug = new Map(classifyDishes(stats).map((d) => [d.slug, d]));
  assert.equal(byslug.get("costed-bowl")?.classification, "star");
  assert.equal(byslug.get("uncosted-bowl")?.classification, "plowhorse");

  // And the star recommendation — the one that becomes a +5% price rise — lands
  // on the dish whose margin we can defend.
  assert.equal(byslug.get("costed-bowl")?.recommendation, "promote");
  assert.notEqual(byslug.get("uncosted-bowl")?.recommendation, "promote");
});

test("under the OLD arithmetic the ranking inverted — this is what regressed", () => {
  const UNITS = 10;
  // Reproduce the pre-fix behaviour verbatim: `foodCostPaise ?? default`, with
  // a stored 0 sailing straight through the ?? as if it were a measurement.
  const oldCost = (foodCostPaise: number | null): number =>
    foodCostPaise ?? Math.round(PRICE * (1 - DEFAULT_MARGIN_PCT));

  const stats = [
    {
      slug: "costed-bowl",
      name: "Costed Bowl",
      ordersCount: UNITS,
      unitsSold: UNITS,
      revenuePaise: PRICE * UNITS,
      marginPaise: (PRICE - oldCost(REAL_COST)) * UNITS,
    },
    {
      slug: "uncosted-bowl",
      name: "Uncosted Bowl",
      ordersCount: UNITS,
      unitsSold: UNITS,
      revenuePaise: PRICE * UNITS,
      marginPaise: (PRICE - oldCost(0)) * UNITS, // 0 → 100% margin
    },
  ];

  const byslug = new Map(classifyDishes(stats).map((d) => [d.slug, d]));
  assert.equal(
    byslug.get("uncosted-bowl")?.classification,
    "star",
    "documents the defect: missing data outranked real data",
  );
  assert.equal(byslug.get("costed-bowl")?.classification, "plowhorse");
});
