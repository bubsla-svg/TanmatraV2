import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  DEFAULT_FOOD_MARGIN_PCT,
  buildDishCostIndex,
  lookupUnitFoodCostPaise,
  normalizeDishKey,
  type MenuItemRef,
} from "./dishCostIndex";

const PRICE_PAISE = 30_000; // ₹300 dish
const RECIPE_COST_PAISE = 15_000; // ₹150 of food in it

const MENU: MenuItemRef[] = [
  { slug: "quinoa-upma", name: "Quinoa Upma", pricePaise: PRICE_PAISE },
  { slug: "millet-khichdi", name: "Millet Khichdi", pricePaise: 28_000 },
];

function indexWith(
  costs: Iterable<[string, number | null]> = [
    ["quinoa-upma", RECIPE_COST_PAISE],
  ],
) {
  return buildDishCostIndex(MENU, new Map(costs));
}

describe("dish cost index — name/slug resolution", () => {
  it("resolves an order line's display name to its costed recipe", () => {
    const got = lookupUnitFoodCostPaise(indexWith(), "Quinoa Upma", PRICE_PAISE);
    assert.equal(got.slug, "quinoa-upma");
    assert.equal(got.costPaise, RECIPE_COST_PAISE);
    assert.equal(got.basis, "recipe");
  });

  it("survives case and punctuation drift in the stored name", () => {
    for (const variant of ["QUINOA UPMA", "quinoa  upma", "Quinoa-Upma!"]) {
      const got = lookupUnitFoodCostPaise(indexWith(), variant, PRICE_PAISE);
      assert.equal(got.basis, "recipe", `variant "${variant}" should resolve`);
      assert.equal(got.costPaise, RECIPE_COST_PAISE);
    }
  });

  it("still resolves legacy lines that stored the slug in the name field", () => {
    const got = lookupUnitFoodCostPaise(indexWith(), "quinoa-upma", PRICE_PAISE);
    assert.equal(got.slug, "quinoa-upma");
    assert.equal(got.basis, "recipe");
  });

  it("normalizes names and slugs onto one key space", () => {
    assert.equal(normalizeDishKey("Quinoa Upma"), "quinoa-upma");
    assert.equal(normalizeDishKey("quinoa-upma"), "quinoa-upma");
    assert.equal(normalizeDishKey("  Quinoa  Upma!  "), "quinoa-upma");
  });
});

describe("dish cost index — unknown is not zero", () => {
  it("estimates from the line price rather than costing an unknown dish at zero", () => {
    const got = lookupUnitFoodCostPaise(
      indexWith([]),
      "Quinoa Upma",
      PRICE_PAISE,
    );
    assert.equal(got.basis, "estimate");
    assert.equal(
      got.costPaise,
      Math.round(PRICE_PAISE * (1 - DEFAULT_FOOD_MARGIN_PCT)),
    );
    assert.ok(got.costPaise > 0, "an estimated dish still costs something");
  });

  it("treats null, zero and negative stored costs identically as unknown", () => {
    for (const stored of [null, 0, -1, -500] as Array<number | null>) {
      const got = lookupUnitFoodCostPaise(
        indexWith([["quinoa-upma", stored]]),
        "Quinoa Upma",
        PRICE_PAISE,
      );
      assert.equal(got.basis, "estimate", `stored ${stored} is not a cost`);
      assert.equal(
        got.costPaise,
        Math.round(PRICE_PAISE * (1 - DEFAULT_FOOD_MARGIN_PCT)),
      );
    }
  });

  it("falls back to the catalog price when the line carries no price", () => {
    const got = lookupUnitFoodCostPaise(indexWith([]), "Millet Khichdi", 0);
    assert.equal(got.slug, "millet-khichdi");
    assert.equal(got.basis, "estimate");
    assert.equal(got.costPaise, Math.round(28_000 * (1 - DEFAULT_FOOD_MARGIN_PCT)));
  });

  it("reports 'none' — not a silent zero — when there is no basis at all", () => {
    const got = lookupUnitFoodCostPaise(indexWith(), "Mystery Dish", 0);
    assert.equal(got.slug, null);
    assert.equal(got.costPaise, 0);
    // The zero is unavoidable here; what matters is that it is labelled, so a
    // caller can count it instead of quietly booking a free meal.
    assert.equal(got.basis, "none");
  });

  it("refuses to guess between two dishes that normalize to the same key", () => {
    const collide: MenuItemRef[] = [
      { slug: "dal-a", name: "Dal Tadka", pricePaise: 20_000 },
      { slug: "dal-b", name: "dal tadka", pricePaise: 24_000 },
    ];
    const idx = buildDishCostIndex(
      collide,
      new Map([
        ["dal-a", 5_000],
        ["dal-b", 12_000],
      ]),
    );
    const got = lookupUnitFoodCostPaise(idx, "Dal Tadka", 20_000);
    assert.equal(got.slug, null, "ambiguous keys must not resolve");
    assert.equal(got.basis, "estimate", "and must not be costed at zero either");
  });
});

describe("dish cost index — the regression it exists to prevent", () => {
  it("the old lookup asked a slug-keyed map for a lowercased name, and got nothing", () => {
    // Verbatim replay of wbr.ts's pre-fix arithmetic:
    //   const name = String(it.name ?? "").toLowerCase();
    //   const recipeCost = foodCostMap.get(name) ?? 0;
    const foodCostMap = new Map<string, number>([
      ["quinoa-upma", RECIPE_COST_PAISE],
    ]);
    const name = "Quinoa Upma".toLowerCase();
    assert.equal(foodCostMap.get(name) ?? 0, 0, "this is the bug");

    // The dish was costed the whole time; only the key was wrong.
    const now = lookupUnitFoodCostPaise(indexWith(), "Quinoa Upma", PRICE_PAISE);
    assert.equal(now.costPaise, RECIPE_COST_PAISE);
  });

  it("zeroed food cost put the weekly margin above the 35% alert threshold that it should have tripped", () => {
    // Scope note: this pins the CONSEQUENCE of the resolver's output, not
    // wbr.ts's code. Packaging and delivery are inputs here, mirroring the
    // per-unit constants wbr.ts uses, so the only variable is the food cost.
    const PACKAGING_PAISE = 1_500;
    const DELIVERY_PAISE = 4_500;
    const ALERT_THRESHOLD_PCT = 35.0; // routes/analytics.ts wbr/simulate
    const marginPct = (revenue: number, cost: number): number =>
      Math.round(((revenue - cost) / revenue) * 1000) / 10;

    const oldFoodCost = 0; // what the broken lookup produced
    const newFoodCost = lookupUnitFoodCostPaise(
      indexWith(),
      "Quinoa Upma",
      PRICE_PAISE,
    ).costPaise;

    const before = marginPct(
      PRICE_PAISE,
      oldFoodCost + PACKAGING_PAISE + DELIVERY_PAISE,
    );
    const after = marginPct(
      PRICE_PAISE,
      newFoodCost + PACKAGING_PAISE + DELIVERY_PAISE,
    );

    assert.equal(before, 80.0);
    assert.equal(after, 30.0);
    assert.ok(
      before > ALERT_THRESHOLD_PCT && after < ALERT_THRESHOLD_PCT,
      "the margin alarm could not ring while food cost resolved to zero",
    );
  });
});
