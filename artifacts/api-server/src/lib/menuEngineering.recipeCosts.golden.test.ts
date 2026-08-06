/**
 * OA-MED-1.16 — golden test for loadDynamicRecipeCosts' complexity rewrite.
 *
 * The function used to re-filter the whole ingredient list per recipe
 * (O(recipes × ingredients)) and re-scan the whole inventory per ingredient
 * (O(ingredients × inventory)). Both are now pre-grouped/memoised. The
 * ingredient→inventory match is a two-way fuzzy substring test where
 * `Array.find` semantics (first match wins, in inventory insertion order)
 * are load-bearing: a different winner means a different food cost, which
 * feeds the margin axis of the star/plowhorse/puzzle/dog matrix and can
 * move a real price. So this compares the new implementation against a
 * frozen copy of the exact old algorithm on identical seeded data.
 *
 * Fixtures deliberately include the cases where a naive "index by name"
 * rewrite would diverge: an ingredient matching MULTIPLE inventory rows
 * (first must win), bidirectional substring matches in both directions,
 * a repeated ingredient name across recipes (the memoisation path), an
 * unmatched ingredient, and a recipe falling back to foodCostPaise.
 *
 * Needs Postgres (DATABASE_URL). Run with:
 *   DATABASE_URL=... node --test --import tsx \
 *     ./src/lib/menuEngineering.recipeCosts.golden.test.ts
 */

import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";

import { inArray } from "drizzle-orm";
import {
  db,
  inventoryItemsTable,
  recipeIngredientsTable,
  recipesTable,
} from "@workspace/db";

import { loadDynamicRecipeCosts } from "./menuEngineering";

const TAG = randomUUID().slice(0, 8);
const createdRecipeIds: number[] = [];
const createdInventoryIds: number[] = [];

// Frozen copy of the pre-OA-MED-1.16 algorithm. Deliberately duplicated
// rather than imported — the point is an independent re-derivation.
function parseGramsOld(text: string): number {
  const match = text.match(/(\d+)\s*g/i);
  return match ? parseInt(match[1]!, 10) : 0;
}
function oldRecipeCosts(
  recipes: Array<{ id: number; slug: string; foodCostPaise: number | null }>,
  ingredients: Array<{
    recipeId: number;
    ingredient: string;
    quantityText: string | null;
    rawText: string;
  }>,
  inventory: Array<{
    product: string;
    perKgUnitPaise: number | null;
    buyingPricePaise: number | null;
  }>,
): Map<string, number | null> {
  const out = new Map<string, number | null>();
  for (const recipe of recipes) {
    const recipeIngs = ingredients.filter((ing) => ing.recipeId === recipe.id);
    let totalCostPaise = 0;
    for (const ing of recipeIngs) {
      const ingNameLower = ing.ingredient.toLowerCase();
      const match = inventory.find(
        (inv) =>
          inv.product.toLowerCase().includes(ingNameLower) ||
          ingNameLower.includes(inv.product.toLowerCase()),
      );
      if (match) {
        const grams = parseGramsOld(ing.quantityText || ing.rawText);
        const perKgCost = match.perKgUnitPaise ?? match.buyingPricePaise ?? 0;
        totalCostPaise += Math.round((grams / 1000) * perKgCost);
      }
    }
    const computed =
      totalCostPaise > 0 ? totalCostPaise : (recipe.foodCostPaise ?? 0);
    out.set(recipe.slug, computed > 0 ? computed : null);
  }
  return out;
}

after(async () => {
  if (createdRecipeIds.length > 0) {
    await db
      .delete(recipeIngredientsTable)
      .where(inArray(recipeIngredientsTable.recipeId, createdRecipeIds));
    await db.delete(recipesTable).where(inArray(recipesTable.id, createdRecipeIds));
  }
  if (createdInventoryIds.length > 0) {
    await db
      .delete(inventoryItemsTable)
      .where(inArray(inventoryItemsTable.id, createdInventoryIds));
  }
});

