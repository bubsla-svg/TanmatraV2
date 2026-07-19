/**
 * Tests for the trial lifecycle finalization sweep (runTrialLifecycleSweep).
 *
 * Background: `trial_bridge_eligible` (all 3 sampler deliveries delivered)
 * and the never-otherwise-assigned `trial_ended_undecided` / `ended_abandoned`
 * states — see trialLifecycleScheduler.ts's header comment for the full
 * rationale. Grace periods used here are the module's own defaults:
 * TRIAL_UNDECIDED_GRACE_DAYS=3, TRIAL_ABANDON_GRACE_DAYS=4 (7 total).
 *
 * Each test seeds a trial subscription with 3 "delivered" deliveries whose
 * timestamps place the 3rd (the anchor `runTrialLifecycleSweep` reads) a
 * controlled number of days in the past, then asserts on that ONE
 * subscription's row after the sweep — never on the sweep's aggregate
 * counters — so the test is safe to run concurrently with other suites
 * that touch the same shared subscriptions table (see subscriptions.
 * sprint56.test.ts, which also produces a trial_bridge_eligible row, but
 * with a fresh/near-zero-age anchor that never crosses these grace
 * thresholds).
 *
 * Run with:
 *   node --test --import tsx ./src/lib/trialLifecycleScheduler.test.ts
 */

import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  usersTable,
  subscriptionsTable,
  subscriptionDeliveriesTable,
  subscriptionMandatesTable,
  type TrialState,
  type SubscriptionStatus,
} from "@workspace/db";

import { runTrialLifecycleSweep } from "./trialLifecycleScheduler";

const CREATED_USER_IDS: string[] = [];

async function makeUser(): Promise<string> {
  const id = randomUUID();
  await db.insert(usersTable).values({
    id,
    email: `trial-lifecycle-${id}@example.test`,
    firstName: "TrialLifecycle",
    lastName: "Tester",
  });
  CREATED_USER_IDS.push(id);
  return id;
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/**
 * Seeds a subscription plus 3 "delivered" subscription_deliveries rows.
 * The rows are spaced a day apart so ordering by updatedAt is unambiguous,
 * with the 3rd (the anchor the sweep reads) landing exactly
 * `completedDaysAgo` days in the past.
 */
async function seedTrialSubscription(
  trialState: TrialState | null,
  completedDaysAgo: number,
  status: SubscriptionStatus = "active",
): Promise<number> {
  const userId = await makeUser();
  const startDate = daysAgo(completedDaysAgo + 3);
  const [sub] = await db
    .insert(subscriptionsTable)
    .values({
      userId,
      cadence: "weekly",
      mealsPerDelivery: 3,
      deliveryWindow: "12:00-14:00",
      status,
      startDate,
      nextDeliveryAt: startDate,
      pricePerDeliveryPaise: 149900,
      trialState,
    })
    .returning();

  for (let i = 0; i < 3; i++) {
    // i=0 is the oldest delivery, i=2 (the 3rd, ascending) is the anchor.
    const deliveredAt = daysAgo(completedDaysAgo + (2 - i));
    await db.insert(subscriptionDeliveriesTable).values({
      subscriptionId: sub!.id,
      scheduledFor: deliveredAt,
      deliveryWindow: "12:00-14:00",
      status: "delivered",
      updatedAt: deliveredAt,
    });
  }

  return sub!.id;
}

async function getSub(id: number) {
  const [sub] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.id, id));
  return sub!;
}

test("trial_bridge_eligible within the first grace window (1 day since completion) is left alone", async () => {
  const subId = await seedTrialSubscription("trial_bridge_eligible", 1);
  await runTrialLifecycleSweep();
  const sub = await getSub(subId);
  assert.equal(sub.trialState, "trial_bridge_eligible");
  assert.equal(sub.status, "active");
});

test(
  "trial_bridge_eligible past the first grace window only (4 days since completion) " +
    "advances to trial_ended_undecided, and stays there on this same sweep run " +
    "(4 days hasn't crossed the combined 7-day abandonment threshold yet)",
  async () => {
    const subId = await seedTrialSubscription("trial_bridge_eligible", 4);
    await runTrialLifecycleSweep();
    const sub = await getSub(subId);
    assert.equal(sub.trialState, "trial_ended_undecided");
    assert.equal(sub.status, "active", "not cancelled — the trial is only undecided, not yet abandoned");
  },
);

test(
  "trial_bridge_eligible past BOTH grace windows combined (10 days since completion) " +
    "jumps straight to ended_abandoned + cancelled in a SINGLE sweep call. " +
    "Design choice: the sweep places a subscription in whichever stage its total " +
    "elapsed time implies, rather than requiring one sweep tick per stage — so a " +
    "trial that was never swept for a long stretch (disabled scheduler, deploy gap) " +
    "doesn't linger in an intermediate state waiting for a second run to catch up.",
  async () => {
    const subId = await seedTrialSubscription("trial_bridge_eligible", 10);
    await runTrialLifecycleSweep();
    const sub = await getSub(subId);
    assert.equal(sub.trialState, "ended_abandoned");
    assert.equal(sub.status, "cancelled");
  },
);

test("trial_ended_undecided past the second grace window (8 days total since completion) transitions to ended_abandoned and cancels the subscription", async () => {
  const subId = await seedTrialSubscription("trial_ended_undecided", 8);
  // A trial shouldn't normally carry a mandate (see trialLifecycleScheduler.ts's
  // abandonTrial doc comment on why the payments isRecurring gate doesn't
  // actually exclude trials by trialState) — seed one anyway to confirm the
  // abandonment path revokes it defensively, exactly like the real
  // /subscriptions/:id/cancel route does.
  await db.insert(subscriptionMandatesTable).values({
    subscriptionId: subId,
    razorpayCustomerId: "cust_test_trial",
    razorpayTokenId: "tok_test_trial",
    status: "active",
    nextChargeAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  await runTrialLifecycleSweep();

  const sub = await getSub(subId);
  assert.equal(sub.trialState, "ended_abandoned");
  assert.equal(sub.status, "cancelled");

  const [mandate] = await db
    .select()
    .from(subscriptionMandatesTable)
    .where(eq(subscriptionMandatesTable.subscriptionId, subId));
  assert.equal(mandate!.status, "cancelled", "any incidental mandate must be revoked on abandonment too");
});

test("a trial that reached converted is never touched by the sweep, no matter how much time has passed", async () => {
  const subId = await seedTrialSubscription("converted", 30);
  await runTrialLifecycleSweep();
  const sub = await getSub(subId);
  assert.equal(sub.trialState, "converted");
  assert.equal(sub.status, "active");
});

test("a non-trial subscription (trialState: null) is never touched by the sweep", async () => {
  const subId = await seedTrialSubscription(null, 30);
  await runTrialLifecycleSweep();
  const sub = await getSub(subId);
  assert.equal(sub.trialState, null);
  assert.equal(sub.status, "active");
});

after(async () => {
  if (CREATED_USER_IDS.length > 0) {
    // subscriptions -> subscription_deliveries / subscription_mandates all
    // cascade on user delete (FK onDelete: "cascade"), same as
    // subscriptions.trial.test.ts's cleanup.
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
});
