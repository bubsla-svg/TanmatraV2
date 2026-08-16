/**
 * BOM plan engine — pure, DB-free. Runs in bom-backfill.yml before anything
 * touches production, in the exact pattern menuCatalogV2Plan.test.ts set.
 * Run: node --test --import tsx ./src/lib/bomPlan.test.ts   (from scripts/)
 */
import test from "node:test";
import assert from "node:assert/strict";
import { gramsFromQuantityText } from "@workspace/menu-catalog";
import {
  buildBomPlan,
  loadMapping,
  normNameLikeSeed,
  parseSheetIngredient,
  resolveCatalogSlug,
  serializeMapping,
  type MappingRow,
} from "./bomPlan";

// ── gramsFromQuantityText — the conversion the old /(\d+)\s*g/ regex lacked ──

test("gramsFromQuantityText: gram inputs behave exactly like the old regex", () => {
  // These are the golden-test shapes — the recipeCosts golden fixtures are
  // deliberately all gram-denominated, so on them old and new must agree.
  assert.equal(gramsFromQuantityText("200 g", "tomato"), 200);
  assert.equal(gramsFromQuantityText("20 g olive oil", "olive oil"), 20);
  assert.equal(gramsFromQuantityText("150 g (sliced)", "grilled chicken"), 150);
});

test("gramsFromQuantityText: the 371 rows the old regex read as zero", () => {
  // tbsp/tsp resolve through the kitchen's own dry/liquid tables.
  assert.equal(gramsFromQuantityText("2 tbsp", "olive oil"), 30); // liquid 15 ml
  assert.equal(gramsFromQuantityText("1 tbsp (chopped)", "parsley"), 8); // dry 8 g
  assert.equal(gramsFromQuantityText("½ tsp", "chili flakes"), 2); // dry 3 × .5, rounded
  assert.equal(gramsFromQuantityText("200 ml", "almond milk"), 200);
  assert.equal(gramsFromQuantityText("2", "eggs"), 100); // 2 pieces × 50 g
  // "6–8 cloves": parseQuantity's range-averaging only fires on a BARE range
  // ("4–5" for ice); with a trailing unit the anchored regex misses and the
  // leading number wins — 6 cloves, the conservative low end. Pinned because
  // this is the same behaviour the shipped estimate generator had when it
  // produced the 104 ESTIMATED_MACROS entries; changing it would ripple them.
  assert.equal(gramsFromQuantityText("6–8 cloves (sliced)", "garlic"), 18); // 6 × 3 g
});

test("gramsFromQuantityText: negligible and unparseable stay zero", () => {
  assert.equal(gramsFromQuantityText("to taste", "salt & pepper"), 0);
  assert.equal(gramsFromQuantityText("a pinch of", "saffron"), 0);
  assert.equal(gramsFromQuantityText(null, "anything"), 0);
  assert.equal(gramsFromQuantityText("", "anything"), 0);
});

test("gramsFromQuantityText: whole 'Name – Qty' lines split on SPACED dash only", () => {
  assert.equal(gramsFromQuantityText("Olive oil – 2 tbsp", "olive oil"), 30);
  // A mid-word hyphen is part of the name, never a separator — the old
  // golden fixture "5 g asafoetida-not-in-inventory" must still read 5 g.
  assert.equal(gramsFromQuantityText("5 g asafoetida-not-in-inventory", "asafoetida"), 5);
});

// ── slug fence ───────────────────────────────────────────────────────────────

test("normNameLikeSeed matches seed-ops-data.ts's normName exactly", () => {
  // Pinned cases exercising every rule in the seed's normalizer. If someone
  // edits one copy without the other, the BOM and the recipes seed would
  // join sheet names to different slugs — this test is the tripwire.
  assert.equal(normNameLikeSeed("Aglio Olio (o) Chicken"), "aglio olio chicken");
  assert.equal(normNameLikeSeed("Salt & Pepper Fries [new]"), "salt and pepper fries");
  assert.equal(normNameLikeSeed("  Broccoli—Almond Soup!  "), "broccoli almond soup");
});

// ── mapping CSV ──────────────────────────────────────────────────────────────

const INV = new Map<number, string>([
  [1, "CHICKEN BREAST BONELESS"],
  [2, "EGG 2 UNITS"],
  [96, "TILL"],
]);

function csvOf(rows: MappingRow[]): string {
  return serializeMapping(rows);
}

const ACCEPTED_CHICKEN: MappingRow = {
  key: "grilled chicken",
  verdict: "map",
  itemNo: 1,
  itemProduct: "CHICKEN BREAST BONELESS",
  status: "accepted",
  rationale: "menu shorthand",
};

test("loadMapping: round-trips serializeMapping output", () => {
  const { rows, errors } = loadMapping(csvOf([ACCEPTED_CHICKEN]), INV);
  assert.deepEqual(errors, []);
  assert.deepEqual(rows.get("grilled chicken"), ACCEPTED_CHICKEN);
});

