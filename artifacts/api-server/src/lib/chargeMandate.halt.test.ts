/**
 * Tests for the billing-halt-on-repeated-failure behavior added to
 * chargeMandate.ts / chargeMandateScheduler.ts.
 *
 * Real Razorpay native subscriptions stop retrying and enter a terminal
 * `subscription.halted` state after N consecutive failed debits. This repo's
 * manual autopay-token model previously had no such cap — failCharge() just
 * incremented chargeFailureCount and left nextChargeAt at a near-future
 * retry point FOREVER. These tests cover the fix:
 *
 *   - 1 or 2 consecutive failures: mandate + subscription stay "active"
 *     (no premature halt).
 *   - The Nth (MAX_CONSECUTIVE_CHARGE_FAILURES-th) consecutive failure flips
 *     BOTH subscriptionMandatesTable.status and subscriptionsTable.status to
 *     "halted", pauses upcoming deliveries, and the outcome body carries
 *     code: "subscription_halted".
 *   - A halted mandate is excluded from runDueMandateChargesSweep on the
 *     next tick (the sweep's pre-existing status:"active" filters do this
 *     for free — no new filter needed).
 *   - A success in between resets chargeFailureCount to 0, so only FULLY
 *     CONSECUTIVE failures count toward the threshold (2 failures + 1
 *     success + 2 more failures must NOT halt).
 *   - Manually invoking chargeMandateCore against an already-halted
 *     subscription returns a distinct "subscription_halted" error rather
 *     than the generic "no active mandate" 404 or "subscription_inactive".
 *
 * Run with:
 *   node --test --import tsx ./src/lib/chargeMandate.halt.test.ts
 */

import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  usersTable,
  subscriptionsTable,
  subscriptionMandatesTable,
  subscriptionDeliveriesTable,
  preDebitNotificationsTable,
  ordersTable,
} from "@workspace/db";

import { chargeMandateCore, MAX_CONSECUTIVE_CHARGE_FAILURES } from "./chargeMandate";
import { runDueMandateChargesSweep } from "./chargeMandateScheduler";

process.env["RAZORPAY_KEY_ID"] = process.env["RAZORPAY_KEY_ID"] ?? "rzp_test_halt";
process.env["RAZORPAY_KEY_SECRET"] = process.env["RAZORPAY_KEY_SECRET"] ?? "secret_test_halt";

const RUN = randomUUID().slice(0, 8);

const noopLog = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

// ---------------------------------------------------------------------------
// Razorpay fetch shim — mirrors chargeMandateScheduler.test.ts. `rzpMode` is
// keyed per-test via a closure captured at seed time, so tests that run
// sequentially (node:test runs a file's top-level tests in order) can freely
// flip it between "success" and "fail_charge" mid-test.
// ---------------------------------------------------------------------------
const realFetch = globalThis.fetch;
let rzpMode: "success" | "fail_charge" = "success";
let rzpPaymentSeq = 0;

globalThis.fetch = (async (input: any, init?: any) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input?.url ?? String(input));

  if (url.includes("api.razorpay.com/v1/orders")) {
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: `order_halt_test_${RUN}_${rzpPaymentSeq}`, amount: 0, currency: "INR" }),
      text: async () => "{}",
    } as unknown as Response;
  }

  if (url.includes("api.razorpay.com/v1/payments/create/recurring")) {
    if (rzpMode === "fail_charge") {
      return {
        ok: false,
        status: 402,
        json: async () => ({ error: { description: "card declined" } }),
        text: async () => "card declined",
      } as unknown as Response;
    }
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    rzpPaymentSeq++;
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: `pay_halt_test_${RUN}_${rzpPaymentSeq}`, status: "captured", amount: body.amount ?? 0 }),
      text: async () => "{}",
    } as unknown as Response;
  }

  return realFetch(input, init);
}) as typeof fetch;

// ---------------------------------------------------------------------------
// Seed helpers (mirrors chargeMandateScheduler.test.ts's seedBillableSubscription)
// ---------------------------------------------------------------------------
const CREATED_USER_IDS: string[] = [];
const CREATED_SUB_IDS: number[] = [];
const CREATED_ORDER_IDS: number[] = [];

interface Seeded {
  userId: string;
  subId: number;
  mandateId: number;
  deliveryId: number;
}

