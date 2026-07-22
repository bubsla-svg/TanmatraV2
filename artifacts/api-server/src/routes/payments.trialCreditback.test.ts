/**
 * Integration tests for the trial-PAID creditback seam (S5b) — the
 * `maybeGrantTrialCreditback` hook that `registerAutopayMandate` calls in the
 * live-trial branch (payments.ts). These prove the SEAM, not the service math
 * (that lives in trialRedemption.test.ts):
 *
 *   - flag OFF ⇒ no grant, no ledger row (the whole feature stays dark).
 *   - flag ON + a non-plan-v2 trial (legacy RD-plan note) ⇒ no grant.
 *   - flag ON + a plan-v2 trial ⇒ grants ₹399, expiry = last delivery + 7 days.
 *   - a second call for the same paid trial (verify then webhook) is idempotent
 *     — one row, one lot.
 *
 * Run with a real Postgres pointed at by DATABASE_URL, e.g.:
 *   DATABASE_URL=postgres://postgres@localhost:55433/money_test NODE_ENV=test \
 *   GOOGLE_API_KEY=test CLINICAL_KMS_MASTER_KEY=<64 hex> \
 *   node --test --import tsx ./src/routes/payments.trialCreditback.test.ts
 */

import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  usersTable,
  subscriptionsTable,
  subscriptionDeliveriesTable,
  trialRedemptionsTable,
  creditLedgerTable,
} from "@workspace/db";
import {
  TRIAL_CREDIT_PAISE,
  trialCreditExpiry,
} from "@workspace/subscription-rules";

import { maybeGrantTrialCreditback } from "./payments";
import { hashTrialPhone } from "../lib/trialEligibility";
import { getCreditBalancePaise } from "../lib/loyaltyEngine";

const RUN = randomUUID().slice(0, 8);
const createdUserIds: string[] = [];
const createdSubIds: number[] = [];

// A silent log stub matching what registerAutopayMandate passes (req.log).
const log = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

let phoneSeq = 0;
function freshPhone(): string {
  phoneSeq += 1;
  const tail = (parseInt(RUN.slice(0, 6), 16) + phoneSeq * 7)
    .toString()
    .padStart(8, "0")
    .slice(-8);
  return `97${tail}`;
}

async function seedUser(): Promise<string> {
  const [u] = await db
    .insert(usersTable)
    .values({ phoneE164: `+91-cb-${RUN}-${phoneSeq}-${freshPhone()}` })
    .returning({ id: usersTable.id });
  assert.ok(u);
  createdUserIds.push(u.id);
  return u.id;
}

/**
 * Seed a live trial subscription with two deliveries and return the shape the
 * seam consumes plus the last delivery date (for expiry assertions).
 */
async function seedTrialSub(opts: {
  userId: string;
  phone: string;
  notes: string | null;
}): Promise<{
  subscriptionId: number;
  userId: string;
  notes: string | null;
  phone: string;
  lastDeliveryAt: Date;
}> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const day2 = new Date(start.getTime() + 2 * 24 * 60 * 60 * 1000);
  const [sub] = await db
    .insert(subscriptionsTable)
    .values({
      userId: opts.userId,
      cadence: "weekly",
      mealsPerDelivery: 3,
      deliveryWindow: "12:00-13:00",
      startDate: start,
      nextDeliveryAt: start,
      phone: opts.phone,
      notes: opts.notes,
      trialState: "trial_purchased",
    })
    .returning({ id: subscriptionsTable.id });
  assert.ok(sub);
  createdSubIds.push(sub.id);

  await db.insert(subscriptionDeliveriesTable).values([
    {
      subscriptionId: sub.id,
      scheduledFor: start,
      deliveryWindow: "12:00-13:00",
    },
    {
      subscriptionId: sub.id,
      scheduledFor: day2,
      deliveryWindow: "12:00-13:00",
    },
  ]);

  return {
    subscriptionId: sub.id,
    userId: opts.userId,
    notes: opts.notes,
    phone: opts.phone,
    lastDeliveryAt: day2,
  };
}

