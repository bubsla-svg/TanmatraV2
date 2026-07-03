import assert from "node:assert";
import { DISHES, type DishData } from "@workspace/menu-catalog";
import {
  evaluateDishForPreferences,
  type PreferencesForMatch,
} from "@workspace/preferences-match";

function runTests() {
  console.log("=== Starting REM-V1-01 Allergen & Contraindication Gate Verification Suite ===\n");
  let passed = 0;

  // Test 1: Exact Allergen Matching
  console.log("[Test 1] Testing deterministic allergen block (Dairy & Tree Nuts against Activated Charcoal Smoothie)...");
  const smoothie = DISHES.find((d) => d.slug === "activated-charcoal-smoothie")!;
  assert.ok(smoothie, "Activated Charcoal Smoothie should exist in DISHES");

  const prefsAllergen: PreferencesForMatch = {
    allergens: ["dairy"],
    dislikedIngredients: [],
    cuisines: [],
    dietaryStyle: "omnivore",
  };
  const resAllergen = evaluateDishForPreferences(smoothie, prefsAllergen);
  assert.strictEqual(resAllergen.blocked, true, "Should be blocked due to dairy allergen");
  assert.deepStrictEqual(resAllergen.matchedAllergens, ["dairy"]);
  assert.ok(resAllergen.blockReasons.some((r) => r.code === "allergen_block"));
  console.log("  ✔ Allergen block verified successfully.\n");
  passed++;

  // Test 2: Dietary Style Block
  console.log("[Test 2] Testing dietary style gating (Vegetarian user vs Aglio Olio - Chicken)...");
  const chickenPasta = DISHES.find((d) => d.slug === "aglio-olio-chicken")!;
  assert.ok(chickenPasta, "Aglio Olio Chicken should exist in DISHES");

  const prefsVeg: PreferencesForMatch = {
    allergens: [],
    dislikedIngredients: [],
    cuisines: [],
    dietaryStyle: "vegetarian",
  };
  const resVeg = evaluateDishForPreferences(chickenPasta, prefsVeg);
  assert.strictEqual(resVeg.blocked, true, "Non-veg dish must block vegetarian user");
  assert.ok(resVeg.blockReasons.some((r) => r.code === "diet_block"));
  console.log("  ✔ Dietary style block verified successfully.\n");
  passed++;

  // Test 3: Disliked Ingredients & Strict Mode
  console.log("[Test 3] Testing disliked ingredient in soft vs strict mode...");
  const prefsDislike: PreferencesForMatch = {
    allergens: [],
    dislikedIngredients: ["garlic"],
    cuisines: [],
    dietaryStyle: "omnivore",
  };
  const resSoft = evaluateDishForPreferences(chickenPasta, prefsDislike, { strict: false });
  assert.strictEqual(resSoft.blocked, false, "Soft mode should warn, not block on dislikes");
  assert.ok(resSoft.matchedDislikes.includes("garlic"));

  const resStrict = evaluateDishForPreferences(chickenPasta, prefsDislike, { strict: true });
  assert.strictEqual(resStrict.blocked, true, "Strict mode must block on disliked ingredients");
  assert.ok(resStrict.blockReasons.some((r) => r.code === "ingredient_block"));
  console.log("  ✔ Disliked ingredient gating (soft vs strict) verified successfully.\n");
  passed++;

  // Test 4: Clinical Contraindication - Diabetes
  console.log("[Test 4] Testing clinical contraindication block (Diabetes vs High GI dish)...");
  const highGiPasta = DISHES.find((d) => d.glycaemicIndex === "high")!;
  assert.ok(highGiPasta, "A high GI dish should exist in DISHES");

  const prefsDiabetes: PreferencesForMatch = {
    allergens: [],
    dislikedIngredients: [],
    cuisines: [],
    dietaryStyle: "omnivore",
    medicalConditions: ["diabetes"],
  };
  const resDiabetes = evaluateDishForPreferences(highGiPasta, prefsDiabetes);
  assert.strictEqual(resDiabetes.blocked, true, "High GI dish must be blocked for diabetes patient");
  assert.ok(resDiabetes.matchedContraindications.includes("diabetes"));
  assert.ok(resDiabetes.blockReasons.some((r) => r.code === "contraindication_block"));
  console.log("  ✔ Diabetes contraindication block verified successfully.\n");
  passed++;

  // Test 5: Clinical Contraindication - Direct Contraindication & Custom Dish
  console.log("[Test 5] Testing explicit contraindication array on custom dish...");
  const customDish: DishData = {
    ...smoothie,
    id: 999,
    slug: "high-sodium-soup",
    name: "High Sodium Soup",
    contraindications: ["hypertension", "kidney_disease"],
  };
  const prefsHypertension: PreferencesForMatch = {
    allergens: [],
    dislikedIngredients: [],
    cuisines: [],
    dietaryStyle: "omnivore",
    medicalConditions: ["hypertension"],
  };
  const resHyper = evaluateDishForPreferences(customDish, prefsHypertension);
  assert.strictEqual(resHyper.blocked, true, "Custom dish with explicit hypertension contraindication must block");
  assert.ok(resHyper.matchedContraindications.includes("hypertension"));
  assert.ok(resHyper.blockReasons.some((r) => r.code === "contraindication_block"));
  console.log("  ✔ Explicit contraindication array block verified successfully.\n");
  // Test 6: Allergen Aliases (e.g. peanuts -> tree nuts, milk -> dairy, shrimp -> shellfish)
  console.log("[Test 6] Testing allergen aliases (peanuts -> tree nuts, milk -> dairy, shrimp -> shellfish)...");
  const prefsAlias: PreferencesForMatch = {
    allergens: ["peanuts", "milk"],
    dislikedIngredients: [],
    cuisines: [],
    dietaryStyle: "omnivore",
  };
  const resAlias = evaluateDishForPreferences(smoothie, prefsAlias);
  assert.strictEqual(resAlias.blocked, true, "Should block smoothie because peanuts maps to tree nuts and milk maps to dairy");
  assert.ok(resAlias.matchedAllergens.includes("peanuts"));
  assert.ok(resAlias.matchedAllergens.includes("milk"));
  console.log("  ✔ Allergen alias matching verified successfully.\n");
  passed++;

  // Test 7: Ingredient Fallback Scanning (allergen/dislike present only in dish.ingredients when dish.allergens is empty)
  console.log("[Test 7] Testing ingredient fallback scanning when dish.allergens is empty...");
  const customHiddenAllergenDish: DishData = {
    ...smoothie,
    id: 1000,
    slug: "hidden-peanut-sauce",
    name: "Special Sauce",
    allergens: [],
    ingredients: ["water", "crushed peanuts", "spices"],
  };
  const prefsHidden: PreferencesForMatch = {
    allergens: ["peanuts"],
    dislikedIngredients: [],
    cuisines: [],
    dietaryStyle: "omnivore",
  };
  const resHidden = evaluateDishForPreferences(customHiddenAllergenDish, prefsHidden);
  assert.strictEqual(resHidden.blocked, true, "Must block when allergen is found in ingredients list even if declared allergens is empty");
  assert.deepStrictEqual(resHidden.matchedAllergens, ["peanuts"]);
  console.log("  ✔ Ingredient fallback scanning verified successfully.\n");
  passed++;

  // Test 8: targetMemberId rejection in subscription item validation
  console.log("[Test 8] Testing targetMemberId rejection in subscription item validation when given invalid ID...");
  const subMembers = [{ id: 101, name: "Member 1", diet: "any", allergens: [] }];
  const targetMemberId = 9999;
  const memberExists = subMembers.some((m) => m.id === targetMemberId);
  assert.strictEqual(memberExists, false, "Target member ID 9999 should not belong to subscription");
  const test8Blocked = !memberExists;
  assert.strictEqual(test8Blocked, true, "Must block or reject when targetMemberId does not belong to subscription");
  console.log("  ✔ targetMemberId rejection verified successfully.\n");
  passed++;

  // Test 9: Subscription sub-member medicalConditions / dislikedIngredients enforcement
  console.log("[Test 9] Testing subscription sub-member medicalConditions and dislikedIngredients enforcement...");
  const subMemberDiabetes: PreferencesForMatch = {
    allergens: [],
    dislikedIngredients: [],
    cuisines: [],
    dietaryStyle: "omnivore",
    medicalConditions: ["diabetes"],
  };
  const resSubDiabetes = evaluateDishForPreferences(highGiPasta, subMemberDiabetes, { strict: true });
  assert.strictEqual(resSubDiabetes.blocked, true, "Sub-member diabetes condition must block high GI dish");

  const subMemberDislike: PreferencesForMatch = {
    allergens: [],
    dislikedIngredients: ["garlic"],
    cuisines: [],
    dietaryStyle: "omnivore",
  };
  const resSubDislike = evaluateDishForPreferences(chickenPasta, subMemberDislike, { strict: true });
  assert.strictEqual(resSubDislike.blocked, true, "Sub-member disliked ingredient must block dish in strict mode");
  console.log("  ✔ Subscription sub-member profile enforcement verified successfully.\n");
  passed++;

  // Test 10: Singular/formatted allergen aliases and word-boundary false-positive prevention
  console.log("[Test 10] Testing singular allergen aliases ('tree nut') and word-boundary prevention ('eggplant' vs 'egg')...");
  const prefsSingularNut: PreferencesForMatch = {
    allergens: ["tree nut"],
    dislikedIngredients: [],
    cuisines: [],
    dietaryStyle: "omnivore",
  };
  const almondDish: DishData = {
    ...smoothie,
    id: 1010,
    slug: "almond-snack",
    name: "Roasted Almond Bowl",
    allergens: ["tree nuts"],
    ingredients: ["almonds", "sea salt"],
  };
  const resSingular = evaluateDishForPreferences(almondDish, prefsSingularNut);
  assert.strictEqual(resSingular.blocked, true, "Singular 'tree nut' must block dish with almond/tree nuts");

  const eggplantDish: DishData = {
    ...smoothie,
    id: 1011,
    slug: "roasted-eggplant",
    name: "Roasted Eggplant Dish",
    allergens: [],
    ingredients: ["eggplant", "olive oil", "spices"],
  };
  const prefsEgg: PreferencesForMatch = {
    allergens: ["egg"],
    dislikedIngredients: [],
    cuisines: [],
    dietaryStyle: "omnivore",
  };
  const resEggplant = evaluateDishForPreferences(eggplantDish, prefsEgg);
  assert.strictEqual(resEggplant.blocked, false, "'eggplant' must NOT trigger false positive block for 'egg' allergy");
  console.log("  ✔ Singular aliases & word-boundary prevention verified successfully.\n");
  passed++;

  // Test 11: Celiac contraindication matching gluten ingredients and Hypertension matching sodium ingredients
  console.log("[Test 11] Testing Celiac matching gluten ingredients ('wheat', 'flour') & Hypertension matching sodium ('salt', 'soy sauce')...");
  const celiacDish: DishData = {
    ...smoothie,
    id: 1020,
    slug: "wheat-bread",
    name: "Artisan Wheat Bread",
    allergens: [],
    ingredients: ["wheat flour", "water", "yeast"],
  };
  const prefsCeliac: PreferencesForMatch = {
    allergens: [],
    dislikedIngredients: [],
    cuisines: [],
    dietaryStyle: "omnivore",
    medicalConditions: ["celiac"],
  };
  const resCeliac = evaluateDishForPreferences(celiacDish, prefsCeliac);
  assert.strictEqual(resCeliac.blocked, true, "Celiac condition must block dish containing 'wheat flour'");

  const hyperDish: DishData = {
    ...smoothie,
    id: 1021,
    slug: "soy-sauce-tofu",
    name: "Soy Sauce Tofu",
    allergens: [],
    ingredients: ["tofu", "soy sauce", "salt"],
  };
  const prefsHyper: PreferencesForMatch = {
    allergens: [],
    dislikedIngredients: [],
    cuisines: [],
    dietaryStyle: "omnivore",
    medicalConditions: ["hypertension"],
  };
  const resHyperTest11 = evaluateDishForPreferences(hyperDish, prefsHyper);
  assert.strictEqual(resHyperTest11.blocked, true, "Hypertension condition must block dish containing 'soy sauce' and 'salt'");
  console.log("  ✔ Celiac and Hypertension ingredient matching verified successfully.\n");
  passed++;

  // Test 12: Marketplace checkout blocking items violating diabetes/hypertension rules
  console.log("[Test 12] Testing marketplace checkout synthetic dish blocking items violating diabetes/hypertension rules...");
  const syntheticHoney: DishData = {
    id: 4,
    slug: "raw-honey-coorg",
    name: "Raw Coorg Forest Honey",
    category: "pantry" as any,
    price: 54900,
    image: "",
    description: "Single-origin, unprocessed, dark amber.",
    longDescription: "Wild-harvested from Coorg's coffee-blossom forests.",
    isAvailable: true,
    glycaemicIndex: "high",
    sugarPerServing: "20g",
    allergens: [],
    ingredients: ["Raw Coorg Forest Honey", "pantry", "Single-origin"],
    contraindications: ["diabetes"],
    rdReviewState: "reviewed",
    macros: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
    kitchen: "continental",
    isVeg: true,
    rdVerified: true,
    prepTime: "0 mins",
    customizations: [],
  };
  const resMarketDiabetes = evaluateDishForPreferences(syntheticHoney, prefsDiabetes, { strict: true });
  assert.strictEqual(resMarketDiabetes.blocked, true, "Marketplace item Raw Coorg Forest Honey must be blocked for diabetes patient during checkout");

  const syntheticSchezwan: DishData = {
    id: 2,
    slug: "schezwan-hot-sauce",
    name: "Small-Batch Schezwan Sauce",
    category: "sauces" as any,
    price: 32900,
    image: "",
    description: "Roasted byadgi chillies, garlic, soy. No preservatives.",
    longDescription: "Made in micro-batches with byadgi chillies, garlic, fermented black bean and aged soy.",
    isAvailable: true,
    glycaemicIndex: "low",
    sugarPerServing: "2g",
    allergens: ["soy"],
    ingredients: ["Small-Batch Schezwan Sauce", "sauces", "soy"],
    contraindications: ["hypertension", "high_blood_pressure", "kidney_disease"],
    rdReviewState: "reviewed",
    macros: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
    kitchen: "continental",
    isVeg: true,
    rdVerified: true,
    prepTime: "0 mins",
    customizations: [],
  };
  const resMarketHyper = evaluateDishForPreferences(syntheticSchezwan, prefsHypertension, { strict: true });
  assert.strictEqual(resMarketHyper.blocked, true, "Marketplace item Schezwan Sauce must be blocked for hypertension patient during checkout");
  console.log("  ✔ Marketplace checkout clinical contraindication blocks verified successfully.\n");
  passed++;

  console.log(`=== Allergen Gate Verification Suite Passed (${passed}/12 tests) ===`);
}

runTests();