/** Every failed-charge attempt below needs the mandate's nextChargeAt to
 * already be "due" (<= now) and a sent, >=24h-old pre-debit notice for that
 * exact charge date — otherwise the pre-debit gate rejects the call before
 * ever reaching the gateway / failCharge at all. seedDueSubscription wires
 * all of that up so each test only has to decide the RZP fetch-shim mode. */
async function seedDueSubscription(): Promise<Seeded> {
  const userId = randomUUID();
  await db.insert(usersTable).values({
    id: userId,
    email: `halt-${RUN}-${userId}@example.test`,
    firstName: "Halt",
    lastName: "Tester",
    phoneE164: null,
  });
  CREATED_USER_IDS.push(userId);

  const nextChargeAt = new Date(Date.now() - 60 * 60 * 1000); // due an hour ago
  const startDate = new Date(Date.now() - 30 * 24 * 3600 * 1000);

  const [sub] = await db
    .insert(subscriptionsTable)
    .values({
      userId,
      cadence: "weekly",
      mealsPerDelivery: 5,
      deliveryWindow: "12:00-14:00",
      status: "active",
      startDate,
      nextDeliveryAt: new Date(Date.now() + 2 * 24 * 3600 * 1000),
      pricePerDeliveryPaise: 38000,
    })
    .returning();
  CREATED_SUB_IDS.push(sub!.id);

  const [mandate] = await db
    .insert(subscriptionMandatesTable)
    .values({
      subscriptionId: sub!.id,
      razorpayCustomerId: `cust_halt_${RUN}`,
      razorpayTokenId: `tok_halt_${RUN}`,
      status: "active",
      nextChargeAt,
    })
    .returning();

  const [delivery] = await db
    .insert(subscriptionDeliveriesTable)
    .values({
      subscriptionId: sub!.id,
      scheduledFor: new Date(Date.now() + 2 * 24 * 3600 * 1000),
      deliveryWindow: "12:00-14:00",
      status: "upcoming",
      items: [],
    })
    .returning();

  const startOfDay = new Date(nextChargeAt);
  startOfDay.setUTCHours(12, 0, 0, 0);
  await db.insert(preDebitNotificationsTable).values({
    subscriptionId: sub!.id,
    scheduledChargeAt: startOfDay,
    status: "sent",
    dispatchedAt: new Date(Date.now() - 30 * 3600 * 1000), // 30h ago — well past the 24h floor
  });

  return { userId, subId: sub!.id, mandateId: mandate!.id, deliveryId: delivery!.id };
}

/** Re-arm the mandate's nextChargeAt (and a fresh matching pre-debit notice)
 * so a subsequent chargeMandateCore call is due again — mirrors what the
 * real scheduler does between ticks, needed here because each failed charge
 * attempt advances nextChargeAt by ~24h via chargeMandateCore's claim step. */
async function rearmForNextAttempt(subId: number): Promise<void> {
  const [mandate] = await db
    .select()
    .from(subscriptionMandatesTable)
    .where(eq(subscriptionMandatesTable.subscriptionId, subId));
  const nextChargeAt = new Date(Date.now() - 60 * 60 * 1000);
  await db
    .update(subscriptionMandatesTable)
    .set({ nextChargeAt })
    .where(eq(subscriptionMandatesTable.id, mandate!.id));
  const startOfDay = new Date(nextChargeAt);
  startOfDay.setUTCHours(12, 0, 0, 0);
  await db.insert(preDebitNotificationsTable).values({
    subscriptionId: subId,
    scheduledChargeAt: startOfDay,
    status: "sent",
    dispatchedAt: new Date(Date.now() - 30 * 3600 * 1000),
  });
}

