import assert from "node:assert/strict";
import { test } from "node:test";
import { scanPantryVisionLogic } from "./pantryVisionScanner";

test("scanPantryVisionLogic returns detected ingredients, recipes, and add-on products", async () => {
  const result = await scanPantryVisionLogic("base64_image_data");

  assert.ok(result.detectedIngredients.length > 0);
  assert.ok(result.suggestedRecipes.length > 0);
  assert.ok(result.suggestedTanmatraAddOns.length > 0);

  const firstIngredient = result.detectedIngredients[0]!;
  assert.ok(firstIngredient.name);
  assert.ok(firstIngredient.confidenceScore > 0);
});
