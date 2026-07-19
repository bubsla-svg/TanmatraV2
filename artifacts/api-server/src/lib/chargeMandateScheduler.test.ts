/**
 * Tests for the recurring-billing driver (money-path audit confirmed
 * finding #1: POST /payments/charge-mandate had zero callers, so cycle-2+
 * subscription billing never fired). Covers:
 *
 *   - runDueMandateChargesSweep finds mandates with status "active" whose
 *     nextChargeAt <= now, and skips not-yet-due / cancelled-mandate /
 *     non-active-subscription rows (#1, #3 of the driver's job list).
 *   - A successful charge (chargeMandateCore) persists a durable order/
 *     ledger row, advances nextChargeAt from the PREVIOUSLY SCHEDULED date
 *     plus cadence — not from wall-clock now (confirmed finding #4 drift
 *     fix) — and links/replenishes subscriptionDeliveriesTable state
 *     (confirmed finding #5).
 *   - A failed charge records the attempt (confirmed finding #6) and
 *     leaves nextChargeAt at a near-future retry point instead of
 *     stranding the mandate in the past forever ("one failed debit = free
 *     food forever").
 *
 * The Razorpay HTTP calls (POST /v1/orders, POST
 * /v1/payments/create/recurring) are intercepted by a global fetch shim
 * that only handles api.razorpay.com URLs and delegates everything else to
 * the real fetch — mirrors routes/refunds.test.ts.
 *
 * Run with:
 *   node --test --import tsx ./src/lib/chargeMandateScheduler.test.ts
 */

import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  usersTable,
  subscriptionsTable,
  subscriptionMandatesTable,
  subscriptionDeliveriesTable,
  preDebitNotificationsTable,
  ordersTable,
} from "@workspace/db";

import { chargeMandateCore } from "./chargeMandate";
import { runDueMandateChargesSweep } from "./chargeMandateScheduler";

process.env["RAZORPAY_KEY_ID"] = process.env["RAZORPAY_KEY_ID"] ?? "rzp_test_cm";
process.env["RAZORPAY_KEY_SECRET"] = process.env["RAZORPAY_KEY_SECRET"] ?? "secret_test_cm";

const RUN = randomUUID().slice(0, 8);

const noopLog = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

// ---------------------------------------------------------------------------
// Razorpay fetch shim
// ---------------------------------------------------------------------------
const realFetch = globalThis.fetch;
let rzpMode: "success" | "fail_order" | "fail_charge" = "success";
let rzpPaymentSeq = 0;

globalThis.fetch = (async (input: any, init?: any) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input?.url ?? String(input));

  if (url.includes("api.razorpay.com/v1/orders")) {
    if (rzpMode === "fail_order") {
      return { ok: false, status: 400, json: async () => ({ error: "order failed" }), text: async () => "order failed" } as unknown as Response;
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: `order_cm_test_${RUN}_${rzpPaymentSeq}`, amount: 0, currency: "INR" }),
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
      json: async () => ({ id: `pay_cm_test_${RUN}_${rzpPaymentSeq}`, status: "captured", amount: body.amount ?? 0 }),
      text: async () => "{}",
    } as unknown as Response;
  }

  return realFetch(input, init);
}) as typeof fetch;

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------
const CREATED_USER_IDS: string[] = [];
const CREATED_SUB_IDS: number[] = [];
const CREATED_ORDER_IDS: number[] = [];

interface Seeded {
  userId: string;
  subId: number;
  mandateId: number;
  deliveryId: number;
  pricePerDeliveryPaise: number;
}

