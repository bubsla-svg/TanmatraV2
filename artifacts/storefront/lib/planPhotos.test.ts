// Landing-page plan photography: real dishes only, never a stand-in.
//   cd artifacts/api-server && node --test --import tsx ../storefront/lib/planPhotos.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { DISHES } from "@workspace/menu-catalog";
import type { DishData } from "@workspace/menu-catalog";
import { poolForPlan } from "@workspace/subscription-rules";
import { pickPlanPhotos } from "./planPhotos";
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

test("each plan card's photo is a dish that plan actually rotates", () => {
  const photos = pickPlanPhotos(CARD_PLANS, DISHES);
  for (const planId of CARD_PLANS) {
    const photo = photos[planId];
    assert.ok(photo, `${planId} should resolve a real dish photo from the live catalog`);
    const dish = DISHES.find((d) => d.name === photo.alt);
    assert.ok(dish, `alt "${photo.alt}" must name a real dish, not a description`);
    assert.ok(
      rotationSlugs(planId, DISHES).has(dish.slug),
      `${dish.slug} is not in ${planId}'s pool — the card would misrepresent the plan`,
    );
    assert.equal(photo.src, dish.image, "src must be the catalog's own image path");
  }
});

test("no card reuses another card's dish", () => {
  const photos = pickPlanPhotos(CARD_PLANS, DISHES);
  const alts = CARD_PLANS.map((p) => photos[p]?.alt).filter(Boolean);
  assert.equal(new Set(alts).size, alts.length, "three plans must not share one photo");
});

test("no placeholder host can reach a plan card", () => {
  const photos = pickPlanPhotos(CARD_PLANS, DISHES);
  for (const planId of CARD_PLANS) {
    const src = photos[planId]?.src ?? "";
    for (const banned of ["picsum.photos", "images.unsplash.com", "lh3.googleusercontent.com"]) {
      assert.ok(!src.includes(banned), `${planId} resolved a banned placeholder host: ${src}`);
    }
  }
});

test("an empty catalog yields null, never a substitute photo", () => {
  const photos = pickPlanPhotos(CARD_PLANS, []);
  for (const planId of CARD_PLANS) {
    assert.equal(photos[planId], null, `${planId} must degrade to no image, not a stand-in`);
  }
});

test("a dish with a blank image is skipped, not rendered as an empty src", () => {
  const pool = [...rotationSlugs("desk_fuel", DISHES)];
  assert.ok(pool.length >= 2, "fixture needs a pool of at least two dishes");
  const blanked = DISHES.map((d) => (d.slug === pool[0] ? { ...d, image: "  " } : d));

  const photos = pickPlanPhotos(["desk_fuel"], blanked);
  const photo = photos.desk_fuel;
  assert.ok(photo, "a blank image on one dish must not blank the whole card");
  assert.notEqual(photo.src.trim(), "", "src must never be empty");
  assert.notEqual(
    DISHES.find((d) => d.name === photo.alt)?.slug,
    pool[0],
    "the blank-image dish should have been skipped",
  );
});

test("selection is deterministic across calls", () => {
  const a = pickPlanPhotos(CARD_PLANS, DISHES);
  const b = pickPlanPhotos(CARD_PLANS, DISHES);
  assert.deepEqual(a, b, "the same catalog must always render the same three photos");
});
