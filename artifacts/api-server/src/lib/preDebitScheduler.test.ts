/**
 * Regression test for the pre-debit sweep coverage bug (money-path audit
 * confirmed finding #3):
 *
 *   The sweep used to run ONCE daily at a fixed hour (10:00 IST) with a 2h
 *   lookahead window ([now+24h, now+26h]). Only mandates whose nextChargeAt
 *   TIME-OF-DAY happened to fall inside that one daily slice ever got a
 *   pre-debit notice — every other time-of-day never entered the window on
 *   any run, forever, so /payments/charge-mandate then permanently 400s
 *   those mandates ("pre-debit notification not found").
 *
 *   The fix narrows the window to 1h (matching the now-hourly run cadence
 *   in preDebitScheduler.ts) so 24 consecutive ticks cover the full day.
 *   This test proves that invariant directly: a mandate due at an
 *   arbitrary, deliberately "off" time of day (03:17 IST — nowhere near the
 *   old fixed slice) gets exactly one notification across a simulated day
 *   of hourly ticks.
 *
 * Run with:
 *   node --test --import tsx ./src/lib/preDebitScheduler.test.ts
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
  preDebitNotificationsTable,
} from "@workspace/db";

import { runPreDebitNotificationsSweep } from "./preDebitScheduler";

const RUN = randomUUID().slice(0, 8);
const CREATED_USER_IDS: string[] = [];
const CREATED_SUB_IDS: number[] = [];

async function seedSubscriptionWithMandate(nextChargeAt: Date): Promise<number> {
  const userId = randomUUID();
  await db.insert(usersTable).values({
    id: userId,
    email: `predebit-${RUN}-${userId}@example.test`,
    firstName: "PreDebit",
    lastName: "Tester",
  });
  CREATED_USER_IDS.push(userId);

  const [sub] = await db
    .insert(subscriptionsTable)
    .values({
      userId,
      cadence: "weekly",
      mealsPerDelivery: 5,
      deliveryWindow: "12:00-14:00",
      status: "active",
      startDate: new Date(Date.now() - 7 * 24 * 3600 * 1000),
      nextDeliveryAt: new Date(Date.now() + 24 * 3600 * 1000),
      pricePerDeliveryPaise: 38000,
    })
    .returning();
  CREATED_SUB_IDS.push(sub!.id);

  await db.insert(subscriptionMandatesTable).values({
    subscriptionId: sub!.id,
    razorpayCustomerId: "cust_predebit_test",
    razorpayTokenId: "tok_predebit_test",
    status: "active",
    nextChargeAt,
  });

  return sub!.id;
}

after(async () => {
  if (CREATED_SUB_IDS.length > 0) {
    await db.delete(preDebitNotificationsTable).where(inArray(preDebitNotificationsTable.subscriptionId, CREATED_SUB_IDS));
    await db.delete(subscriptionMandatesTable).where(inArray(subscriptionMandatesTable.subscriptionId, CREATED_SUB_IDS));
    await db.delete(subscriptionsTable).where(inArray(subscriptionsTable.id, CREATED_SUB_IDS));
  }
  if (CREATED_USER_IDS.length > 0) {
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
});

test("hourly rolling window: a mandate due at an odd time-of-day (outside the old 10:00-12:00 IST slice) is notified", async () => {
  // 03:17 IST tomorrow — nowhere near the old fixed daily slice.
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const base = new Date();
  base.setUTCHours(0, 0, 0, 0);
  const nextChargeAt = new Date(
    base.getTime() + 24 * 3600 * 1000 + (3 * 60 + 17) * 60 * 1000 - IST_OFFSET_MS,
  ); // tomorrow 03:17 IST, expressed as the equivalent UTC instant

  const subId = await seedSubscriptionWithMandate(nextChargeAt);

  // Simulate a full day of hourly ticks, starting well before the mandate
  // enters the 24-25h lookahead window, and confirm exactly one tick
  // creates the notification — proving every time-of-day is reachable, not
  // just the old fixed 10:00-12:00 IST slice.
  let matches = 0;
  const tickStart = new Date(nextChargeAt.getTime() - 30 * 3600 * 1000); // 30h before due
  for (let hour = 0; hour < 30; hour++) {
    const tickNow = new Date(tickStart.getTime() + hour * 3600 * 1000);
    const result = await runPreDebitNotificationsSweep({ now: tickNow });
    const [notif] = await db
      .select()
      .from(preDebitNotificationsTable)
      .where(eq(preDebitNotificationsTable.subscriptionId, subId));
    if (notif && matches === 0) {
      matches = 1;
      // The window that caught it should be within [now+24h, now+25h) of
      // this exact tick — i.e. roughly 24-25h of notice, never less.
      const noticeHours = (nextChargeAt.getTime() - tickNow.getTime()) / 3600000;
      assert.ok(
        noticeHours >= 24 && noticeHours < 26,
        `expected 24-26h notice window, got ${noticeHours}h`,
      );
    }
    void result;
  }

  assert.equal(matches, 1, "the odd-time-of-day mandate must be caught by exactly one hourly tick across the day");

  const notices = await db
    .select()
    .from(preDebitNotificationsTable)
    .where(eq(preDebitNotificationsTable.subscriptionId, subId));
  assert.equal(notices.length, 1, "exactly one pre-debit notification row must exist");
});

test("window width is 1h wide ([+24h, +25h)) — a mandate 1h30m past the window start is NOT yet caught", async () => {
  const now = new Date();
  // 25h30m out — outside [now+24h, now+25h).
  const nextChargeAt = new Date(now.getTime() + 25.5 * 3600 * 1000);
  const subId = await seedSubscriptionWithMandate(nextChargeAt);

  await runPreDebitNotificationsSweep({ now });

  const notices = await db
    .select()
    .from(preDebitNotificationsTable)
    .where(eq(preDebitNotificationsTable.subscriptionId, subId));
  assert.equal(notices.length, 0, "a mandate outside the current 1h window must not be notified yet");
});
