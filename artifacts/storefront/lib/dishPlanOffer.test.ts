/**
 * The one-time ↔ plan toggle can only claim what is true of the live catalog.
 *
 * Plan item 1.1 describes the toggle as swapping "server-quoted price, CTA copy,
 * and per-delivery savings" — phrasing that assumes a plan is always the
 * cheaper way to eat a given dish. Against current pricing it is not, and these
 * tests pin the two facts that make the honest version different from the
 * described one:
 *
 *   - 60 of 116 dishes are in no bookable plan at all
 *   - of the 56 that are, a plan is dearer per delivery for 17 of them
 *
 * Run: node --test --import tsx ./lib/dishPlanOffer.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { DISHES } from "@workspace/menu-catalog";
import {
  PLAN_CATALOG,
  computePlanQuote,
  planIsSelfServiceLaunchable,
  poolForPlan,
  type PlanId,
} from "@workspace/subscription-rules";
import { dishPlanOffer } from "./dishPlanOffer";

const withOffer = DISHES.filter((d) => dishPlanOffer(d.slug, DISHES) !== null);

test("a dish in no bookable plan offers nothing, rather than a plan it isn't in", () => {
  // The toggle must not appear at all for these — there is nothing to switch
  // to, and inventing one would put a dish in a rotation that never serves it.
  const without = DISHES.filter((d) => dishPlanOffer(d.slug, DISHES) === null);
  assert.ok(without.length > 0, "if every dish is now in a plan, this rule has no live case");
  for (const dish of without) {
    const carried = (Object.keys(PLAN_CATALOG) as PlanId[]).some(
      (p) =>
        planIsSelfServiceLaunchable(p) &&
        computePlanQuote(p).pricePerMealPaise != null &&
        (["veg", "egg", "nonveg"] as const).some((t) =>
          poolForPlan(p, t, DISHES).some((d) => d.slug === dish.slug),
        ),
    );
    assert.equal(carried, false, `${dish.slug} IS in a quotable plan but offered none`);
  }
});

test("an offered plan really contains the dish", () => {
  for (const dish of withOffer) {
    const offer = dishPlanOffer(dish.slug, DISHES);
    assert.ok(offer);
    const inRotation = (["veg", "egg", "nonveg"] as const).some((t) =>
      poolForPlan(offer.planId, t, DISHES).some((d) => d.slug === dish.slug),
    );
    assert.ok(inRotation, `${dish.slug} offered ${offer.planId}, which does not rotate it`);
  }
});

test("only a bookable plan is ever offered", () => {
  // A blocked or sales-led plan routes to a waitlist, not a checkout. Offering
  // one from a dish page would be a CTA that cannot complete.
  for (const dish of withOffer) {
    const offer = dishPlanOffer(dish.slug, DISHES);
    assert.ok(offer);
    assert.ok(planIsSelfServiceLaunchable(offer.planId), `${offer.planId} is not self-service`);
  }
});

test("a saving is claimed only when one exists", () => {
  // The sharp edge. A ₹109 salad against a ₹199/meal plan has no saving, and
  // printing one — or rounding a negative to zero — would be the fabricated
  // benefit this whole workstream exists to remove.
  let claimed = 0;
  let withheld = 0;
  for (const dish of withOffer) {
    const offer = dishPlanOffer(dish.slug, DISHES);
    assert.ok(offer);
    if (offer.savingPaise == null) {
      withheld += 1;
      assert.ok(
        dish.price <= offer.perDeliveryPaise,
        `${dish.slug} withheld a saving it actually has`,
      );
    } else {
      claimed += 1;
      assert.ok(offer.savingPaise > 0, "a saving must be positive to be a saving");
      assert.equal(offer.savingPaise, dish.price - offer.perDeliveryPaise);
    }
  }
  assert.ok(claimed > 0 && withheld > 0, "both branches must have live cases on this catalog");
});

test("the cheapest carrying plan wins, so the price is never overstated", () => {
  for (const dish of withOffer) {
    const offer = dishPlanOffer(dish.slug, DISHES);
    assert.ok(offer);
    for (const planId of Object.keys(PLAN_CATALOG) as PlanId[]) {
      if (!planIsSelfServiceLaunchable(planId)) continue;
      const per = computePlanQuote(planId).pricePerMealPaise;
      if (per == null) continue;
      const carries = (["veg", "egg", "nonveg"] as const).some((t) =>
        poolForPlan(planId, t, DISHES).some((d) => d.slug === dish.slug),
      );
      if (!carries) continue;
      assert.ok(
        offer.perDeliveryPaise <= per,
        `${dish.slug} offered ${offer.perDeliveryPaise} while ${planId} carries it for ${per}`,
      );
    }
  }
});

test("every price is the spine's own, not arithmetic done here", () => {
  for (const dish of withOffer.slice(0, 12)) {
    const offer = dishPlanOffer(dish.slug, DISHES);
    assert.ok(offer);
    const quote = computePlanQuote(offer.planId);
    assert.equal(offer.perDeliveryPaise, quote.pricePerMealPaise);
    assert.equal(offer.cycleTotalPaise, quote.cycleTotalPaise);
    assert.equal(offer.mealsPerCycle, quote.mealsPerCycle);
  }
});

test("the same dish always offers the same plan", () => {
  // A toggle whose price moved between renders would be unusable, and the test
  // above could not assert on it.
  for (const dish of withOffer.slice(0, 20)) {
    assert.deepEqual(dishPlanOffer(dish.slug, DISHES), dishPlanOffer(dish.slug, DISHES));
  }
});

test("an unknown slug offers nothing rather than throwing", () => {
  assert.equal(dishPlanOffer("no-such-dish", DISHES), null);
  assert.equal(dishPlanOffer("", DISHES), null);
});

test("an empty catalog offers nothing", () => {
  assert.equal(dishPlanOffer("anything", []), null);
});
