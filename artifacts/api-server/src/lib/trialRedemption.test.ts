/**
 * Integration tests for the 3-Day Taste Test creditback (S5b) against a real
 * Postgres. These lock in the money-path invariants the resolution doc requires
 * — they cannot run on an in-memory shim because the enforcement IS the
 * `trial_redemptions.phone_hash` UNIQUE constraint under real concurrency.
 *
 *   (a) One-per-phone under concurrency: N simultaneous paid-trial grants for
 *       one phone → exactly ONE ledger row and exactly ONE ₹399 credit lot; the
 *       losers get a typed `already_redeemed` and grant nothing.
 *   (b) Credit lifecycle: grant → balance ₹399 → single redemption → balance 0
 *       → second redemption rejected (insufficient); a lot past its 7-day expiry
 *       does not count toward balance and cannot be redeemed.
 *   (c) Amounts are paise from the server quote path: the granted lot equals
 *       TRIAL_CREDIT_PAISE and nets a plan's cycle total exactly.
 *
 * Run with a real Postgres pointed at by DATABASE_URL, e.g.:
 *   DATABASE_URL=postgres://postgres@localhost:55433/money_test NODE_ENV=test \
 *   GOOGLE_API_KEY=test CLINICAL_KMS_MASTER_KEY=<64 hex> \
 *   node --test --import tsx ./src/lib/trialRedemption.test.ts
 */

import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  usersTable,
  trialRedemptionsTable,
  creditLedgerTable,
} from "@workspace/db";
import {
  TRIAL_CREDIT_PAISE,
  applyTrialCreditPaise,
  trialCreditExpiry,
  computePlanQuote,
} from "@workspace/subscription-rules";

import {
  hasRedeemedTrialPhone,
  recordAndGrantTrialCredit,
} from "./trialRedemption";
import { hashTrialPhone } from "./trialEligibility";
import { getCreditBalancePaise, redeemCreditAtomic } from "./loyaltyEngine";

// Unique per-run suffix so phones/users never collide with a concurrent run.
const RUN = randomUUID().slice(0, 8);
const createdUserIds: string[] = [];

// A distinct 10-digit-ish phone per test — hashed, so the raw value only needs
// to be unique and normalizable (>= 8 digits).
let phoneSeq = 0;
function freshPhone(): string {
  phoneSeq += 1;
  // 98 + 8 digits derived from RUN + seq → always 10 digits, always unique.
  const tail = (parseInt(RUN.slice(0, 6), 16) + phoneSeq)
    .toString()
    .padStart(8, "0")
    .slice(-8);
  return `98${tail}`;
}

async function seedUser(): Promise<string> {
  const [u] = await db
    .insert(usersTable)
    .values({ phoneE164: `+91${freshPhone()}-${RUN}-${phoneSeq}` })
    .returning({ id: usersTable.id });
  assert.ok(u);
  createdUserIds.push(u.id);
  return u.id;
}

after(async () => {
  if (createdUserIds.length === 0) return;
  // credit_ledger + trial_redemptions FK to users; delete children then users.
  await db
    .delete(creditLedgerTable)
    .where(inArray(creditLedgerTable.userId, createdUserIds));
  await db
    .delete(trialRedemptionsTable)
    .where(inArray(trialRedemptionsTable.userId, createdUserIds));
  await db.delete(usersTable).where(inArray(usersTable.id, createdUserIds));
});

