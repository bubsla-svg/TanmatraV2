/**
 * BOM cost aggregation + the recipe-quantity conversion contract. DB-free —
 * aggregateBomCosts is pure and gramsFromQuantityText lives in
 * @workspace/menu-catalog, so this runs without DATABASE_URL.
 *
 * Run: node --test --import tsx ./src/lib/bomCosts.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { gramsFromQuantityText } from "@workspace/menu-catalog";
import { aggregateBomCosts, type BomRowInput, type InventoryPriceInput } from "./bomCosts";

const INV: InventoryPriceInput[] = [
  { id: 1, perKgUnitPaise: 21000, buyingPricePaise: null }, // chicken ₹210/kg
  { id: 2, perKgUnitPaise: null, buyingPricePaise: 18000 }, // eggs — buying-price fallback
  { id: 3, perKgUnitPaise: null, buyingPricePaise: null }, // unpriced (BASIL LEAVES case)
];

function row(slug: string, id: number, qty: number, unit = "g"): BomRowInput {
  return { dishSlug: slug, inventoryItemId: id, quantityNeeded: qty, unit };
}

test("a complete, fully-priced BOM sums to a cost", () => {
  const { costs, skipped } = aggregateBomCosts(
    [row("bowl", 1, 150), row("bowl", 2, 100)],
    INV,
  );
  // 150 g @ 21000/kg = 3150; 100 g @ 18000/kg (buying-price fallback) = 1800.
  assert.equal(costs.get("bowl"), 3150 + 1800);
  assert.equal(skipped.size, 0);
});

test("an unpriced item skips the WHOLE dish — no partial sums", () => {
  // The fuzzy path's defect is partial sums presented as totals (96 of 116
  // sheet dishes silently under-costed). The BOM path must not reproduce it:
  // one unpriced component means the dish's cost is unknown, not "the sum of
  // the parts we could price".
  const { costs, skipped } = aggregateBomCosts(
    [row("bowl", 1, 150), row("bowl", 3, 20)],
    INV,
  );
  assert.equal(costs.has("bowl"), false);
  const s = skipped.get("bowl")!;
  assert.deepEqual(s.unpricedItemIds, [3]);
  assert.ok(s.coverage > 0.8 && s.coverage < 1, "priced weight fraction reported");
});

test("zero quantity or unknown unit poisons the dish, never prices wrong", () => {
  const zero = aggregateBomCosts([row("a", 1, 0)], INV);
  assert.equal(zero.costs.size, 0);
  assert.ok(zero.skipped.has("a"));
  const weird = aggregateBomCosts([row("b", 1, 2, "count")], INV);
  assert.equal(weird.costs.size, 0, "a 'count' row cannot be weighed at runtime");
  assert.ok(weird.skipped.has("b"));
});

test("kg and ml units convert; dishes group independently", () => {
  const { costs } = aggregateBomCosts(
    [row("a", 1, 0.2, "kg"), row("b", 1, 100, "ml")],
    INV,
  );
  assert.equal(costs.get("a"), 4200); // 200 g @ 21000/kg
  assert.equal(costs.get("b"), 2100); // 100 ml ≈ 100 g
});

// ── the parseGrams delegation contract (menuEngineering.ts) ─────────────────
// menuEngineering calls gramsFromQuantityText(quantityText || rawText,
// ingredient). These pin the shapes that flow through that call.

test("gram-denominated quantities parse exactly as the old regex did", () => {
  // The recipeCosts golden fixtures are all this shape — old/new identical.
  assert.equal(gramsFromQuantityText("200 g", "tomato"), 200);
  assert.equal(gramsFromQuantityText("20 g olive oil", "olive oil"), 20); // rawText fallback shape
  assert.equal(gramsFromQuantityText("5 g asafoetida-not-in-inventory", "asafoetida"), 5);
});

test("the quantities the old regex read as zero now weigh what the kitchen says", () => {
  assert.equal(gramsFromQuantityText("2 tbsp", "olive oil"), 30); // liquid spoon: 15 ml
  assert.equal(gramsFromQuantityText("2 tbsp", "besan flour"), 16); // dry spoon: 8 g — name-aware
  assert.equal(gramsFromQuantityText("1 tsp", "honey"), 5);
  assert.equal(gramsFromQuantityText("100 ml", "milk"), 100);
  assert.equal(gramsFromQuantityText("2", "eggs"), 100); // pieces × egg weight
  assert.equal(gramsFromQuantityText("2 slices", "bread"), 56);
});

test("negligible and unparseable quantities still contribute nothing", () => {
  assert.equal(gramsFromQuantityText("to taste", "salt"), 0);
  assert.equal(gramsFromQuantityText("as required", "seasoning"), 0);
  assert.equal(gramsFromQuantityText("", "anything"), 0);
});