test("the memoised/pre-grouped rewrite produces identical costs to the old algorithm", async () => {
  // Inventory. Order matters: `Array.find` takes the FIRST match, so the two
  // "pomodoro"-ish rows are a deliberate trap for any rewrite that reorders or
  // hash-indexes the lookup.
  const inv = await db
    .insert(inventoryItemsTable)
    .values([
      // Both of these match ingredient "pomodoro" (product contains ingredient).
      // The first must win — priced differently so a wrong winner is visible.
      { itemNo: 9001, product: `Pomodoro Roma ${TAG}`, perKgUnitPaise: 8000 },
      { itemNo: 9002, product: `Pomodoro Cherry ${TAG}`, perKgUnitPaise: 25000 },
      // Reverse-direction match: ingredient "extra virgin olive oil" CONTAINS
      // this shorter product name.
      { itemNo: 9003, product: "olive oil", perKgUnitPaise: 60000 },
      // Falls back to buyingPricePaise when perKgUnitPaise is null.
      { itemNo: 9004, product: `Paneer ${TAG}`, perKgUnitPaise: null, buyingPricePaise: 40000 },
    ])
    .returning({ id: inventoryItemsTable.id });
  createdInventoryIds.push(...inv.map((r) => r.id));

  const recipes = await db
    .insert(recipesTable)
    .values([
      { recipeNo: 9001, name: `Golden Curry ${TAG}`, slug: `golden-curry-${TAG}` },
      { recipeNo: 9002, name: `Paneer Bowl ${TAG}`, slug: `paneer-bowl-${TAG}` },
      // No matching ingredients at all -> falls back to foodCostPaise.
      {
        recipeNo: 9003,
        name: `Fallback Dish ${TAG}`,
        slug: `fallback-dish-${TAG}`,
        foodCostPaise: 12345,
      },
      // No matches AND no foodCostPaise -> must record null (unknown), never 0.
      { recipeNo: 9004, name: `Unknown Cost ${TAG}`, slug: `unknown-cost-${TAG}` },
    ])
    .returning({ id: recipesTable.id, slug: recipesTable.slug });
  createdRecipeIds.push(...recipes.map((r) => r.id));

  const [curry, paneer, fallback, unknown] = recipes;

  await db.insert(recipeIngredientsTable).values([
    // "pomodoro" appears in BOTH recipes — exercises the memoisation path and
    // pins that both get the same (first-match) inventory row.
    { recipeId: curry!.id, position: 1, rawText: "200 g pomodoro", ingredient: "pomodoro", quantityText: "200 g" },
    { recipeId: curry!.id, position: 2, rawText: "30 g extra virgin olive oil", ingredient: "extra virgin olive oil", quantityText: "30 g" },
    { recipeId: curry!.id, position: 3, rawText: "5 g asafoetida-not-in-inventory", ingredient: `nomatch-${TAG}`, quantityText: "5 g" },
    { recipeId: paneer!.id, position: 1, rawText: "150 g pomodoro", ingredient: "pomodoro", quantityText: "150 g" },
    { recipeId: paneer!.id, position: 2, rawText: "100 g paneer", ingredient: "paneer", quantityText: "100 g" },
    // quantityText null -> parseGrams must fall back to rawText.
    { recipeId: paneer!.id, position: 3, rawText: "20 g olive oil", ingredient: "olive oil", quantityText: null },
    { recipeId: unknown!.id, position: 1, rawText: "10 g mystery", ingredient: `mystery-${TAG}`, quantityText: "10 g" },
  ]);

  // New implementation, against the real DB.
  const actual = await loadDynamicRecipeCosts();

  // Old implementation, against the same rows read back independently.
  const allRecipes = await db
    .select({ id: recipesTable.id, slug: recipesTable.slug, foodCostPaise: recipesTable.foodCostPaise })
    .from(recipesTable);
  const allIngredients = await db
    .select({
      recipeId: recipeIngredientsTable.recipeId,
      ingredient: recipeIngredientsTable.ingredient,
      quantityText: recipeIngredientsTable.quantityText,
      rawText: recipeIngredientsTable.rawText,
    })
    .from(recipeIngredientsTable);
  const allInventory = await db
    .select({
      product: inventoryItemsTable.product,
      perKgUnitPaise: inventoryItemsTable.perKgUnitPaise,
      buyingPricePaise: inventoryItemsTable.buyingPricePaise,
    })
    .from(inventoryItemsTable);
  const expected = oldRecipeCosts(allRecipes, allIngredients, allInventory);

  // Compare EVERY recipe in the table, not just the seeded ones — a
  // divergence on a pre-existing row is just as much a regression.
  assert.equal(actual.size, expected.size, "recipe count diverged");
  for (const [slug, expectedCost] of expected) {
    assert.equal(
      actual.get(slug),
      expectedCost,
      `cost diverged for recipe "${slug}"`,
    );
  }

  // Hand-computed spot checks, so old-vs-new agreement can't hide a bug
  // shared by both implementations. Costs are paise/kg, so 200 g of a
  // 8000 paise/kg (₹80/kg) row is round(0.2 × 8000) = 1600 paise.
  //
  // Golden Curry: pomodoro 200 g @ 8000 = 1600, taking Roma (the FIRST
  // matching row) not Cherry @ 25000 — Cherry would give 5000, so the
  // total below is what distinguishes them; olive oil 30 g @ 60000 =
  // 1800; the unmatched ingredient contributes 0.
  assert.equal(
    actual.get(`golden-curry-${TAG}`),
    1600 + 1800,
    "pomodoro must resolve to the FIRST matching inventory row (Roma @ 8000), not Cherry @ 25000",
  );
  // Paneer Bowl: pomodoro 150 g @ 8000 = 1200 (same memoised first match);
  // paneer 100 g @ buyingPricePaise 40000 = 4000 (perKgUnitPaise is null,
  // so the fallback is exercised); olive oil 20 g @ 60000 = 1200, with
  // grams parsed from rawText because quantityText is null.
  assert.equal(actual.get(`paneer-bowl-${TAG}`), 1200 + 4000 + 1200);
  // No ingredient matched -> recipes.food_cost_paise fallback.
  assert.equal(actual.get(`fallback-dish-${TAG}`), 12345);
  // Nothing matched and no stored cost -> null (UNKNOWN), never 0.
  assert.equal(actual.get(`unknown-cost-${TAG}`), null);
});