// ── (a) one-per-phone under concurrency ─────────────────────────────────────
test("concurrent paid-trial grants for one phone → exactly one row, one grant", async () => {
  const userId = await seedUser();
  const phone = freshPhone();
  const phoneHash = hashTrialPhone(phone);
  assert.ok(phoneHash, "phone must hash to a non-empty value");

  const trialEndsAt = new Date();

  // 8 racers, each its own transaction — the UNIQUE index is the referee.
  const CONCURRENCY = 8;
  const results = await Promise.all(
    Array.from({ length: CONCURRENCY }, () =>
      db.transaction((tx) =>
        recordAndGrantTrialCredit(tx, {
          userId,
          phoneHash,
          subscriptionId: 1,
          trialEndsAt,
        }),
      ),
    ),
  );

  const granted = results.filter((r) => r.granted).length;
  assert.equal(granted, 1, "exactly one racer should grant the credit");
  for (const r of results) {
    if (!r.granted) assert.equal(r.reason, "already_redeemed");
  }

  // Exactly one ledger row for the phone.
  const rows = await db
    .select({ id: trialRedemptionsTable.id })
    .from(trialRedemptionsTable)
    .where(eq(trialRedemptionsTable.phoneHash, phoneHash));
  assert.equal(rows.length, 1, "exactly one trial_redemptions row");

  // Exactly one credit lot, for the full ₹399.
  const lots = await db
    .select({
      deltaPaise: creditLedgerTable.deltaPaise,
      reason: creditLedgerTable.reason,
    })
    .from(creditLedgerTable)
    .where(
      and(
        eq(creditLedgerTable.userId, userId),
        eq(creditLedgerTable.reason, "trial_creditback"),
      ),
    );
  assert.equal(lots.length, 1, "exactly one trial_creditback lot");
  assert.equal(lots[0]?.deltaPaise, TRIAL_CREDIT_PAISE);

  // And the balance is exactly the one grant.
  assert.equal(await getCreditBalancePaise(userId), TRIAL_CREDIT_PAISE);
});

// ── one-per-phone across separate accounts (durable ledger survives) ─────────
test("second account on the same phone cannot grant a second creditback", async () => {
  const first = await seedUser();
  const second = await seedUser();
  const phone = freshPhone();
  const phoneHash = hashTrialPhone(phone);
  const trialEndsAt = new Date();

  const r1 = await db.transaction((tx) =>
    recordAndGrantTrialCredit(tx, {
      userId: first,
      phoneHash,
      subscriptionId: 10,
      trialEndsAt,
    }),
  );
  assert.deepEqual(r1, { granted: true });

  // Same phone, different account (e.g. deleted + re-registered): rejected.
  const r2 = await db.transaction((tx) =>
    recordAndGrantTrialCredit(tx, {
      userId: second,
      phoneHash,
      subscriptionId: 11,
      trialEndsAt,
    }),
  );
  assert.deepEqual(r2, { granted: false, reason: "already_redeemed" });

  assert.equal(await getCreditBalancePaise(second), 0);
  assert.equal(await getCreditBalancePaise(first), TRIAL_CREDIT_PAISE);
});

// ── hasRedeemedTrialPhone reflects the ledger ────────────────────────────────
test("hasRedeemedTrialPhone is false before and true after a paid trial", async () => {
  const userId = await seedUser();
  const phone = freshPhone();
  const phoneHash = hashTrialPhone(phone);

  assert.equal(await hasRedeemedTrialPhone(phoneHash), false);

  await db.transaction((tx) =>
    recordAndGrantTrialCredit(tx, {
      userId,
      phoneHash,
      subscriptionId: 20,
      trialEndsAt: new Date(),
    }),
  );

  assert.equal(await hasRedeemedTrialPhone(phoneHash), true);
  // An unidentifiable phone never gates.
  assert.equal(await hasRedeemedTrialPhone(""), false);
});

// ── (b) credit lifecycle: grant → single redemption → second rejected ────────
test("granted creditback redeems once, then is insufficient", async () => {
  const userId = await seedUser();
  const phoneHash = hashTrialPhone(freshPhone());

  await db.transaction((tx) =>
    recordAndGrantTrialCredit(tx, {
      userId,
      phoneHash,
      subscriptionId: 30,
      trialEndsAt: new Date(),
    }),
  );
  assert.equal(await getCreditBalancePaise(userId), TRIAL_CREDIT_PAISE);

  const first = await redeemCreditAtomic({
    userId,
    paise: TRIAL_CREDIT_PAISE,
    refId: "plan-start-30",
  });
  assert.equal(first.ok, true);
  assert.equal(await getCreditBalancePaise(userId), 0);

  const second = await redeemCreditAtomic({
    userId,
    paise: 1,
    refId: "plan-start-30-again",
  });
  assert.equal(second.ok, false);
  if (!second.ok) assert.equal(second.reason, "insufficient");
});

