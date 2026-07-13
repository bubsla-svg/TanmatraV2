import assert from "node:assert";
import {
  DISHES,
  defaultServeModeForCategory,
  findDishIntegrityViolations,
  findCatalogIntegrityViolations,
  getServeMode,
  type DishData,
} from "@workspace/menu-catalog";

// A known-good base dish to clone for synthetic self-tests.
const BASE: DishData = {
  id: 90001,
  slug: "test-base-dish",
  name: "Test Base Dish",
  description: "A clean vegetarian base dish.",
  longDescription: "Brown rice – 150 g · Mixed vegetables – 100 g · Olive oil – 1 tsp",
  image: "",
  price: 10000,
  kitchen: "continental",
  category: "bowls",
  isVeg: true,
  rdVerified: true,
  prepTime: "10 min",
  macros: { protein: 8, carbs: 40, fat: 6, fiber: 5, calories: 260 },
  ingredients: ["Brown rice – 150 g", "Mixed vegetables – 100 g", "Olive oil – 1 tsp"],
  allergens: [],
  glycaemicIndex: "medium",
  sugarPerServing: "4g",
  customizations: [],
  isAvailable: true,
};

function codes(dish: DishData): string[] {
  return findDishIntegrityViolations(dish).map((v) => v.code);
}

function selfTest() {
  console.log("[self-test] Verifying the detector fires on synthetic corrupt data...");

  // Clean base dish → no violations.
  assert.deepStrictEqual(codes(BASE), [], "clean base dish should have no violations");

  // The exact production defect: "Eggless" + Eggs allergen + no egg + Non-Veg.
  const brokenBrownie: DishData = {
    ...BASE,
    slug: "ragi-dates-eggless-brownie",
    name: "Ragi Dates Eggless Brownie",
    category: "snacks",
    isVeg: false,
    ingredients: ["Ragi flour – 80 g", "Dates puree – 50 g", "Cocoa powder – 15 g", "Milk – 60 ml"],
    allergens: ["Eggs", "Dairy", "Gluten"],
  };
  const brownieCodes = codes(brokenBrownie);
  assert.ok(brownieCodes.includes("eggless_name_vs_egg_allergen"), "must catch eggless name vs egg allergen");
  assert.ok(brownieCodes.includes("egg_allergen_without_ingredient"), "must catch phantom egg allergen");

  // Non-Veg flag with no supporting egg/meat/fish signal anywhere (no egg
  // allergen to lean on either) — a genuinely mislabelled vegetarian dish.
  const mislabelledNonVeg: DishData = {
    ...BASE,
    slug: "paneer-bowl-mislabelled",
    name: "Paneer Bowl",
    isVeg: false,
    ingredients: ["Brown rice – 150 g", "Paneer – 120 g"],
    allergens: ["Dairy"],
  };
  assert.ok(codes(mislabelledNonVeg).includes("nonveg_flag_without_signal"), "must catch Non-Veg flag with no non-veg signal");

  // Under-declaration: egg in the ingredients but no allergen → hazard.
  const underDeclared: DishData = {
    ...BASE,
    slug: "hidden-egg-toast",
    name: "Hidden Egg Toast",
    isVeg: false,
    ingredients: ["Whole grain bread – 2 slices", "Poached egg – 1"],
    allergens: ["Gluten"],
  };
  assert.ok(codes(underDeclared).includes("egg_ingredient_without_allergen"), "must catch undeclared egg allergen");

  // Generalised under-declaration: a tree-nut ingredient with no nut allergen.
  const hiddenCashew: DishData = {
    ...BASE,
    slug: "hidden-cashew-korma",
    name: "Hidden Cashew Korma",
    ingredients: ["Mixed vegetables – 150 g", "Cashew paste – 40 g"],
    allergens: [],
  };
  assert.ok(
    codes(hiddenCashew).includes("undeclared_allergen_ingredient"),
    "must catch a cashew ingredient with no tree-nut allergen",
  );

  // A generic "Nuts" declaration satisfies the tree-nut gate → cleared.
  const declaredCashew: DishData = { ...hiddenCashew, allergens: ["Nuts"] };
  assert.ok(
    !codes(declaredCashew).includes("undeclared_allergen_ingredient"),
    "a declared nut allergen must clear the under-declaration gate",
  );

  // False-positive guard: "coconut milk" is not dairy — only unambiguous dairy
  // tokens (paneer/ghee/cheese/…) count, so a bare "milk" must not trip it.
  const coconut: DishData = {
    ...BASE,
    slug: "coconut-veg-curry",
    name: "Coconut Veg Curry",
    ingredients: ["Coconut milk – 100 ml", "Mixed vegetables – 120 g"],
    allergens: [],
  };
  assert.deepStrictEqual(codes(coconut), [], "'coconut milk' must not false-positive as a dairy allergen");

  // False-positive guard: paneer present AND Dairy declared → no violation.
  const paneerDeclared: DishData = {
    ...BASE,
    slug: "palak-paneer-declared",
    name: "Palak Paneer",
    ingredients: ["Spinach – 150 g", "Paneer – 100 g"],
    allergens: ["Dairy"],
  };
  assert.ok(
    !codes(paneerDeclared).includes("undeclared_allergen_ingredient"),
    "a declared Dairy allergen must clear paneer under-declaration",
  );

  // Veg flag contradicted by a chicken ingredient.
  const fakeVeg: DishData = {
    ...BASE,
    slug: "fake-veg-bowl",
    name: "Fake Veg Bowl",
    isVeg: true,
    ingredients: ["Brown rice – 150 g", "Grilled chicken – 120 g"],
    allergens: [],
  };
  assert.ok(codes(fakeVeg).includes("veg_flag_vs_nonveg_signal"), "must catch Veg flag with chicken");

  // "eggplant"/"eggless" must NOT be mistaken for an egg ingredient.
  const eggplant: DishData = {
    ...BASE,
    slug: "roasted-eggplant-bowl",
    name: "Roasted Eggplant Bowl",
    ingredients: ["Eggplant – 120 g", "Olive oil – 1 tsp"],
    allergens: [],
  };
  assert.deepStrictEqual(codes(eggplant), [], "'eggplant' must not false-positive as egg");

  // A cold beverage forced to reheat must be flagged.
  const badColdMode: DishData = { ...BASE, slug: "bad-cold-smoothie", name: "Bad Cold Smoothie", category: "beverages", serveMode: "reheat" };
  assert.ok(codes(badColdMode).includes("cold_category_reheat_mode"), "must catch cold category forced to reheat");

  // Serve-mode derivation.
  assert.strictEqual(defaultServeModeForCategory("beverages"), "serve_chilled");
  assert.strictEqual(defaultServeModeForCategory("salads"), "serve_chilled");
  assert.strictEqual(defaultServeModeForCategory("soups"), "reheat");
  assert.strictEqual(defaultServeModeForCategory("mains"), "reheat");
  assert.strictEqual(defaultServeModeForCategory("snacks"), "ready_ambient");
  assert.strictEqual(getServeMode({ category: "beverages", serveMode: undefined }), "serve_chilled");
  assert.strictEqual(getServeMode({ category: "beverages", serveMode: "serve_chilled" }), "serve_chilled");

  console.log("  ✔ Detector self-test passed.\n");
}

function checkCatalog() {
  console.log(`[catalog] Checking all ${DISHES.length} published dishes for integrity violations...`);
  const violations = findCatalogIntegrityViolations(DISHES);
  if (violations.length > 0) {
    console.error(`\n❌ ${violations.length} dish-integrity violation(s) found:\n`);
    for (const v of violations) {
      console.error(`  • [${v.slug}] ${v.code}: ${v.message}`);
    }
    console.error(
      "\nThese are contradictory allergen / diet / serving signals on the clinical surface.\n" +
        "Reconcile the dish record in lib/menu-catalog/src/index.ts (make the structured\n" +
        "allergen array the source of truth and derive name/veg-flag/serving copy from it).",
    );
    process.exit(1);
  }
  console.log("  ✔ All dishes pass the integrity gate.\n");
}

function run() {
  console.log("=== Dish-Data Integrity Gate ===\n");
  selfTest();
  checkCatalog();
  console.log("=== Dish-Data Integrity Gate PASSED ===");
}

run();
