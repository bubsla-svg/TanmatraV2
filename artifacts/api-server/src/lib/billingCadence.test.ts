/**
 * Pins for lib/billingCadence.ts — the module holding WHICH cadences mint a
 * UPI Autopay mandate and HOW LONG a billed cycle is.
 *
 * Two of these are lockstep pins across module boundaries:
 *   - billingCadenceDays restates routes/subscriptions.ts's CADENCE_DAYS
 *     (restated, not imported, to avoid an import cycle through
 *     razorpayRecurring.ts) — the first test fails the build the day the
 *     delivery table and the billing table disagree, which is the "billed
 *     every 30 days for a 42-day cycle of food" over-billing bug.
 *   - AUTOPAY_CADENCES excludes quarterly BECAUSE of the price table: a
 *     quarterly cycle can bill over the ₹15,000 token ceiling, so a mandate
 *     registered under that ceiling could never collect it. The arithmetic is
 *     asserted against the live planCatalog so a repricing that changes the
 *     answer surfaces here instead of in a failed (or forbidden) debit.
 *
 * DB-free on purpose (runs in verify.yml's DB-free unit step): it does NOT
 * import routes/subscriptions, whose module load reaches the DB pool. The
 * billing↔delivery equality pin against CADENCE_DAYS therefore lives in
 * payments.subscriptionOrder.test.ts (a DB-backed suite that already imports
 * the routes); here the table is asserted by value.
 *
 * Run: node --test --import tsx ./src/lib/billingCadence.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { computePlanQuote, PLAN_CATALOG, type PlanId } from "@workspace/subscription-rules";
import type { SubscriptionCadence } from "@workspace/db";
import {
  AUTOPAY_CADENCES,
  MANDATE_MAX_AMOUNT_PAISE,
  billingCadenceDays,
  isAutopayCadence,
} from "./billingCadence";

const TRACKS = ["veg", "egg", "nonveg"] as const;

test("the billing table holds the delivery-cycle lengths, value for value", () => {
  // Mirrors routes/subscriptions.ts's CADENCE_DAYS (monthly = the 6-week
  // protocol, quarterly = 3 of them). The import-level equality pin is in
  // payments.subscriptionOrder.test.ts — see the header for why not here.
  const expected: Record<SubscriptionCadence, number> = {
    weekly: 7,
    fortnightly: 14,
    monthly: 42,
    quarterly: 126,
  };
  for (const [cadence, days] of Object.entries(expected)) {
    assert.equal(
      billingCadenceDays(cadence as SubscriptionCadence),
      days,
      `${cadence}: one delivered cycle must equal one billed cycle — a shorter billing period over-collects`,
    );
  }
});

test("monthly bills the 6-week protocol cycle, not a 30-day calendar month", () => {
  assert.equal(billingCadenceDays("monthly"), 42);
});

test("every autopay-eligible cycle total fits under the mandate's max_amount ceiling", () => {
  // The token block registers max_amount: MANDATE_MAX_AMOUNT_PAISE. Any
  // cadence in AUTOPAY_CADENCES must therefore only ever produce charges at
  // or under it, across every plan and diet track. (PlanCycle has no
  // "fortnightly" quote; a fortnightly charge bills less than the monthly
  // cycle it subdivides, so weekly+monthly bound it from both sides.)
  for (const planId of Object.keys(PLAN_CATALOG) as PlanId[]) {
    for (const track of TRACKS) {
      for (const cycle of ["weekly", "monthly"] as const) {
        const total = computePlanQuote(planId, track, cycle).cycleTotalPaise;
        assert.ok(
          total <= MANDATE_MAX_AMOUNT_PAISE,
          `${planId}/${track}/${cycle} bills ${total} paise — over the ${MANDATE_MAX_AMOUNT_PAISE} mandate ceiling`,
        );
      }
    }
  }
});

test("quarterly is excluded from autopay because it can bill over the ceiling", () => {
  assert.equal(isAutopayCadence("quarterly"), false);
  const overCeiling = (Object.keys(PLAN_CATALOG) as PlanId[]).some((planId) =>
    TRACKS.some(
      (track) => computePlanQuote(planId, track, "quarterly").cycleTotalPaise > MANDATE_MAX_AMOUNT_PAISE,
    ),
  );
  assert.ok(
    overCeiling,
    "no quarterly total exceeds the mandate ceiling any more — the exclusion of quarterly from AUTOPAY_CADENCES may be revisitable",
  );
});

test("the autopay set is exactly weekly, fortnightly, monthly", () => {
  assert.deepEqual([...AUTOPAY_CADENCES], ["weekly", "fortnightly", "monthly"]);
  for (const cadence of AUTOPAY_CADENCES) {
    assert.equal(isAutopayCadence(cadence), true);
  }
});