// ── (b') expiry: a lot past its 7-day window does not count / cannot redeem ──
test("a creditback past its 7-day expiry is not spendable", async () => {
  const userId = await seedUser();
  const phoneHash = hashTrialPhone(freshPhone());

  // Trial ended 8 days ago → expiry (trialEnd + 7d) is 1 day in the past.
  const trialEndsAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
  assert.ok(
    trialCreditExpiry(trialEndsAt).getTime() < Date.now(),
    "sanity: computed expiry must be in the past",
  );

  const res = await db.transaction((tx) =>
    recordAndGrantTrialCredit(tx, {
      userId,
      phoneHash,
      subscriptionId: 40,
      trialEndsAt,
    }),
  );
  assert.deepEqual(res, { granted: true }); // the lot IS written…

  // …but it is already expired, so it contributes nothing to balance.
  assert.equal(await getCreditBalancePaise(userId), 0);

  const redeem = await redeemCreditAtomic({ userId, paise: 1 });
  assert.equal(redeem.ok, false);
});

// ── still-valid boundary: a lot expiring in the future IS spendable ──────────
test("a creditback within its 7-day window is spendable", async () => {
  const userId = await seedUser();
  const phoneHash = hashTrialPhone(freshPhone());

  // Trial ends today → expiry ~7 days out, comfortably valid.
  const res = await db.transaction((tx) =>
    recordAndGrantTrialCredit(tx, {
      userId,
      phoneHash,
      subscriptionId: 50,
      trialEndsAt: new Date(),
    }),
  );
  assert.deepEqual(res, { granted: true });
  assert.equal(await getCreditBalancePaise(userId), TRIAL_CREDIT_PAISE);
});

// ── no_phone: an unidentifiable number writes nothing and grants nothing ─────
test("an unhashable phone grants no credit and writes no row", async () => {
  const userId = await seedUser();
  const res = await db.transaction((tx) =>
    recordAndGrantTrialCredit(tx, {
      userId,
      phoneHash: "",
      subscriptionId: 60,
      trialEndsAt: new Date(),
    }),
  );
  assert.deepEqual(res, { granted: false, reason: "no_phone" });
  assert.equal(await getCreditBalancePaise(userId), 0);
});

// ── (c) amounts are paise from the server quote path ─────────────────────────
test("the creditback nets a plan's server-quoted cycle total exactly", async () => {
  // desk_fuel monthly is a launchable per-meal plan; its cycle total comes
  // from the same spine the create route bills from.
  const quote = computePlanQuote("desk_fuel");
  const charged = applyTrialCreditPaise(quote.cycleTotalPaise);
  assert.equal(charged, quote.cycleTotalPaise - TRIAL_CREDIT_PAISE);
  // The credit never over-applies: a plan cheaper than the credit clamps to 0.
  assert.equal(applyTrialCreditPaise(TRIAL_CREDIT_PAISE - 100), 0);

  // And the granted lot's delta is exactly that credit — no drift between the
  // grant and the quote math.
  const userId = await seedUser();
  const phoneHash = hashTrialPhone(freshPhone());
  await db.transaction((tx) =>
    recordAndGrantTrialCredit(tx, {
      userId,
      phoneHash,
      subscriptionId: 70,
      trialEndsAt: new Date(),
    }),
  );
  const [lot] = await db
    .select({ deltaPaise: creditLedgerTable.deltaPaise })
    .from(creditLedgerTable)
    .where(
      and(
        eq(creditLedgerTable.userId, userId),
        eq(creditLedgerTable.reason, "trial_creditback"),
      ),
    );
  assert.equal(lot?.deltaPaise, TRIAL_CREDIT_PAISE);
});