async function seedBillableSubscription(opts: {
  nextChargeAt: Date;
  mandateStatus?: "active" | "cancelled";
  subStatus?: "active" | "paused" | "cancelled";
  withNotification?: boolean;
  withDelivery?: boolean;
}): Promise<Seeded> {
  const userId = randomUUID();
  await db.insert(usersTable).values({
    id: userId,
    email: `cm-${RUN}-${userId}@example.test`,
    firstName: "Charge",
    lastName: "Tester",
    phoneE164: null,
  });
  CREATED_USER_IDS.push(userId);

  const pricePerDeliveryPaise = 38000;
  const startDate = new Date(Date.now() - 30 * 24 * 3600 * 1000);

  const [sub] = await db
    .insert(subscriptionsTable)
    .values({
      userId,
      cadence: "weekly",
      mealsPerDelivery: 5,
      deliveryWindow: "12:00-14:00",
      status: opts.subStatus ?? "active",
      startDate,
      nextDeliveryAt: new Date(Date.now() + 2 * 24 * 3600 * 1000),
      pricePerDeliveryPaise,
    })
    .returning();
  CREATED_SUB_IDS.push(sub!.id);

  const [mandate] = await db
    .insert(subscriptionMandatesTable)
    .values({
      subscriptionId: sub!.id,
      razorpayCustomerId: `cust_cm_${RUN}`,
      razorpayTokenId: `tok_cm_${RUN}`,
      status: opts.mandateStatus ?? "active",
      nextChargeAt: opts.nextChargeAt,
    })
    .returning();

  let deliveryId = 0;
  if (opts.withDelivery !== false) {
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
    deliveryId = delivery!.id;
  }

  if (opts.withNotification !== false) {
    const startOfDay = new Date(opts.nextChargeAt);
    startOfDay.setUTCHours(12, 0, 0, 0);
    await db.insert(preDebitNotificationsTable).values({
      subscriptionId: sub!.id,
      scheduledChargeAt: startOfDay,
      status: "sent",
      dispatchedAt: new Date(Date.now() - 30 * 3600 * 1000), // 30h ago — well past the 24h floor
    });
  }

  return { userId, subId: sub!.id, mandateId: mandate!.id, deliveryId, pricePerDeliveryPaise };
}