after(async () => {
  process.env["FLAG_PLAN_V2"] = "";
  if (createdSubIds.length > 0) {
    await db
      .delete(subscriptionDeliveriesTable)
      .where(inArray(subscriptionDeliveriesTable.subscriptionId, createdSubIds));
    await db
      .delete(subscriptionsTable)
      .where(inArray(subscriptionsTable.id, createdSubIds));
  }
  if (createdUserIds.length > 0) {
    await db
      .delete(creditLedgerTable)
      .where(inArray(creditLedgerTable.userId, createdUserIds));
    await db
      .delete(trialRedemptionsTable)
      .where(inArray(trialRedemptionsTable.userId, createdUserIds));
    await db.delete(usersTable).where(inArray(usersTable.id, createdUserIds));
  }
});

async function creditbackLots(userId: string) {
  return db
    .select({
      deltaPaise: creditLedgerTable.deltaPaise,
      expiresAt: creditLedgerTable.expiresAt,
    })
    .from(creditLedgerTable)
    .where(
      and(
        eq(creditLedgerTable.userId, userId),
        eq(creditLedgerTable.reason, "trial_creditback"),
      ),
    );
}

test("flag OFF: a paid plan-v2 trial grants nothing", async () => {
  process.env["FLAG_PLAN_V2"] = "";
  const userId = await seedUser();
  const sub = await seedTrialSub({
    userId,
    phone: freshPhone(),
    notes: "plan_v2:trial_3day",
  });

  await maybeGrantTrialCreditback(sub, log);

  assert.equal((await creditbackLots(userId)).length, 0);
  assert.equal(await getCreditBalancePaise(userId), 0);
});

test("flag ON but a legacy (non-plan-v2) trial grants nothing", async () => {
  process.env["FLAG_PLAN_V2"] = "true";
  const userId = await seedUser();
  const sub = await seedTrialSub({
    userId,
    phone: freshPhone(),
    notes: "3-Day Taste Test", // legacy RD-plan trial note, not the plan-v2 tag
  });

  await maybeGrantTrialCreditback(sub, log);

  assert.equal((await creditbackLots(userId)).length, 0);
});

test("flag ON + plan-v2 trial: grants ₹399 expiring last-delivery + 7 days", async () => {
  process.env["FLAG_PLAN_V2"] = "true";
  const userId = await seedUser();
  const phone = freshPhone();
  const sub = await seedTrialSub({
    userId,
    phone,
    notes: "plan_v2:trial_3day",
  });

  await maybeGrantTrialCreditback(sub, log);

  const lots = await creditbackLots(userId);
  assert.equal(lots.length, 1, "exactly one creditback lot");
  assert.equal(lots[0]?.deltaPaise, TRIAL_CREDIT_PAISE);

  // Expiry is derived from the LAST scheduled delivery, not "now".
  const expected = trialCreditExpiry(sub.lastDeliveryAt);
  assert.equal(lots[0]?.expiresAt?.getTime(), expected.getTime());

  // The durable one-per-phone row exists, keyed by the hashed phone.
  const [row] = await db
    .select({ id: trialRedemptionsTable.id })
    .from(trialRedemptionsTable)
    .where(eq(trialRedemptionsTable.phoneHash, hashTrialPhone(phone)));
  assert.ok(row, "trial_redemptions row written");
});

test("idempotent across verify + webhook: two calls grant exactly once", async () => {
  process.env["FLAG_PLAN_V2"] = "true";
  const userId = await seedUser();
  const sub = await seedTrialSub({
    userId,
    phone: freshPhone(),
    notes: "plan_v2:trial_3day",
  });

  await maybeGrantTrialCreditback(sub, log); // verify path
  await maybeGrantTrialCreditback(sub, log); // webhook path

  const lots = await creditbackLots(userId);
  assert.equal(lots.length, 1, "second confirmation must not double-grant");
  assert.equal(await getCreditBalancePaise(userId), TRIAL_CREDIT_PAISE);
});

test("plan-v2 trial with an unidentifiable phone grants nothing", async () => {
  process.env["FLAG_PLAN_V2"] = "true";
  const userId = await seedUser();
  // Seed with a valid phone so the row is created, then null the shape's phone
  // to simulate a subscription with no usable identity at the seam.
  const sub = await seedTrialSub({
    userId,
    phone: freshPhone(),
    notes: "plan_v2:trial_3day",
  });

  await maybeGrantTrialCreditback({ ...sub, phone: null }, log);

  assert.equal((await creditbackLots(userId)).length, 0);
});
