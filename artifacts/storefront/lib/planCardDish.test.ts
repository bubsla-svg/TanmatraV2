// Landing-page plan cards: real dishes only, never a stand-in or a borrowed number.
//   cd artifacts/api-server && node --test --import tsx ../storefront/lib/planCardDish.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { DISHES } from "@workspace/menu-catalog";
import type { DishData } from "@workspace/menu-catalog";
import { poolForPlan } from "@workspace/subscription-rules";
import { pickPlanCardDishes } from "./planCardDish";
import { DIET_TRACKS } from "./plans";

const CARD_PLANS = ["desk_fuel", "steady", "protein_build"] as const;

/** Every dish the plan rotates, any track — the honest universe for a card. */
function rotationSlugs(planId: (typeof CARD_PLANS)[number], dishes: readonly DishData[]): Set<string> {
  const slugs = new Set<string>();
  for (const track of DIET_TRACKS) {
    for (const dish of poolForPlan(planId, track, dishes)) slugs.add(dish.slug);
  }
  return slugs;
}

test("each plan card's dish is one that plan actually rotates", () => {
  const picked = pickPlanCardDishes(CARD_PLANS, DISHES);
  for (const planId of CARD_PLANS) {
    const card = picked[planId];
    assert.ok(card, `${planId} should resolve a real dish from the live catalog`);
    assert.ok(
      rotationSlugs(planId, DISHES).has(card.slug),
      `${card.slug} is not in ${planId}'s pool — the card would misrepresent the plan`,
    );
  }
});

test("every field on the card is the dish's own", () => {
  const picked = pickPlanCardDishes(CARD_PLANS, DISHES);
  for (const planId of CARD_PLANS) {
    const card = picked[planId]!;
    const dish = DISHES.find((d) => d.slug === card.slug)!;
    assert.equal(card.name, dish.name);
    assert.equal(card.image, dish.image, "src must be the catalog's own image path");
    assert.equal(card.isVeg, dish.isVeg);
    assert.equal(card.pricePaise, dish.price, "price must be the dish's, never another plan's");
    assert.deepEqual(card.macros, dish.macros, "macros must not be invented");
    assert.equal(card.rdNote, dish.rdNote, "an absent RD note must stay absent");
  }
});

test("no card reuses another card's dish", () => {
  const picked = pickPlanCardDishes(CARD_PLANS, DISHES);
  const slugs = CARD_PLANS.map((p) => picked[p]?.slug).filter(Boolean);
  assert.equal(new Set(slugs).size, slugs.length, "three plans must not share one dish");
});

test("no placeholder host can reach a plan card", () => {
  const picked = pickPlanCardDishes(CARD_PLANS, DISHES);
  for (const planId of CARD_PLANS) {
    const src = picked[planId]?.image ?? "";
    for (const banned of ["picsum.photos", "images.unsplash.com", "lh3.googleusercontent.com"]) {
      assert.ok(!src.includes(banned), `${planId} resolved a banned placeholder host: ${src}`);
    }
  }
});

test("an empty catalog yields null, never a substitute dish", () => {
  const picked = pickPlanCardDishes(CARD_PLANS, []);
  for (const planId of CARD_PLANS) {
    assert.equal(picked[planId], null, `${planId} must degrade to no card, not a stand-in`);
  }
});

test("a dish with a blank image is skipped, not rendered as an empty src", () => {
  const pool = [...rotationSlugs("desk_fuel", DISHES)];
  assert.ok(pool.length >= 2, "fixture needs a pool of at least two dishes");
  const blanked = DISHES.map((d) => (d.slug === pool[0] ? { ...d, image: "  " } : d));

  const card = pickPlanCardDishes(["desk_fuel"], blanked).desk_fuel;
  assert.ok(card, "a blank image on one dish must not blank the whole card");
  assert.notEqual(card.image.trim(), "", "image must never be empty");
  assert.notEqual(card.slug, pool[0], "the blank-image dish should have been skipped");
});

test("a dish whose macros are provisional is never used as evidence", () => {
  const pool = [...rotationSlugs("steady", DISHES)];
  assert.ok(pool.length >= 2, "fixture needs a pool of at least two dishes");
  const flagged = DISHES.map((d) =>
    d.slug === pool[0] ? { ...d, macrosProvisional: true } : d,
  );

  const card = pickPlanCardDishes(["steady"], flagged).steady;
  assert.ok(card, "one provisional dish must not empty the card");
  assert.notEqual(card.slug, pool[0], "a spec card cannot be built on unresolved macros");
});

test("the estimated-macros tilde is opt-in, and the RD badge fails closed", () => {
  const pool = [...rotationSlugs("steady", DISHES)];
  const target = pool[0]!;
  const doctored = DISHES.map((d) =>
    d.slug === target
      ? { ...d, macrosEstimated: undefined, rdVerified: undefined as unknown as boolean }
      : d,
  );

  const card = pickPlanCardDishes(["steady"], doctored).steady!;
  assert.equal(card.slug, target);
  assert.equal(card.macrosEstimated, false, "an unflagged dish must not be marked approximate");
  assert.equal(card.rdVerified, false, "an unknown verification status must not read as verified");
});

test("selection is deterministic across calls", () => {
  const a = pickPlanCardDishes(CARD_PLANS, DISHES);
  const b = pickPlanCardDishes(CARD_PLANS, DISHES);
  assert.deepEqual(a, b, "the same catalog must always render the same three dishes");
});