test("loadMapping: product drift is an ERROR, not a silent retarget", () => {
  // The reviewer accepted item 1 as CHICKEN BREAST BONELESS. If the sheet's
  // row 1 becomes something else, the mapping must fail loudly — the review
  // no longer covers what the id points at.
  const driftedInv = new Map(INV);
  driftedInv.set(1, "PORK BACON");
  const { rows, errors } = loadMapping(csvOf([ACCEPTED_CHICKEN]), driftedInv);
  assert.equal(rows.size, 0);
  assert.equal(errors.length, 1);
  assert.match(errors[0]!, /reviewed against/);
});

test("loadMapping: unknown item_no, verdict and status are errors", () => {
  const bad = [
    'ghost,map,999,GHOST,accepted,r',
    'oddverdict,teleport,,,accepted,r',
    'oddstatus,no-cost,,,maybe,r',
  ].join("\n");
  const { rows, errors } = loadMapping(
    `ingredient_key,verdict,item_no,item_product,status,rationale\n${bad}\n`,
    INV,
  );
  assert.equal(rows.size, 0);
  assert.equal(errors.length, 3);
});

// ── ingredient parsing ───────────────────────────────────────────────────────

test("parseSheetIngredient: compound 'a / b' takes the first and RECORDS the drop", () => {
  const p = parseSheetIngredient("Almond milk / low-fat milk - 200 ml");
  assert.equal(p.key, "almond milk");
  assert.equal(p.alternative, "low-fat milk");
  assert.equal(p.grams, 200);
});

test("parseSheetIngredient: plain line has no alternative", () => {
  const p = parseSheetIngredient("Grilled chicken breast – 150 g");
  assert.equal(p.key, "grilled chicken breast");
  assert.equal(p.alternative, null);
  assert.equal(p.grams, 150);
});

// ── the plan ─────────────────────────────────────────────────────────────────

const MAPPING = new Map<string, MappingRow>([
  ["grilled chicken", ACCEPTED_CHICKEN],
  [
    "eggs",
    { key: "eggs", verdict: "map", itemNo: 2, itemProduct: "EGG 2 UNITS", status: "accepted", rationale: "" },
  ],
  [
    "egg whites",
    { key: "egg whites", verdict: "map", itemNo: 2, itemProduct: "EGG 2 UNITS", status: "accepted", rationale: "" },
  ],
  [
    "salt & pepper",
    { key: "salt & pepper", verdict: "no-cost", itemNo: null, itemProduct: "", status: "accepted", rationale: "" },
  ],
  [
    "chia seeds",
    { key: "chia seeds", verdict: "kitchen", itemNo: null, itemProduct: "", status: "accepted", rationale: "" },
  ],
  [
    "parsley",
    { key: "parsley", verdict: "map", itemNo: 96, itemProduct: "TILL", status: "proposed", rationale: "wrong on purpose" },
  ],
]);

// A catalog name that certainly exists: take one from DISHES via the fence
// itself — "Cheese Omelette" is on both the sheet and the catalog. To keep the
// test hermetic we instead assert on statuses that do not depend on the real
// catalog: blocked-no-slug uses a name that cannot exist.
test("buildBomPlan: a dish whose name is not in the catalog is BLOCKED, never slugified", () => {
  const plan = buildBomPlan({
    dishes: [{ name: "Definitely Not A Real Dish 9000", ingredients: ["Eggs - 2"] }],
    inventoryByNo: INV,
    mapping: MAPPING,
  });
  assert.equal(plan.dishes[0]!.status, "blocked-no-slug");
  assert.equal(plan.dishes[0]!.slug, null);
  assert.equal(plan.ready.length, 0);
});

test("buildBomPlan: Cheese Omelette derives real rows, sums duplicate items, keeps no-cost aside", () => {
  const plan = buildBomPlan({
    dishes: [
      {
        name: "Cheese Omelette",
        servingSize: "1 plate",
        ingredients: [
          "Eggs - 2", // 100 g via egg piece weight
          "Egg whites - 1", // 50 g — SAME inventory item (2): must sum, not duplicate
          "Grilled chicken – 150 g",
          "Salt & pepper - to taste", // no-cost verdict
        ],
      },
    ],
    inventoryByNo: INV,
    mapping: MAPPING,
  });
  const dish = plan.dishes[0]!;
  assert.equal(dish.status, "ready", JSON.stringify(dish.unresolved));
  assert.equal(dish.slug, "cheese-omelette");
  assert.equal(dish.servingSize, "1 plate");
  assert.deepEqual(
    dish.rows.map((r) => ({ itemNo: r.itemNo, grams: r.grams })),
    [
      { itemNo: 1, grams: 150 },
      { itemNo: 2, grams: 150 }, // 100 + 50 summed under the unique (slug,item) key
    ],
  );
  assert.deepEqual(dish.noCost, ["Salt & pepper - to taste"]);
});