after(async () => {
  globalThis.fetch = realFetch;
  // Belt-and-suspenders: delete every order row belonging to a test user,
  // not just the ones a test happened to record — a test bug that creates
  // an untracked order row must never leave an FK-orphaned row that fails
  // the user delete below.
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

// ---------------------------------------------------------------------------
// 1. Due-mandate identification
// ---------------------------------------------------------------------------

test("runDueMandateChargesSweep finds due mandates and skips not-due / cancelled-mandate / inactive-subscription rows", async () => {
  rzpMode = "success";
  const now = new Date();

  // Due: active mandate, active subscription, nextChargeAt in the past.
  const due = await seedBillableSubscription({
    nextChargeAt: new Date(now.getTime() - 60 * 60 * 1000),
    withNotification: false, // deliberately no notification — it should still be counted as "due" by the query, even though the actual charge attempt will fail the pre-debit gate
  });

  // Not due yet: nextChargeAt in the future.
  await seedBillableSubscription({
    nextChargeAt: new Date(now.getTime() + 48 * 60 * 60 * 1000),
    withNotification: false,
  });

  // Cancelled mandate: nextChargeAt in the past, but mandate status cancelled.
  await seedBillableSubscription({
    nextChargeAt: new Date(now.getTime() - 60 * 60 * 1000),
    mandateStatus: "cancelled",
    withNotification: false,
  });

  // Inactive subscription: mandate active, nextChargeAt in the past, but the
  // subscription itself is paused.
  await seedBillableSubscription({
    nextChargeAt: new Date(now.getTime() - 60 * 60 * 1000),
    subStatus: "paused",
    withNotification: false,
  });

  const result = await runDueMandateChargesSweep({ now });

  assert.equal(result.due, 1, `expected exactly 1 due mandate, got ${result.due}`);

  // The one due mandate was attempted (and failed the pre-debit gate since
  // withNotification: false), but it must have been genuinely considered —
  // not silently skipped.
  assert.equal(result.charged, 0);
  assert.equal(result.failed, 1);

  // The mandate's nextChargeAt must be untouched — the pre-debit-notification
  // gate short-circuits before the claim step ever runs.
  const [mandateRow] = await db
    .select()
    .from(subscriptionMandatesTable)
    .where(eq(subscriptionMandatesTable.subscriptionId, due.subId));
  assert.equal(mandateRow!.nextChargeAt!.getTime(), now.getTime() - 60 * 60 * 1000);
});

// ---------------------------------------------------------------------------
// 2. Successful charge: ledger persistence + drift-correct nextChargeAt +
//    delivery-state advancement
// ---------------------------------------------------------------------------

test("a successful charge persists an order/ledger row, advances nextChargeAt from the scheduled date (not wall clock), and links the upcoming delivery", async () => {
  rzpMode = "success";
  const now = new Date();
  // Scheduled 3 days in the past — a "late" charge. If nextChargeAt were
  // (incorrectly) advanced from wall-clock now, the new value would land
  // ~3 days later than advancing from the originally scheduled date.
  const previousNextChargeAt = new Date(now.getTime() - 3 * 24 * 3600 * 1000);

  const seeded = await seedBillableSubscription({ nextChargeAt: previousNextChargeAt });

  const result = await chargeMandateCore({ subscriptionId: seeded.subId, log: noopLog });
  assert.equal(result.ok, true, JSON.stringify(result.body));
  assert.equal(result.httpStatus, 200);
  const orderId = (result.body as any).orderId as number;
  assert.ok(orderId > 0, "response must carry the persisted order id");
  CREATED_ORDER_IDS.push(orderId);

  // Ledger row exists and is reconcilable.
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  assert.ok(order, "order row must be persisted");
  assert.equal(order!.status, "billed");
  assert.equal(order!.chargePaise, seeded.pricePerDeliveryPaise);
  assert.equal(order!.totalPaise, seeded.pricePerDeliveryPaise);
  assert.ok(order!.razorpayPaymentId, "razorpayPaymentId must be recorded");
  assert.ok(order!.razorpayOrderId, "razorpayOrderId must be recorded");
  // Deliberately not dispatch-eligible — see chargeMandate.ts's comment.
  assert.notEqual(order!.status, "placed");
  assert.notEqual(order!.status, "preparing");

  // nextChargeAt advanced from the PREVIOUSLY SCHEDULED date + 7 days
  // (weekly cadence) — not from wall-clock now.
  const [mandateRow] = await db
    .select()
    .from(subscriptionMandatesTable)
    .where(eq(subscriptionMandatesTable.subscriptionId, seeded.subId));
  const expectedNext = new Date(previousNextChargeAt.getTime() + 7 * 24 * 3600 * 1000);
  const actualNext = mandateRow!.nextChargeAt!;
  assert.ok(
    Math.abs(actualNext.getTime() - expectedNext.getTime()) < 60_000,
    `expected nextChargeAt ~${expectedNext.toISOString()}, got ${actualNext.toISOString()}`,
  );
  // And it must clearly differ from the buggy "now + 7 days" computation,
  // which would land ~3 days later than the correct value.
  const buggyNext = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
  assert.ok(
    Math.abs(actualNext.getTime() - buggyNext.getTime()) > 2 * 24 * 3600 * 1000,
    "nextChargeAt must not match the wall-clock-based (drift) computation",
  );

  assert.equal(mandateRow!.lastChargeStatus, "succeeded");
  assert.equal(mandateRow!.chargeFailureCount, 0);

  // The pre-seeded upcoming delivery must be linked to the new order.
  const [delivery] = await db
    .select()
    .from(subscriptionDeliveriesTable)
    .where(eq(subscriptionDeliveriesTable.id, seeded.deliveryId));
  assert.equal(delivery!.orderId, orderId, "the upcoming delivery must be linked to the ledger order");
});

test("when the upcoming-delivery pool is exhausted, a successful charge replenishes the next batch", async () => {
  rzpMode = "success";
  const now = new Date();
  const previousNextChargeAt = new Date(now.getTime() - 60 * 60 * 1000);

  const seeded = await seedBillableSubscription({
    nextChargeAt: previousNextChargeAt,
    withDelivery: false, // empty pool — nothing to link to
  });

  const before = await db
    .select()
    .from(subscriptionDeliveriesTable)
    .where(eq(subscriptionDeliveriesTable.subscriptionId, seeded.subId));
  assert.equal(before.length, 0);

  const result = await chargeMandateCore({ subscriptionId: seeded.subId, log: noopLog });
  assert.equal(result.ok, true, JSON.stringify(result.body));
  CREATED_ORDER_IDS.push((result.body as any).orderId as number);

  const after1 = await db
    .select()
    .from(subscriptionDeliveriesTable)
    .where(eq(subscriptionDeliveriesTable.subscriptionId, seeded.subId));
  assert.ok(after1.length > 0, "replenishment must generate new upcoming deliveries");
  const linked = after1.filter((d) => d.orderId === (result.body as any).orderId);
  assert.equal(linked.length, 1, "exactly one of the newly generated deliveries must be linked to the charge");
});

// ---------------------------------------------------------------------------
// 3. Failed charge: attempt persisted, mandate not stranded
// ---------------------------------------------------------------------------

test("a failed charge records the attempt and leaves nextChargeAt at a near-future retry point (not stranded in the past)", async () => {
  const now = new Date();
  const previousNextChargeAt = new Date(now.getTime() - 60 * 60 * 1000);
  const seeded = await seedBillableSubscription({ nextChargeAt: previousNextChargeAt });

  rzpMode = "fail_charge";
  const result = await chargeMandateCore({ subscriptionId: seeded.subId, log: noopLog });
  rzpMode = "success";

  assert.equal(result.ok, false);
  assert.equal(result.httpStatus, 502);

  const [mandateRow] = await db
    .select()
    .from(subscriptionMandatesTable)
    .where(eq(subscriptionMandatesTable.subscriptionId, seeded.subId));

  assert.equal(mandateRow!.lastChargeStatus, "failed");
  assert.equal(mandateRow!.chargeFailureCount, 1);
  assert.ok(mandateRow!.lastChargeError, "a failure reason must be recorded");

  // Critically: nextChargeAt must NOT still be stuck in the past (that is
  // the "one failed debit = free food forever" bug — a mandate whose
  // nextChargeAt stays behind `now` forever never re-enters the hourly
  // pre-debit sweep's [now+24h, now+25h) lookahead window).
  const nextChargeAt = mandateRow!.nextChargeAt!;
  assert.ok(nextChargeAt.getTime() > now.getTime(), "nextChargeAt must move to the future on failure");
  const hoursOut = (nextChargeAt.getTime() - now.getTime()) / 3600000;
  assert.ok(hoursOut >= 23 && hoursOut <= 25, `expected a ~24h retry point, got ${hoursOut}h out`);

  // No order/ledger row should have been created for a failed charge.
  const orders = await db
    .select()
    .from(ordersTable)
    .where(
      and(
        eq(ordersTable.userId, seeded.userId),
      ),
    );
  assert.equal(orders.length, 0, "a failed charge must not create a ledger row");
});

test("two concurrent calls for the same due cycle never both charge the customer", async () => {
  rzpMode = "success";
  const now = new Date();
  const previousNextChargeAt = new Date(now.getTime() - 60 * 60 * 1000);
  const seeded = await seedBillableSubscription({ nextChargeAt: previousNextChargeAt });

  const [first, second] = await Promise.all([
    chargeMandateCore({ subscriptionId: seeded.subId, log: noopLog }),
    chargeMandateCore({ subscriptionId: seeded.subId, log: noopLog }),
  ]);

  const results = [first, second];
  const succeeded = results.filter((r) => r.ok);
  // The loser may see either "charge_claim_conflict" (both read the mandate
  // before either claimed it) or "not_due" (it read AFTER the winner's claim
  // already moved nextChargeAt into the future) depending on exactly how the
  // two calls interleave — either is an acceptable, safe outcome. What must
  // NEVER happen is both calls succeeding (a double charge).
  assert.equal(succeeded.length, 1, "exactly one of the two concurrent calls must succeed — never zero, never both");

  // Regardless of which one won, only a single ledger row may exist for
  // this subscription's user afterward.
  const orders = await db.select().from(ordersTable).where(eq(ordersTable.userId, seeded.userId));
  assert.equal(orders.length, 1, "only one order/ledger row may be created across both concurrent attempts");
  for (const o of orders) CREATED_ORDER_IDS.push(o.id);
});
