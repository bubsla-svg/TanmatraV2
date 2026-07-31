/**
 * OA-MED-1.17 — redeemCreditAtomic derives its post-redemption balance
 * arithmetically (`balance - paise`) instead of rebuilding the entire FIFO
 * lot ledger a second time.
 *
 * The derivation is only sound because the transaction holds the credit
 * advisory lock and nothing issues credit between the two points. That is a
 * claim about the FIFO/expiry semantics in computeRemainingLots, so this
 * pins it against a fresh recomputation across the ledger shapes where the
 * two could plausibly disagree: multiple lots, an already-expired lot that
 * must not be spendable, a lot expiring far in the future, partial
 * consumption of a lot, and a redemption that spans several lots.
 *
 * Also pins the counter-case the audit got wrong: finalizeOrder's pair of
 * balance reads has an intervening referral award to the SAME user, so its
 * second read must stay a real read. That is asserted in
 * loyaltyEngine.referral-adjacent suites; here we only assert the invariant
 * this file's change depends on.
 *
 * Hits the real dev DB via DATABASE_URL. Run with:
 *   DATABASE_URL=... node --test --import tsx \
 *     ./src/lib/loyaltyEngine.creditDerivation.test.ts
 */

import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";

import { inArray } from "drizzle-orm";
import { creditLedgerTable, db, usersTable } from "@workspace/db";

import {
  getCreditBalancePaise,
  issueCredit,
  redeemCreditAtomic,
} from "./loyaltyEngine";

const CREATED_USER_IDS: string[] = [];

after(async () => {
  if (CREATED_USER_IDS.length > 0) {
    await db
      .delete(creditLedgerTable)
      .where(inArray(creditLedgerTable.userId, CREATED_USER_IDS));
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
});

async function makeUser(): Promise<string> {
  const id = randomUUID();
  await db.insert(usersTable).values({
    id,
    email: `credit-deriv-${id}@test.local`,
    firstName: "Credit",
    lastName: "Deriv",
  });
  CREATED_USER_IDS.push(id);
  return id;
}

function daysFromNow(n: number): Date {
  return new Date(Date.now() + n * 86_400_000);
}

/**
 * The core assertion: after a successful redemption, the balance the
 * function REPORTS (now derived) equals the balance a full recomputation
 * from the ledger produces.
 */
async function assertDerivationMatchesRecompute(
  userId: string,
  redeemPaise: number,
  label: string,
): Promise<void> {
  const before = await getCreditBalancePaise(userId);
  const result = await redeemCreditAtomic({
    userId,
    paise: redeemPaise,
    refId: `test-${randomUUID().slice(0, 8)}`,
  });
  assert.equal(result.ok, true, `${label}: redemption unexpectedly failed`);
  if (!result.ok) return;

  const recomputed = await getCreditBalancePaise(userId);
  assert.equal(
    result.balancePaise,
    recomputed,
    `${label}: derived balance (${result.balancePaise}) != recomputed balance (${recomputed})`,
  );
  assert.equal(
    result.balancePaise,
    before - redeemPaise,
    `${label}: derived balance is not exactly the pre-balance minus the redemption`,
  );
}

test("single lot, partial redemption", async () => {
  const userId = await makeUser();
  await issueCredit({ userId, deltaPaise: 50_000, reason: "manual_grant" });
  await assertDerivationMatchesRecompute(userId, 20_000, "single lot");
});

test("redemption spanning multiple lots with different expiries", async () => {
  const userId = await makeUser();
  // Deliberately out of expiry order on insert — FIFO consumption is by
  // soonest-expiring first, not insertion order.
  await issueCredit({
    userId,
    deltaPaise: 30_000,
    reason: "manual_grant",
    expiresAt: daysFromNow(90),
  });
  await issueCredit({
    userId,
    deltaPaise: 25_000,
    reason: "manual_grant",
    expiresAt: daysFromNow(7),
  });
  await issueCredit({ userId, deltaPaise: 10_000, reason: "manual_grant" }); // never expires
  // 40_000 spans the 7-day lot (25_000) and part of the 90-day lot (15_000).
  await assertDerivationMatchesRecompute(userId, 40_000, "multi-lot");
});

test("an already-expired lot is not spendable and does not distort the derivation", async () => {
  const userId = await makeUser();
  // Expired grant — must be excluded from the balance entirely.
  await issueCredit({
    userId,
    deltaPaise: 99_000,
    reason: "manual_grant",
    expiresAt: daysFromNow(-1),
  });
  await issueCredit({ userId, deltaPaise: 15_000, reason: "manual_grant" });

  const balance = await getCreditBalancePaise(userId);
  assert.equal(
    balance,
    15_000,
    "an expired lot must not be spendable — if this fails the rest is meaningless",
  );
  await assertDerivationMatchesRecompute(userId, 15_000, "expired lot present");

  // And the expired lot must not resurrect the balance afterward.
  assert.equal(await getCreditBalancePaise(userId), 0);
});

test("redeeming the exact full balance lands on zero, both derived and recomputed", async () => {
  const userId = await makeUser();
  await issueCredit({ userId, deltaPaise: 12_345, reason: "manual_grant" });
  await assertDerivationMatchesRecompute(userId, 12_345, "full balance");
  assert.equal(await getCreditBalancePaise(userId), 0);
});

test("an over-balance redemption is still refused and writes nothing", async () => {
  // The derivation sits AFTER the insufficiency guard; this pins that the
  // guard still fires and the ledger is untouched on refusal.
  const userId = await makeUser();
  await issueCredit({ userId, deltaPaise: 5_000, reason: "manual_grant" });

  const result = await redeemCreditAtomic({ userId, paise: 5_001 });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "insufficient");
  assert.equal(
    await getCreditBalancePaise(userId),
    5_000,
    "a refused redemption must leave the balance untouched",
  );
});

test("consecutive redemptions each derive correctly against the shrinking balance", async () => {
  const userId = await makeUser();
  await issueCredit({
    userId,
    deltaPaise: 20_000,
    reason: "manual_grant",
    expiresAt: daysFromNow(30),
  });
  await issueCredit({ userId, deltaPaise: 20_000, reason: "manual_grant" });

  await assertDerivationMatchesRecompute(userId, 5_000, "1st of 3");
  await assertDerivationMatchesRecompute(userId, 18_000, "2nd of 3 (crosses lots)");
  await assertDerivationMatchesRecompute(userId, 17_000, "3rd of 3 (drains)");
  assert.equal(await getCreditBalancePaise(userId), 0);
});