after(async () => {
  globalThis.fetch = realFetch;
  if (CREATED_USER_IDS.length > 0) {
    await db.delete(ordersTable).where(inArray(ordersTable.userId, CREATED_USER_IDS));
  }
  if (CREATED_ORDER_IDS.length > 0) {
    await db.delete(ordersTable).where(inArray(ordersTable.id, CREATED_ORDER_IDS));
  }
  if (CREATED_SUB_IDS.length > 0) {
    await db.delete(subscriptionDeliveriesTable).where(inArray(subscriptionDeliveriesTable.subscriptionId, CREATED_SUB_IDS));
    await db.delete(preDebitNotificationsTable).where(inArray(preDebitNotificationsTable.subscriptionId, CREATED_SUB_IDS));
    await db.delete(subscriptionMandatesTable).where(inArray(subscriptionMandatesTable.subscriptionId, CREATED_SUB_IDS));
    await db.delete(subscriptionsTable).where(inArray(subscriptionsTable.id, CREATED_SUB_IDS));
  }
  if (CREATED_USER_IDS.length > 0) {
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
});

test("MAX_CONSECUTIVE_CHARGE_FAILURES is 3", () => {
  // Locks the threshold value in a test so a silent change is caught.
  assert.equal(MAX_CONSECUTIVE_CHARGE_FAILURES, 3);
});

test("1 failure keeps the mandate and subscription active (no premature halt)", async () => {
  const seeded = await seedDueSubscription();
  rzpMode = "fail_charge";
  const result = await chargeMandateCore({ subscriptionId: seeded.subId, log: noopLog });
  rzpMode = "success";

  assert.equal(result.ok, false);
  assert.equal(result.httpStatus, 502);
  assert.equal((result.body as any).code, undefined, "must not carry subscription_halted yet");

  const [mandate] = await db.select().from(subscriptionMandatesTable).where(eq(subscriptionMandatesTable.subscriptionId, seeded.subId));
  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, seeded.subId));
  assert.equal(mandate!.status, "active");
  assert.equal(mandate!.chargeFailureCount, 1);
  assert.equal(sub!.status, "active");
});

test("2 consecutive failures still keep the mandate active and keep retrying", async () => {
  const seeded = await seedDueSubscription();
  rzpMode = "fail_charge";

  const first = await chargeMandateCore({ subscriptionId: seeded.subId, log: noopLog });
  assert.equal(first.ok, false);
  await rearmForNextAttempt(seeded.subId);
  const second = await chargeMandateCore({ subscriptionId: seeded.subId, log: noopLog });
  assert.equal(second.ok, false);
  assert.equal((second.body as any).code, undefined, "still below threshold — must not halt");

  rzpMode = "success";

  const [mandate] = await db.select().from(subscriptionMandatesTable).where(eq(subscriptionMandatesTable.subscriptionId, seeded.subId));
  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, seeded.subId));
  assert.equal(mandate!.status, "active", "still below MAX_CONSECUTIVE_CHARGE_FAILURES — must stay active");
  assert.equal(mandate!.chargeFailureCount, 2);
  assert.equal(sub!.status, "active");

  // And it must still be genuinely retryable — nextChargeAt moved to the
  // future (the ~24h retry point), not stranded in the past.
  assert.ok(mandate!.nextChargeAt!.getTime() > Date.now(), "must still have a future retry point");
});

test(`the ${MAX_CONSECUTIVE_CHARGE_FAILURES}rd consecutive failure halts both the mandate and the subscription, pauses upcoming deliveries, and is excluded from the next sweep`, async () => {
  const seeded = await seedDueSubscription();
  rzpMode = "fail_charge";

  let last;
  for (let i = 0; i < MAX_CONSECUTIVE_CHARGE_FAILURES; i++) {
    if (i > 0) await rearmForNextAttempt(seeded.subId);
    last = await chargeMandateCore({ subscriptionId: seeded.subId, log: noopLog });
  }
  rzpMode = "success";

  assert.equal(last!.ok, false);
  assert.equal(last!.httpStatus, 502);
  assert.equal((last!.body as any).code, "subscription_halted", "the halting attempt's own outcome must say so");

  const [mandate] = await db.select().from(subscriptionMandatesTable).where(eq(subscriptionMandatesTable.subscriptionId, seeded.subId));
  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, seeded.subId));
  assert.equal(mandate!.status, "halted");
  assert.equal(mandate!.chargeFailureCount, MAX_CONSECUTIVE_CHARGE_FAILURES);
  assert.equal(sub!.status, "halted");

  // Upcoming deliveries must be paused — a halted subscription shouldn't
  // keep dispatching food nobody's paying for.
  const [delivery] = await db.select().from(subscriptionDeliveriesTable).where(eq(subscriptionDeliveriesTable.id, seeded.deliveryId));
  assert.equal(delivery!.status, "paused");

  // Re-arm nextChargeAt into the past (simulating time passing) and run the
  // sweep — the halted mandate must NOT be picked up, because both its own
  // status and its subscription's status are no longer "active".
  await db
    .update(subscriptionMandatesTable)
    .set({ nextChargeAt: new Date(Date.now() - 60 * 60 * 1000) })
    .where(eq(subscriptionMandatesTable.id, mandate!.id));
  const sweep = await runDueMandateChargesSweep({ now: new Date() });
  const wasConsidered = sweep.due > 0;
  // We can't assert sweep.due === 0 in isolation (other tests in this file
  // seed their own due mandates and node:test may interleave file-level
  // ordering with other files, though not within this file's own tests
  // since they run sequentially) — instead assert directly that THIS
  // mandate's nextChargeAt was untouched by the sweep (it would only be
  // touched if chargeMandateCore were invoked against it).
  const [mandateAfterSweep] = await db.select().from(subscriptionMandatesTable).where(eq(subscriptionMandatesTable.id, mandate!.id));
  assert.equal(
    mandateAfterSweep!.chargeFailureCount,
    MAX_CONSECUTIVE_CHARGE_FAILURES,
    "the halted mandate must not have been re-attempted by the sweep (failure count unchanged)",
  );
  assert.equal(mandateAfterSweep!.status, "halted", "must remain halted");
  void wasConsidered;
});

