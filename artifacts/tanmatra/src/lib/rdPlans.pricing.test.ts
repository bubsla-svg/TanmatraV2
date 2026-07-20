/**
 * Cross-surface price-consistency invariants.
 *
 * Locks the defect class found in the 2026-07 consistency scan
 * (docs/illogical-instances-register.md): the same plan/trial rendering
 * different prices on different surfaces because each surface hardcoded
 * its own meal-count basis. Every card, landing page, and the Subscribe
 * wizard now derive meal count AND price from one canonical basis — these
 * tests fail the moment any of that re-forks.
 *
 * Run (same harness as useWizardState.test.ts — tanmatra has no test
 * script; the api-server package provides the tsx loader):
 *   cd artifacts/api-server && node --test --import tsx ../tanmatra/src/lib/rdPlans.pricing.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  computeDeliveryPricePaise,
  computeTrialPricePaise,
  cadenceDiscountPct,
  MAX_CADENCE_DISCOUNT_PCT,
  TRIAL_MEALS,
  TRIAL_DAYS,
  CADENCE_DISCOUNT,
  type SubscriptionCadence,
} from "@workspace/subscription-rules";
import {
  RD_PLANS,
  planWeeklyPricePaise,
  planCardPricePaise,
  getRdPlanBySlug,
} from "./rdPlans";

const TRIAL_SLUG = "three-day-trial-pack";

test("every recurring plan carries an internally-consistent advertised basis", () => {
  for (const plan of RD_PLANS) {
    if (plan.slug === TRIAL_SLUG) continue;
    assert.ok(
      plan.advertisedBasis,
      `${plan.slug}: recurring plans must declare advertisedBasis — a missing basis re-opens the generic 14-meal wizard default (the ₹3,800 → ₹10,474 bug)`,
    );
    const b = plan.advertisedBasis!;
    const slotCount =
      Number(b.slots.breakfast) + Number(b.slots.lunch) + Number(b.slots.dinner);
    const days = b.daysMode === "everyday" ? 7 : 5;
    assert.equal(
      b.mealsPerWeek,
      slotCount * days,
      `${plan.slug}: mealsPerWeek must equal slots × days — the three fields may never disagree`,
    );
  }
});

test("card price for a recurring plan is the billing math at its advertised basis", () => {
  for (const plan of RD_PLANS) {
    if (plan.slug === TRIAL_SLUG) continue;
    const weekly = planWeeklyPricePaise(plan);
    assert.ok(weekly != null, `${plan.slug}: weekly price must derive`);
    assert.equal(
      weekly,
      computeDeliveryPricePaise("weekly", plan.advertisedBasis!.mealsPerWeek),
      `${plan.slug}: card price must be computeDeliveryPricePaise at the advertised basis — nothing else`,
    );
    assert.equal(planCardPricePaise(plan), weekly);
    // The legacy copy field must never be what a surface renders.
    assert.notEqual(
      planCardPricePaise(plan),
      plan.pricePerWeekPaise,
      `${plan.slug}: planCardPricePaise resolving to the legacy pricePerWeekPaise means a surface is one refactor away from the ₹5,490-style drift again`,
    );
  }
});

test("the marketed trial is one product with one price everywhere", () => {
  assert.equal(TRIAL_MEALS, 3, "the marketed 3-Day Trial is 3 meals (1/day × 3 days)");
  assert.equal(TRIAL_DAYS, 3);
  const trialPrice = computeTrialPricePaise(TRIAL_MEALS);
  // The Phase-A1 flat price: ₹1,427.62 subtotal + 5% GST = ₹1,499 all-in.
  assert.equal(trialPrice, 149900, "trial must hit the flat ₹1,499 special case");
  const trialPlan = getRdPlanBySlug(TRIAL_SLUG);
  assert.ok(trialPlan, "trial pack exists in RD_PLANS");
  assert.equal(
    planCardPricePaise(trialPlan!),
    trialPrice,
    "the trial card and the trial special-case must be the same number",
  );
  // The 9-meal reading (3 slots × 3 days) must remain more expensive than
  // the marketed trial — if this flips, the basis semantics changed and
  // every trial surface needs review.
  assert.ok(computeTrialPricePaise(9) > trialPrice);
});

test("canonical price-point overrides still hold", () => {
  assert.equal(computeDeliveryPricePaise("weekly", 5), 380000, "5 weekday lunches = ₹3,800/wk");
  assert.equal(computeDeliveryPricePaise("fortnightly", 10), 741000, "₹7,410/fortnight");
  assert.equal(computeDeliveryPricePaise("monthly", 30), 2166000, "₹21,660/6-week cycle");
});

test("discount copy can only ever derive truthful percentages", () => {
  assert.equal(cadenceDiscountPct("weekly"), 5);
  assert.equal(cadenceDiscountPct("fortnightly"), 10);
  assert.equal(cadenceDiscountPct("monthly"), 15);
  const cadences = Object.keys(CADENCE_DISCOUNT) as SubscriptionCadence[];
  assert.equal(
    MAX_CADENCE_DISCOUNT_PCT,
    Math.max(...cadences.map(cadenceDiscountPct)),
    "the 'save up to N%' ceiling must be derived, never a literal",
  );
});
