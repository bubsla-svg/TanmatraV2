// ─────────────────────────────────────────────────────────────────────────────
// Shared Razorpay recurring-payment helpers.
//
// Extracted out of routes/payments.ts so the SAME token-creation / mandate-
// registration code path used at subscription creation (the `isRecurring`
// branch of POST /payments/razorpay/order + the mandate upsert that follows
// a verified payment) can be reused, unmodified, by the subscription
// plan-change re-authorisation flow (POST /subscriptions/:id/change-plan/*)
// instead of a second, divergent implementation.
// ─────────────────────────────────────────────────────────────────────────────

import {
  db,
  subscriptionsTable,
  subscriptionMandatesTable,
  usersTable,
  type SubscriptionCadence,
} from "@workspace/db";
import { eq } from "drizzle-orm";

/** Minimal logger shape (pino-compatible). */
type Logger = { error: (...args: any[]) => void; warn?: (...args: any[]) => void };

/** Returns [keyId, keySecret] or null when either env var is absent. */
export function razorpayCredentials(): [string, string] | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return [keyId, keySecret];
}

export function razorpayBasicAuth(keyId: string, keySecret: string): string {
  return Buffer.from(`${keyId}:${keySecret}`).toString("base64");
}

export async function getOrCreateRazorpayCustomer(
  userId: string,
  keyId: string,
  keySecret: string,
  log: Logger,
): Promise<string> {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user) {
    throw new Error("user not found");
  }

  const rpRes = await fetch("https://api.razorpay.com/v1/customers", {
    method: "POST",
    headers: {
      Authorization: `Basic ${razorpayBasicAuth(keyId, keySecret)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "Subscription Customer",
      email: user.email || undefined,
      contact: user.phoneE164 || undefined,
      fail_existing: 0,
    }),
  });

  if (!rpRes.ok) {
    const body = await rpRes.text();
    log.error({ status: rpRes.status, body }, "Razorpay customer creation failed");
    throw new Error("Razorpay customer creation failed");
  }

  const customer = (await rpRes.json()) as { id: string };
  return customer.id;
}

export async function fetchRazorpayPayment(
  paymentId: string,
  keyId: string,
  keySecret: string,
): Promise<any> {
  const res = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
    method: "GET",
    headers: {
      Authorization: `Basic ${razorpayBasicAuth(keyId, keySecret)}`,
    },
  });

  if (!res.ok) {
    throw new Error(`failed to fetch payment from Razorpay: ${res.statusText}`);
  }

  return res.json();
}

/**
 * Upsert the active autopay mandate row for a subscription from a verified
 * Razorpay payment's customer_id/token_id. Shared by:
 *   - registerAutopayMandate (payments.ts) — first payment at subscription
 *     creation, resolved via the paid order's linked delivery.
 *   - the plan-change re-authorisation confirm step (subscriptions.ts) —
 *     resolved directly by subscriptionId, no order/delivery involved.
 * Setting `status: "active"` here is what makes this a REPLACEMENT of any
 * prior mandate (e.g. a price-increase re-auth superseding the token that
 * was authorised for the old, lower ceiling amount).
 */
export async function upsertActiveMandate(
  subscriptionId: number,
  cadence: SubscriptionCadence,
  customerId: string,
  tokenId: string,
): Promise<void> {
  const days = cadence === "weekly" ? 7 : cadence === "fortnightly" ? 14 : 30;
  const nextChargeAt = new Date();
  nextChargeAt.setDate(nextChargeAt.getDate() + days);

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(subscriptionMandatesTable)
      .where(eq(subscriptionMandatesTable.subscriptionId, subscriptionId))
      .limit(1);

    if (existing) {
      await tx
        .update(subscriptionMandatesTable)
        .set({
          razorpayCustomerId: customerId,
          razorpayTokenId: tokenId,
          status: "active",
          nextChargeAt,
        })
        .where(eq(subscriptionMandatesTable.id, existing.id));
    } else {
      await tx.insert(subscriptionMandatesTable).values({
        subscriptionId,
        razorpayCustomerId: customerId,
        razorpayTokenId: tokenId,
        status: "active",
        nextChargeAt,
      });
    }

    await tx
      .update(subscriptionsTable)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(subscriptionsTable.id, subscriptionId));
  });
}