test("a successful charge in between resets the counter — only fully consecutive failures count toward the halt", async () => {
  const seeded = await seedDueSubscription();

  // 2 failures.
  rzpMode = "fail_charge";
  await chargeMandateCore({ subscriptionId: seeded.subId, log: noopLog });
  await rearmForNextAttempt(seeded.subId);
  await chargeMandateCore({ subscriptionId: seeded.subId, log: noopLog });

  let [mandate] = await db.select().from(subscriptionMandatesTable).where(eq(subscriptionMandatesTable.subscriptionId, seeded.subId));
  assert.equal(mandate!.chargeFailureCount, 2);

  // 1 success — must reset chargeFailureCount to 0 (confirmed in the
  // existing success path of chargeMandateCore, not something this test
  // introduces).
  rzpMode = "success";
  await rearmForNextAttempt(seeded.subId);
  const successResult = await chargeMandateCore({ subscriptionId: seeded.subId, log: noopLog });
  assert.equal(successResult.ok, true, JSON.stringify(successResult.body));
  CREATED_ORDER_IDS.push((successResult.body as any).orderId as number);

  [mandate] = await db.select().from(subscriptionMandatesTable).where(eq(subscriptionMandatesTable.subscriptionId, seeded.subId));
  assert.equal(mandate!.chargeFailureCount, 0, "a successful charge must reset the failure counter");
  assert.equal(mandate!.status, "active");

  // 2 more failures — total attempts across the test is 4 failures + 1
  // success interleaved, but only 2 are CONSECUTIVE since the success. Must
  // NOT reach MAX_CONSECUTIVE_CHARGE_FAILURES (3) and must NOT halt.
  rzpMode = "fail_charge";
  await rearmForNextAttempt(seeded.subId);
  await chargeMandateCore({ subscriptionId: seeded.subId, log: noopLog });
  await rearmForNextAttempt(seeded.subId);
  const lastResult = await chargeMandateCore({ subscriptionId: seeded.subId, log: noopLog });
  rzpMode = "success";

  assert.equal((lastResult.body as any).code, undefined, "2 consecutive failures since the last success must not halt");

  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, seeded.subId));
  [mandate] = await db.select().from(subscriptionMandatesTable).where(eq(subscriptionMandatesTable.subscriptionId, seeded.subId));
  assert.equal(mandate!.status, "active", "2 consecutive failures since the last success must not halt");
  assert.equal(mandate!.chargeFailureCount, 2);
  assert.equal(sub!.status, "active");
});

test("manually invoking chargeMandateCore against an already-halted subscription returns a distinct subscription_halted error", async () => {
  const seeded = await seedDueSubscription();
  // Force the halted state directly (bypassing the failure-loop — this test
  // only cares about the guard behavior once halted, not about getting
  // there).
  await db.update(subscriptionMandatesTable).set({ status: "halted" }).where(eq(subscriptionMandatesTable.subscriptionId, seeded.subId));
  await db.update(subscriptionsTable).set({ status: "halted" }).where(eq(subscriptionsTable.id, seeded.subId));

  const result = await chargeMandateCore({ subscriptionId: seeded.subId, log: noopLog });
  assert.equal(result.ok, false);
  assert.equal(result.httpStatus, 409);
  assert.equal((result.body as any).code, "subscription_halted");
});
