/**
 * Integration tests for the subscription-abandonment sweep.
 *
 * `POST /subscriptions` activates a subscription and generates its full
 * delivery schedule before any payment happens. The only rollback today is
 * client-side and fragile (tab close / lost network / gateway-"unavailable"
 * all leave it dangling). This sweep is the server-side backstop: it cancels
 * subscriptions that are unambiguously zombies — `active`, no
 * `subscription_mandates` row at all, and past the grace window — the same
 * way the customer-facing cancel route does (status flip + deliveries
 * cancelled + autopay mandate revoked), so nothing is left half-cancelled.
 *
 *   (a) an active weekly/fortnightly subscription with no mandate, created
 *       well past the grace window, gets cancelled (subscription + its
 *       upcoming deliveries).
 *   (b) one created within the grace window is left untouched — a slow but
 *       legitimate checkout must not be falsely killed.
 *   (c) one with a mandate row (even old, even after being itself later
 *       cancelled) is left untouched regardless of age — the mandate row's
 *       mere existence proves a payment attempt happened, which is the only
 *       thing this sweep is allowed to use as a "not a zombie" signal.
 *   (d) a `monthly`-cadence subscription is never swept, even past the grace
 *       window with no mandate — monthly plans are one-time prepaid charges
 *       that never register a mandate even when fully paid (see
 *       ../routes/payments.ts's `isRecurring` gate), so "no mandate" is not
 *       an unambiguous zombie signal for them.
 *
 * Run with:
 *   node --test --import tsx ./src/lib/subscriptionAbandonmentScheduler.test.ts
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
  type SubscriptionCadence,
} from "@workspace/db";

import { runSubscriptionAbandonmentSweep } from "./subscriptionAbandonmentScheduler";

const CREATED_USER_IDS: string[] = [];
const CREATED_SUB_IDS: number[] = [];

const GRACE_MS = 2 * 60 * 60 * 1000; // 2 hours, matches the module default.

async function makeUser(): Promise<string> {
  const id = randomUUID();
  await db
    .insert(usersTable)
    .values({ id, email: `sub-abandon-${id}@example.test`, firstName: "Abandon", lastName: "Tester" });
  CREATED_USER_IDS.push(id);
  return id;
}

async function seedSubscription(opts: {
  userId: string;
  cadence: SubscriptionCadence;
  createdAt: Date;
  status?: "active" | "paused" | "cancelled";
}): Promise<number> {
  const startDate = new Date(Date.now() + 2 * 24 * 3600 * 1000);
  const [sub] = await db
    .insert(subscriptionsTable)
    .values({
      userId: opts.userId,
      cadence: opts.cadence,
      mealsPerDelivery: 5,
      deliveryWindow: "12:00-14:00",
      status: opts.status ?? "active",
      startDate,
      nextDeliveryAt: startDate,
      pricePerDeliveryPaise: 380000,
      createdAt: opts.createdAt,
      updatedAt: opts.createdAt,
    })
    .returning();
  CREATED_SUB_IDS.push(sub.id);
  await db.insert(subscriptionDeliveriesTable).values({
    subscriptionId: sub.id,
    scheduledFor: startDate,
    deliveryWindow: "12:00-14:00",
    status: "upcoming",
    items: [],
  });
  return sub.id;
}

async function seedMandate(subId: number, status: "active" | "cancelled") {
  await db.insert(subscriptionMandatesTable).values({
    subscriptionId: subId,
    razorpayCustomerId: "cust_test",
    razorpayTokenId: "tok_test",
    status,
    nextChargeAt: status === "active" ? new Date(Date.now() + 24 * 3600 * 1000) : null,
  });
}

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 3600 * 1000);
}

test("(a) active, no mandate, past grace window -> cancelled with deliveries cancelled", async () => {
  const userId = await makeUser();
  const subId = await seedSubscription({ userId, cadence: "weekly", createdAt: hoursAgo(3) });

  const result = await runSubscriptionAbandonmentSweep(GRACE_MS);
  assert.ok(result.cancelled.includes(subId), `expected ${subId} in cancelled list: ${JSON.stringify(result)}`);

  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, subId));
  assert.equal(sub!.status, "cancelled");

  const deliveries = await db
    .select()
    .from(subscriptionDeliveriesTable)
    .where(eq(subscriptionDeliveriesTable.subscriptionId, subId));
  assert.ok(deliveries.length > 0);
  for (const d of deliveries) assert.equal(d.status, "cancelled");
});

test("(b) active, no mandate, WITHIN grace window -> left alone", async () => {
  const userId = await makeUser();
  const subId = await seedSubscription({ userId, cadence: "weekly", createdAt: hoursAgo(0.1) });

  const result = await runSubscriptionAbandonmentSweep(GRACE_MS);
  assert.ok(!result.cancelled.includes(subId), `did not expect ${subId} to be swept: ${JSON.stringify(result)}`);

  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, subId));
  assert.equal(sub!.status, "active");
});

test("(c) active, HAS a mandate row, past grace window -> left alone regardless of age", async () => {
  const userId = await makeUser();
  const subId = await seedSubscription({ userId, cadence: "weekly", createdAt: hoursAgo(48) });
  // Even a cancelled mandate proves a payment attempt happened — the sweep
  // must never treat this subscription as an unpaid zombie.
  await seedMandate(subId, "cancelled");

  const result = await runSubscriptionAbandonmentSweep(GRACE_MS);
  assert.ok(!result.cancelled.includes(subId), `did not expect ${subId} to be swept: ${JSON.stringify(result)}`);

  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, subId));
  assert.equal(sub!.status, "active");
});

test("(d) monthly cadence is never swept, even with no mandate past the grace window", async () => {
  const userId = await makeUser();
  const subId = await seedSubscription({ userId, cadence: "monthly", createdAt: hoursAgo(48) });

  const result = await runSubscriptionAbandonmentSweep(GRACE_MS);
  assert.ok(!result.cancelled.includes(subId), `monthly subscriptions must never be swept: ${JSON.stringify(result)}`);

  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, subId));
  assert.equal(sub!.status, "active");
});

after(async () => {
  if (CREATED_SUB_IDS.length > 0) {
    await db.delete(subscriptionMandatesTable).where(inArray(subscriptionMandatesTable.subscriptionId, CREATED_SUB_IDS));
    await db.delete(subscriptionDeliveriesTable).where(inArray(subscriptionDeliveriesTable.subscriptionId, CREATED_SUB_IDS));
    await db.delete(subscriptionsTable).where(inArray(subscriptionsTable.id, CREATED_SUB_IDS));
  }
  if (CREATED_USER_IDS.length > 0) {
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
});
