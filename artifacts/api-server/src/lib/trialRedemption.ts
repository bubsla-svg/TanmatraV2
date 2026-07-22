// ─────────────────────────────────────────────────────────────────────────────
// 3-Day Taste Test creditback + one-per-phone enforcement (S5b, 02b/02e §6).
//
// This is the DB-writing half of the trial creditback. The pure pieces live in
// `trialEligibility.ts` (phone hashing) and `@workspace/subscription-rules`
// (the credit lot descriptor + expiry math); here we do the two side effects
// that must happen together, exactly once, when a trial is PAID:
//
//   1. Write the durable one-trial-per-phone-EVER ledger row.
//   2. Grant the ₹399 creditback lot (redeemable against any plan start).
//
// Atomicity + idempotency come from the `trial_redemptions.phone_hash` UNIQUE
// constraint driving an `INSERT ... ON CONFLICT DO NOTHING`: the insert is the
// gate. If a row is written, this is the phone's first paid trial and we grant
// the credit; if the insert conflicts (0 rows), the phone already redeemed —
// no second row, no second grant. That makes the whole operation safe to call
// more than once for the same trial (verify + webhook both confirm a payment)
// and safe under concurrency (two simultaneous paid trials for one phone → one
// row, one grant, the loser silently no-ops).
//
// The caller MUST pass a transaction executor so the ledger write and the
// credit grant commit or roll back together.
// ─────────────────────────────────────────────────────────────────────────────

import { db, trialRedemptionsTable } from "@workspace/db";
import type { PgTransaction } from "drizzle-orm/pg-core";
import { eq } from "drizzle-orm";
import { issueCredit } from "./loyaltyEngine";
import { trialCreditGrantFor } from "./trialEligibility";

type DbOrTx = typeof db | PgTransaction<any, any, any>;

/**
 * Has this phone already redeemed a PAID 3-Day Taste Test? Read-only lookup on
 * the durable ledger, keyed by the salted phone hash. Used for the friendly
 * create-time rejection (the DB UNIQUE is the true enforcement at paid-time).
 *
 * An empty `phoneHash` (an unidentifiable number) is treated as "not redeemed"
 * — we never gate on an identity we can't hash.
 */
export async function hasRedeemedTrialPhone(
  phoneHash: string,
  exec: DbOrTx = db,
): Promise<boolean> {
  if (!phoneHash) return false;
  const [row] = await exec
    .select({ id: trialRedemptionsTable.id })
    .from(trialRedemptionsTable)
    .where(eq(trialRedemptionsTable.phoneHash, phoneHash))
    .limit(1);
  return Boolean(row);
}

export interface RecordAndGrantArgs {
  userId: string;
  /** Salted SHA-256 hex of the normalized phone. "" ⇒ skip (unidentifiable). */
  phoneHash: string;
  subscriptionId: number;
  /** When the trial ends — sets the 7-day creditback expiry. */
  trialEndsAt: Date;
}

export type RecordAndGrantResult =
  | { granted: true }
  | { granted: false; reason: "already_redeemed" | "no_phone" };

/**
 * Write the one-per-phone ledger row and grant the ₹399 creditback, atomically
 * and idempotently. The `INSERT ... ON CONFLICT DO NOTHING` on `phone_hash` is
 * the concurrency gate: only the insert that actually writes a row grants the
 * credit. Callers pass a transaction so both writes share a commit boundary.
 *
 * Returns `{granted:false, reason:"already_redeemed"}` when the phone already
 * has a paid trial (the credit is NOT re-granted), or `{reason:"no_phone"}`
 * when the phone couldn't be hashed (nothing to key the ledger on).
 */
export async function recordAndGrantTrialCredit(
  exec: DbOrTx,
  args: RecordAndGrantArgs,
): Promise<RecordAndGrantResult> {
  if (!args.phoneHash) {
    return { granted: false, reason: "no_phone" };
  }

  const inserted = await exec
    .insert(trialRedemptionsTable)
    .values({
      phoneHash: args.phoneHash,
      userId: args.userId,
      subscriptionId: args.subscriptionId,
    })
    .onConflictDoNothing({ target: trialRedemptionsTable.phoneHash })
    .returning({ id: trialRedemptionsTable.id });

  // Conflict → the phone already redeemed. No row written, no credit granted.
  if (inserted.length === 0) {
    return { granted: false, reason: "already_redeemed" };
  }

  const grant = trialCreditGrantFor(args.trialEndsAt);
  await issueCredit(
    {
      userId: args.userId,
      deltaPaise: grant.deltaPaise,
      reason: grant.reason,
      refType: "subscription",
      refId: String(args.subscriptionId),
      note: "3-Day Taste Test creditback",
      expiresAt: grant.expiresAt,
    },
    exec,
  );

  return { granted: true };
}
