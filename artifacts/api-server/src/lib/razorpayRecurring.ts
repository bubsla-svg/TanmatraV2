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
import { billingCadenceDays } from "./billingCadence";

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

/**
 * The customer's Razorpay id, created once and reused forever after.
 *
 * WHY THE "GET" HALF EXISTS NOW. This function used to be create-only despite
 * its name: it POSTed /v1/customers on every call and stored the result
 * nowhere the next call could read. The id was written to
 * `subscription_mandates`, but that row is only inserted after a payment
 * verifies — and per Cloud Logging (90 days) this account has nine
 * gateway-order attempts and zero verify calls, so the id was created at
 * Razorpay and immediately forgotten. Every subsequent attempt by the same
 * customer came back 400 "Customer already exists for the merchant", which
 * the caller turned into a 500 and the storefront rendered as "We couldn't
 * price this order just now."
 *
 * So one abandoned checkout permanently bricked plan purchases for that
 * customer, and since almost everyone abandons the first attempt, it bricked
 * them for everyone. `fail_existing: 0` is supposed to return the existing
 * customer instead of erroring; it does not here, because Razorpay only
 * de-duplicates when contact AND email both match what was sent originally,
 * and `email` is frequently undefined for a phone-OTP signup.
 *
 * Three layers, cheapest first: the id on the user row; a create that
 * persists what it makes; and, for the customers already poisoned before this
 * shipped, a recovery that finds the existing customer by contact and adopts
 * it. Only if all three fail does this throw.
 */
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

  // 1. Already known. No network call at all — this is the path every repeat
  //    customer should take.
  if (user.razorpayCustomerId) return user.razorpayCustomerId;

  const auth = razorpayBasicAuth(keyId, keySecret);
  const contact = user.phoneE164 || undefined;

  const rpRes = await fetch("https://api.razorpay.com/v1/customers", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "Subscription Customer",
      email: user.email || undefined,
      contact,
      fail_existing: 0,
    }),
    // Same ceiling as the order-create call: a hung customers call must not
    // hold the checkout open indefinitely.
    signal: AbortSignal.timeout(8000),
  });

  if (rpRes.ok) {
    const customer = (await rpRes.json()) as { id: string };
    // 2. Persist BEFORE returning. This is the line whose absence caused the
    //    whole defect — an abandoned checkout must still leave the id behind.
    await rememberRazorpayCustomer(userId, customer.id, log);
    return customer.id;
  }

  const body = await rpRes.text();

  // 3. Recovery for a customer created before this function persisted ids.
  //    Razorpay's customers list has no filter-by-contact, so this pages
  //    through and matches — bounded, and it runs at most once per customer
  //    because the id is persisted the moment it is found.
  if (rpRes.status === 400 && body.includes("Customer already exists") && contact) {
    const existing = await findRazorpayCustomerByContact(contact, auth, log);
    if (existing) {
      log.warn?.(
        { userId, razorpayCustomerId: existing },
        "adopted a pre-existing Razorpay customer that was never persisted",
      );
      await rememberRazorpayCustomer(userId, existing, log);
      return existing;
    }
  }

  log.error({ status: rpRes.status, body }, "Razorpay customer creation failed");
  throw new Error("Razorpay customer creation failed");
}

/** Store the id on the user. A failure here is logged, never thrown: the
 *  caller has a usable customer id and the payment must go ahead — the cost
 *  is only that the next call repeats this work. */
async function rememberRazorpayCustomer(
  userId: string,
  customerId: string,
  log: Logger,
): Promise<void> {
  try {
    await db
      .update(usersTable)
      .set({ razorpayCustomerId: customerId })
      .where(eq(usersTable.id, userId));
  } catch (err) {
    log.error({ err, userId, customerId }, "could not persist Razorpay customer id on the user");
  }
}

/** Page the merchant's customers looking for one with this contact number.
 *  Only ever reached on the "already exists" recovery path. */
async function findRazorpayCustomerByContact(
  contact: string,
  auth: string,
  log: Logger,
): Promise<string | null> {
  const PAGE = 100;
  const MAX_PAGES = 10; // 1,000 customers — well past this merchant's size.
  const wanted = contact.replace(/[^0-9]/g, "").slice(-10);
  for (let page = 0; page < MAX_PAGES; page++) {
    try {
      const res = await fetch(
        `https://api.razorpay.com/v1/customers?count=${PAGE}&skip=${page * PAGE}`,
        { headers: { Authorization: `Basic ${auth}` }, signal: AbortSignal.timeout(8000) },
      );
      if (!res.ok) return null;
      const json = (await res.json()) as { items?: Array<{ id: string; contact?: string }> };
      const items = json.items ?? [];
      const hit = items.find(
        (c) => (c.contact ?? "").replace(/[^0-9]/g, "").slice(-10) === wanted,
      );
      if (hit) return hit.id;
      if (items.length < PAGE) return null; // last page, no match
    } catch (err) {
      log.error({ err }, "Razorpay customer lookup by contact failed");
      return null;
    }
  }
  return null;
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
  // One billed cycle per delivered cycle — the shared table in
  // billingCadence.ts (monthly = the 6-week protocol, not 30 days).
  const nextChargeAt = new Date();
  nextChargeAt.setDate(nextChargeAt.getDate() + billingCadenceDays(cadence));

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
