// ─────────────────────────────────────────────────────────────────────────────
// Autopay mandate cancellation.
//
// Cancelling a subscription previously only flipped the subscription's own
// status — the Razorpay autopay mandate stayed `active` with a live
// `nextChargeAt`, and /payments/charge-mandate had no idea the subscription was
// gone, so a cancelled customer could still be auto-charged on the next cycle.
// This revokes the mandate (the load-bearing DB flip + notification purge, plus
// a best-effort gateway token revocation) so "cancel = no more charges" holds.
// ─────────────────────────────────────────────────────────────────────────────

import { and, eq, inArray } from "drizzle-orm";
import { db, subscriptionMandatesTable, preDebitNotificationsTable } from "@workspace/db";

/** Minimal logger shape (pino-compatible). */
type Logger = { warn: (...args: any[]) => void; error?: (...args: any[]) => void };

function razorpayCredentials(): [string, string] | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return [keyId, keySecret];
}

function razorpayBasicAuth(keyId: string, keySecret: string): string {
  return Buffer.from(`${keyId}:${keySecret}`).toString("base64");
}

/**
 * Revoke autopay for a subscription. Idempotent and safe to call on a
 * subscription with no mandate. The DB flip + notification purge are the
 * load-bearing controls (they immediately make /payments/charge-mandate refuse);
 * the gateway token DELETE is best-effort and never fails the cancel.
 */
export async function cancelAutopayMandate(subscriptionId: number, log: Logger): Promise<void> {
  // Snapshot the active mandates BEFORE flipping — we need the customer/token
  // ids for gateway revocation, which the update would otherwise leave in place.
  const mandates = await db
    .select()
    .from(subscriptionMandatesTable)
    .where(
      and(
        eq(subscriptionMandatesTable.subscriptionId, subscriptionId),
        eq(subscriptionMandatesTable.status, "active"),
      ),
    );

  await db.transaction(async (tx) => {
    await tx
      .update(subscriptionMandatesTable)
      .set({ status: "cancelled", nextChargeAt: null })
      .where(
        and(
          eq(subscriptionMandatesTable.subscriptionId, subscriptionId),
          eq(subscriptionMandatesTable.status, "active"),
        ),
      );
    // Drop any scheduled/sent pre-debit notices so no charge is triggered later.
    await tx
      .delete(preDebitNotificationsTable)
      .where(
        and(
          eq(preDebitNotificationsTable.subscriptionId, subscriptionId),
          inArray(preDebitNotificationsTable.status, ["pending", "sent"]),
        ),
      );
  });

  // Best-effort gateway revocation — a gateway error must never fail the cancel.
  const creds = razorpayCredentials();
  if (!creds) return;
  const [keyId, keySecret] = creds;
  for (const m of mandates) {
    if (!m.razorpayCustomerId || !m.razorpayTokenId) continue;
    try {
      const res = await fetch(
        `https://api.razorpay.com/v1/customers/${m.razorpayCustomerId}/tokens/${m.razorpayTokenId}`,
        { method: "DELETE", headers: { Authorization: `Basic ${razorpayBasicAuth(keyId, keySecret)}` } },
      );
      if (!res.ok) {
        log.warn({ subscriptionId, tokenId: m.razorpayTokenId, status: res.status }, "razorpay token revoke returned non-2xx (mandate already cancelled locally)");
      }
    } catch (err) {
      log.warn({ err, subscriptionId, tokenId: m.razorpayTokenId }, "razorpay token revoke failed (mandate already cancelled locally)");
    }
  }
}