test("buildBomPlan: an unaccepted or kitchen or missing mapping leaves the dish INCOMPLETE with zero rows", () => {
  const plan = buildBomPlan({
    dishes: [
      {
        name: "Cheese Omelette",
        ingredients: [
          "Eggs - 2",
          "Parsley – 1 tbsp", // mapping exists but still `proposed`
          "Chia seeds – 1 tsp", // verdict kitchen
          "Dragon fruit – 50 g", // no mapping row at all
        ],
      },
    ],
    inventoryByNo: INV,
    mapping: MAPPING,
  });
  const dish = plan.dishes[0]!;
  assert.equal(dish.status, "incomplete");
  // Partial BOMs are the understatement defect — an incomplete dish must
  // contribute NOTHING to the apply set, not its resolvable subset.
  assert.equal(plan.ready.length, 0);
  assert.equal(dish.unresolved.length, 3);
  const reasons = dish.unresolved.map((u) => u.reason).sort();
  assert.match(reasons[0]!, /mapping still proposed/);
  assert.match(reasons[1]!, /no mapping row/);
  assert.match(reasons[2]!, /needs the kitchen/);
});

test("buildBomPlan: a mapped line that parses to zero grams blocks readiness", () => {
  const plan = buildBomPlan({
    dishes: [
      {
        name: "Cheese Omelette",
        ingredients: ["Grilled chicken – as required"], // mapped item, no mass
      },
    ],
    inventoryByNo: INV,
    mapping: MAPPING,
  });
  const dish = plan.dishes[0]!;
  assert.equal(dish.status, "incomplete");
  assert.deepEqual(dish.zeroGram, ["Grilled chicken – as required"]);
});

test("buildBomPlan: compound assumptions are carried on the dish for review", () => {
  const plan = buildBomPlan({
    dishes: [
      { name: "Cheese Omelette", ingredients: ["Eggs / egg whites - 2"] },
    ],
    inventoryByNo: INV,
    mapping: MAPPING,
  });
  const dish = plan.dishes[0]!;
  assert.equal(dish.compoundAssumptions.length, 1);
  assert.equal(dish.compoundAssumptions[0]!.took, "eggs");
  assert.equal(dish.compoundAssumptions[0]!.dropped, "egg whites");
});

test("buildBomPlan: a dish with no ingredients is reported, not planned", () => {
  const plan = buildBomPlan({
    dishes: [{ name: "Coke Can", ingredients: [] }],
    inventoryByNo: INV,
    mapping: MAPPING,
  });
  assert.equal(plan.dishes[0]!.status, "no-ingredients");
  assert.equal(plan.stats.noIngredients, 1);
});

// ── slug fence: the collision case (review finding, confirmed) ──────────────
//
// normNameLikeSeed strips parentheticals, and the catalog has three dish
// FAMILIES distinguished only by them — Pesto Pasta (Veg/Chicken/Prawns) and
// the Hot n Sour / Manchow soup pairs, 7 dishes on 3 normalised keys. A
// single-stage normalised join keeps the LAST writer, which would hand one
// variant's ingredients to another variant's slug.

test("resolveCatalogSlug: exact names win, so variant families stay distinct", () => {
  assert.deepEqual(resolveCatalogSlug("Pesto Pasta (Veg)"), {
    slug: "pesto-pasta-veg",
    ambiguous: false,
  });
  assert.deepEqual(resolveCatalogSlug("Pesto Pasta (Chicken)"), {
    slug: "pesto-pasta-chicken",
    ambiguous: false,
  });
  assert.deepEqual(resolveCatalogSlug("Pesto Pasta (Prawns)"), {
    slug: "pesto-pasta-prawns",
    ambiguous: false,
  });
  assert.equal(resolveCatalogSlug("Hot n Sour Soup (Veg)").slug, "hot-n-sour-soup-veg");
  assert.equal(resolveCatalogSlug("Manchow Soup (Chicken)").slug, "manchow-soup-chicken");
});

test("resolveCatalogSlug: a name that only matches a COLLIDING key is ambiguous, not a guess", () => {
  // No exact "Pesto Pasta" dish exists; the normalised key maps to three
  // slugs. Picking one would be a coin flip on which recipe gets the rows.
  assert.deepEqual(resolveCatalogSlug("Pesto Pasta"), { slug: null, ambiguous: true });
});

test("resolveCatalogSlug: unknown names are absent, not ambiguous", () => {
  assert.deepEqual(resolveCatalogSlug("Definitely Not A Real Dish 9000"), {
    slug: null,
    ambiguous: false,
  });
});

test("buildBomPlan: an ambiguous dish is blocked and emits no rows", () => {
  const plan = buildBomPlan({
    dishes: [{ name: "Pesto Pasta", ingredients: ["Eggs - 2"] }],
    inventoryByNo: INV,
    mapping: MAPPING,
  });
  assert.equal(plan.dishes[0]!.status, "blocked-ambiguous-slug");
  assert.equal(plan.dishes[0]!.slug, null);
  assert.equal(plan.stats.blockedAmbiguous, 1);
  assert.equal(plan.ready.length, 0);
});
