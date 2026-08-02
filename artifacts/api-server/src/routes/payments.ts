import * as crypto from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  ordersTable,
  webhookInboxTable,
  usersTable,
  subscriptionsTable,
  subscriptionDeliveriesTable,
  refundRequestsTable,
  deliveryEventsTable,
  isLiveTrialState,
} from "@workspace/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod/v4";
import { sendOrderConfirmation } from "../lib/orderNotification";
import { emitServerEvent } from "../lib/serverEvents";
import { commitSubsidyForOrder } from "../lib/corporateSubsidy";
import { pushOrderToPetpooja } from "../lib/petpoojaClient";
import { runPreDebitNotificationsSweep } from "../lib/preDebitScheduler";
import {
  isCaptureAmountReconciled,
  resolvePayableAmountPaise,
  refundedSoFarPaise,
  REFUND_EVENT_NAMES,
} from "../lib/paymentIntegrity";
import { chargeMandateCore } from "../lib/chargeMandate";
import { requireOps } from "../lib/adminGate";
import { paymentRateLimit } from "../middlewares/rateLimitMiddleware";
import {
  razorpayCredentials,
  razorpayBasicAuth,
  getOrCreateRazorpayCustomer,
  fetchRazorpayPayment,
  upsertActiveMandate,
} from "../lib/razorpayRecurring";
import { isPlanV2Enabled } from "../lib/flags";
import { hashTrialPhone } from "../lib/trialEligibility";
import { recordAndGrantTrialCredit } from "../lib/trialRedemption";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Schema definitions
// ---------------------------------------------------------------------------

const createRazorpayOrderSchema = z.object({
  // Retained for backward compatibility and tamper detection only — the
  // gateway order is ALWAYS created for the server-stored charge, never this.
  amountPaise: z.number().int().positive().max(10_000_000).optional(),
  receipt: z.string().max(64).optional(),
  orderId: z.string().min(1).max(64),
  subscriptionId: z.number().int().positive().optional(),
});

const verifyPaymentSchema = z.object({
  orderId: z.string().min(1).max(64),
  razorpayPaymentId: z.string().min(1).max(64),
  razorpayOrderId: z.string().min(1).max(64),
  razorpaySignature: z.string().min(1).max(128),
});

const upiIntentSchema = z.object({
  // Retained for backward compatibility and tamper detection only — the payment
  // link is ALWAYS created for the server-stored charge, never this value.
  amountPaise: z.number().int().positive().max(10_000_000).optional(),
  orderId: z.string().max(40),
  phone: z.string().max(20),
});

// The `notes` tag a plan-v2 3-Day Taste Test carries (subscriptions.ts writes
// `plan_v2:trial_3day`). Gating the grant on this keeps legacy RD-plan trials
// (which use a different note) out of the creditback path.
const PLAN_V2_TRIAL_TAG = "plan_v2:trial_3day";

/**
 * Grant the 3-Day Taste Test creditback for a PAID plan-v2 trial and write the
 * durable one-per-phone ledger row, atomically and idempotently. No-ops unless
 * FLAG_PLAN_V2 is on AND the subscription is a plan-v2 trial. The trial's end
 * is its last scheduled delivery, which sets the credit's 7-day expiry.
 *
 * Best-effort by contract: any failure is logged and swallowed so a payment
 * confirmation (verify or webhook) is never broken by the creditback side
 * effect. The phone-hash UNIQUE makes a later retry safe.
 */
export async function maybeGrantTrialCreditback(
  sub: {
    subscriptionId: number;
    userId: string;
    notes: string | null;
    phone: string | null;
  },
  log: any
): Promise<void> {
  if (!isPlanV2Enabled()) return;
  if (!sub.notes || !sub.notes.includes(PLAN_V2_TRIAL_TAG)) return;

  const phoneHash = hashTrialPhone(sub.phone);
  if (!phoneHash) {
    log.warn(
      { subscriptionId: sub.subscriptionId },
      "plan-v2 trial paid but phone is unidentifiable; skipping creditback"
    );
    return;
  }

  try {
    // Trial end = the last scheduled delivery of this trial subscription.
    const [last] = await db
      .select({ scheduledFor: subscriptionDeliveriesTable.scheduledFor })
      .from(subscriptionDeliveriesTable)
      .where(eq(subscriptionDeliveriesTable.subscriptionId, sub.subscriptionId))
      .orderBy(desc(subscriptionDeliveriesTable.scheduledFor))
      .limit(1);
    const trialEndsAt = last?.scheduledFor ?? new Date();

    const result = await db.transaction((tx) =>
      recordAndGrantTrialCredit(tx, {
        userId: sub.userId,
        phoneHash,
        subscriptionId: sub.subscriptionId,
        trialEndsAt,
      })
    );

    if (result.granted) {
      log.info(
        { subscriptionId: sub.subscriptionId, userId: sub.userId },
        "granted 3-Day Taste Test creditback"
      );
    } else {
      log.info(
        { subscriptionId: sub.subscriptionId, reason: result.reason },
        "3-Day Taste Test creditback not granted"
      );
    }
  } catch (err) {
    // Never let the creditback break the payment confirmation.
    log.error(
      { err, subscriptionId: sub.subscriptionId },
      "failed to grant 3-Day Taste Test creditback"
    );
  }
}

async function registerAutopayMandate(
  orderId: number,
  paymentId: string,
  keyId: string,
  keySecret: string,
  log: any
): Promise<{ autopayDisclaimer?: string } | null> {
  const [subDelivery] = await db
    .select({
      subscriptionId: subscriptionDeliveriesTable.subscriptionId,
      cadence: subscriptionsTable.cadence,
      trialState: subscriptionsTable.trialState,
      userId: subscriptionsTable.userId,
      notes: subscriptionsTable.notes,
      phone: subscriptionsTable.phone,
    })
    .from(subscriptionDeliveriesTable)
    .innerJoin(
      subscriptionsTable,
      eq(subscriptionDeliveriesTable.subscriptionId, subscriptionsTable.id)
    )
    .where(eq(subscriptionDeliveriesTable.orderId, orderId))
    .limit(1);

  if (!subDelivery) return null;

  // Defense in depth with the order-create guard above: a live trial must
  // never end up with an active mandate row, whichever payment path
  // (verify or webhook) confirmed it.
  if (isLiveTrialState(subDelivery.trialState)) {
    log.info(
      { orderId, subscriptionId: subDelivery.subscriptionId },
      "skipping autopay mandate registration for live trial subscription"
    );
    // The trial-PAID confirmation point (02b/02e §6): a PAID 3-Day Taste Test
    // earns the ₹399 creditback + writes the durable one-per-phone ledger row.
    // Doing it HERE (not at create) means a trial whose payment never lands
    // never burns the allowance. Idempotent across the verify + webhook paths
    // via the phone-hash UNIQUE, so a double confirmation grants exactly once.
    // Best-effort: a grant failure must never fail the payment confirmation.
    await maybeGrantTrialCreditback(subDelivery, log);
    return null;
  }

  let payment;
  try {
    payment = await fetchRazorpayPayment(paymentId, keyId, keySecret);
  } catch (err) {
    log.error({ err, paymentId }, "failed to fetch payment details from Razorpay for mandate registration");
    return null;
  }

  const customerId = payment.customer_id;
  const tokenId = payment.token_id || payment.razorpay_token_id;

  if (!customerId || !tokenId) {
    log.warn({ paymentId, customerId, tokenId }, "payment details missing customer_id or token_id for mandate");
    return null;
  }

  await upsertActiveMandate(subDelivery.subscriptionId, subDelivery.cadence, customerId, tokenId);

  return {
    autopayDisclaimer: "Weekly payments use UPI Autopay. You'll get a notification at least 24 hours before each charge..."
  };
}

// ---------------------------------------------------------------------------
// POST /payments/razorpay/order
// ---------------------------------------------------------------------------

/**
 * Creates a Razorpay order object server-side. The client uses the returned
 * `razorpayOrderId` to open the Razorpay checkout modal.
 */
router.post("/payments/razorpay/order", async (req: Request, res: Response) => {
  const creds = razorpayCredentials();
  if (!creds) {
    res.status(503).json({ error: "payment gateway not configured" });
    return;
  }
  const [keyId, keySecret] = creds;

  const parsed = createRazorpayOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid payload" });
    return;
  }

  const { amountPaise: clientAmount, orderId, subscriptionId } = parsed.data;

  // The gateway order MUST be created for the amount the server computed and
  // stored on the order, never a client-supplied number. Resolve it first.
  const [order] = await db
    .select({
      id: ordersTable.id,
      userId: ordersTable.userId,
      status: ordersTable.status,
      chargePaise: ordersTable.chargePaise,
      totalPaise: ordersTable.totalPaise,
    })
    .from(ordersTable)
    .where(eq(ordersTable.externalOrderId, orderId))
    .limit(1);

  if (!order) {
    res.status(404).json({ error: "order not found" });
    return;
  }

  // Ownership: an order that belongs to a user may only be paid by that user.
  // Guest orders (userId null) stay open for the guest-checkout flow.
  if (order.userId) {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    if (req.user.id !== order.userId) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
  }

  // total_paise already includes GST+fee on the guest-checkout path; the
  // loyalty finalize path writes the authoritative amount to charge_paise.
  const authoritativePaise = order.chargePaise ?? order.totalPaise;
  if (!Number.isInteger(authoritativePaise) || authoritativePaise <= 0) {
    res.status(409).json({ error: "order has no payable amount" });
    return;
  }
  if (typeof clientAmount === "number" && clientAmount !== authoritativePaise) {
    // Not fatal — we bill the authoritative amount regardless — but a
    // divergence is worth surfacing (client math drift or tamper attempt).
    req.log.warn(
      { orderId, clientAmount, authoritativePaise },
      "razorpay order amount mismatch — billing server amount",
    );
  }

  let isRecurring = false;
  let razorpayCustomerId: string | null = null;
  if (subscriptionId) {
    const [sub] = await db
      .select()
      .from(subscriptionsTable)
      .where(
        and(
          eq(subscriptionsTable.id, subscriptionId),
          eq(subscriptionsTable.userId, order.userId || "")
        )
      )
      .limit(1);

    // Live trials are sold as one-time ("does not auto-renew") on every
    // surface, so they must never get a recurring token — even though they
    // reuse cadence:"weekly" for scheduling. Only a converted trial
    // re-enters the recurring path (isLiveTrialState is false once
    // trialState becomes "converted").
    if (
      sub &&
      !isLiveTrialState(sub.trialState) &&
      (sub.cadence === "weekly" || sub.cadence === "fortnightly")
    ) {
      isRecurring = true;
      try {
        razorpayCustomerId = await getOrCreateRazorpayCustomer(
          sub.userId,
          keyId,
          keySecret,
          req.log
        );
      } catch (err) {
        res.status(500).json({ error: "failed to setup customer for recurring payment" });
        return;
      }
    }
  }

  const rpOrderPayload: Record<string, any> = {
    amount: authoritativePaise,
    currency: "INR",
    receipt: orderId.slice(0, 40),
    payment_capture: 1,
  };

  if (isRecurring && razorpayCustomerId) {
    rpOrderPayload.customer_id = razorpayCustomerId;
    rpOrderPayload.token = {
      auth_type: "otp",
      max_amount: 1500000,
      expire_by: Math.floor(Date.now() / 1000) + 10 * 365 * 24 * 60 * 60, // 10 years
      frequency: "as_presented",
    };
  }

  const rpRes = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${razorpayBasicAuth(keyId, keySecret)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(rpOrderPayload),
    signal: AbortSignal.timeout(8000),
  });

  if (!rpRes.ok) {
    let body: unknown;
    try {
      body = await rpRes.json();
    } catch {
      body = await rpRes.text();
    }
    req.log.error({ status: rpRes.status, body }, "Razorpay order creation failed");
    res.status(502).json({ error: "payment gateway error" });
    return;
  }

  const rp = (await rpRes.json()) as { id: string; amount: number; currency: string };

  // Bind the gateway order to exactly the row we priced (by id, not a second
  // externalOrderId match) so verify/webhook can require this linkage.
  try {
    await db
      .update(ordersTable)
      .set({ razorpayOrderId: rp.id })
      .where(eq(ordersTable.id, order.id));
  } catch (err) {
    req.log.error({ err, orderId, razorpayOrderId: rp.id }, "failed to store razorpayOrderId on order");
    // Without this linkage the capture cannot be reconciled — fail loudly
    // rather than open a modal for an unreconcilable payment.
    res.status(500).json({ error: "could not link payment to order" });
    return;
  }

  res.json({
    razorpayOrderId: rp.id,
    amount: rp.amount,
    currency: rp.currency,
    keyId,
  });
});

// ---------------------------------------------------------------------------
// POST /payments/razorpay/verify
// ---------------------------------------------------------------------------

/**
 * Verifies the Razorpay payment signature after the checkout modal closes.
 * On success, transitions the order to "preparing". The DB update failure is
 * non-fatal — payment is confirmed by Razorpay and the discrepancy is
 * reconciled manually.
 */
router.post("/payments/razorpay/verify", async (req: Request, res: Response) => {
  const creds = razorpayCredentials();
  if (!creds) {
    res.status(503).json({ error: "payment gateway not configured" });
    return;
  }
  const [, keySecret] = creds;

  const parsed = verifyPaymentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid payload" });
    return;
  }

  const { orderId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = parsed.data;

  // HMAC-SHA256 verification using the Razorpay signing pattern.
  const hmac = crypto.createHmac("sha256", keySecret);
  hmac.update(`${razorpayOrderId}|${razorpayPaymentId}`);
  const expected = hmac.digest("hex");

  let signatureValid = false;
  try {
    signatureValid = crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(razorpaySignature, "hex"),
    );
  } catch {
    // Buffers of different lengths throw — treat as mismatch.
    signatureValid = false;
  }

  if (!signatureValid) {
    req.log.warn({ orderId, razorpayOrderId }, "invalid Razorpay payment signature");
    res.status(400).json({ error: "invalid payment signature" });
    return;
  }

  // A valid signature only proves SOME payment succeeded on SOME Razorpay
  // order. Bind it to THIS order: the razorpayOrderId presented must equal the
  // one we created and stored when pricing the order. Without this, a genuine
  // ₹1 payment's signature could be replayed against any other order id.
  const [order] = await db
    .select({
      id: ordersTable.id,
      status: ordersTable.status,
      razorpayOrderId: ordersTable.razorpayOrderId,
      userId: ordersTable.userId,
      chargePaise: ordersTable.chargePaise,
      totalPaise: ordersTable.totalPaise,
    })
    .from(ordersTable)
    .where(eq(ordersTable.externalOrderId, orderId))
    .limit(1);

  if (!order) {
    res.status(404).json({ error: "order not found" });
    return;
  }
  if (!order.razorpayOrderId || order.razorpayOrderId !== razorpayOrderId) {
    req.log.warn(
      { orderId, presented: razorpayOrderId, stored: order.razorpayOrderId },
      "razorpay order id does not match the order — refusing to confirm",
    );
    res.status(400).json({ error: "payment does not belong to this order" });
    return;
  }

  const PAID_STATES = new Set(["preparing", "ready", "out_for_delivery", "delivered"]);
  // Already confirmed (e.g. the webhook won the race) — idempotent success.
  if (PAID_STATES.has(order.status)) {
    res.json({ ok: true, orderId, status: order.status });
    return;
  }
  // A cancelled/failed order must not be silently resurrected by a late verify.
  if (order.status === "cancelled" || order.status === "failed") {
    res.status(409).json({ ok: false, orderId, status: order.status, error: "order not payable" });
    return;
  }

  const [keyId] = creds;
  let autopayDisclaimer: string | undefined;

  // Guarded transition placed → preparing (never downgrade a paid state).
  // Capture the payment id too — refunds are issued against it.
  try {
    const updated = await db
      .update(ordersTable)
      .set({ status: "preparing", razorpayPaymentId })
      .where(and(eq(ordersTable.id, order.id), eq(ordersTable.status, "placed")))
      .returning({ id: ordersTable.id });
    if (updated[0]) {
      void sendOrderConfirmation(updated[0].id).catch((err: unknown) =>
        req.log.error({ err, orderId: updated[0]!.id }, "sendOrderConfirmation failed"),
      );
      // Part 8 A4 — server-truth payment_succeeded, emitted only on the
      // fresh placed→preparing transition (the webhook path emits its own
      // copy when it wins the race instead). Fire-and-forget, never throws.
      void emitServerEvent(
        "payment_succeeded",
        { charge_paise: order.chargePaise ?? order.totalPaise },
        order.userId,
      );
    }

    // The customer's card has now been debited an amount already NET of the
    // company's share, so the company owes that share. Commit the reservation
    // taken at pricing time.
    //
    // Deliberately outside the `if (updated[0])` above: if the webhook won the
    // placed→preparing race, this caller still saw a verified capture and must
    // not skip the company charge on that account. commitSubsidyForOrder is
    // idempotent on the order's reservation row, so whichever path arrives
    // second is a no-op rather than a double charge.
    try {
      await commitSubsidyForOrder(order.id);
    } catch (err) {
      // Never fail a verified payment over this. The webhook retries the same
      // commit, and the reservation stays `reserved` until one of them lands —
      // which reads as "owed but not yet collected", not as lost.
      req.log.error({ err, orderId }, "corporate subsidy commit failed after verify");
    }

    const mandateResult = await registerAutopayMandate(order.id, razorpayPaymentId, keyId, keySecret, req.log);
    if (mandateResult) {
      autopayDisclaimer = mandateResult.autopayDisclaimer;
    }
  } catch (err) {
    // Payment is confirmed by Razorpay — do not fail the response. The webhook
    // reconciles the status independently; ops can verify via the dashboard.
    req.log.error({ err, orderId }, "order status update / mandate registration failed after payment verification");
    res.json({ ok: true, orderId, status: "placed", warning: "status_update_failed" });
    return;
  }

  res.json({
    ok: true,
    orderId,
    status: "preparing",
    ...(autopayDisclaimer ? { autopayDisclaimer } : {})
  });
});

// ---------------------------------------------------------------------------
// POST /payments/upi/intent
// ---------------------------------------------------------------------------

/**
 * Creates a Razorpay Payment Link restricted to UPI, suitable for
 * WhatsApp/SMS order flows where the customer is not in a browser.
 */
router.post("/payments/upi/intent", async (req: Request, res: Response) => {
  const creds = razorpayCredentials();
  if (!creds) {
    res.status(503).json({ error: "payment gateway not configured" });
    return;
  }
  const [keyId, keySecret] = creds;

  const parsed = upiIntentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid payload" });
    return;
  }

  const { amountPaise: clientAmount, orderId, phone } = parsed.data;

  // Resolve the order and its authoritative amount server-side. A payment link
  // MUST be created for the server-stored charge, never a client-supplied
  // number — otherwise a caller can pay ₹1 for any order. Mirrors the hardened
  // /payments/razorpay/order path.
  const [order] = await db
    .select({
      id: ordersTable.id,
      userId: ordersTable.userId,
      status: ordersTable.status,
      chargePaise: ordersTable.chargePaise,
      totalPaise: ordersTable.totalPaise,
    })
    .from(ordersTable)
    .where(eq(ordersTable.externalOrderId, orderId))
    .limit(1);

  if (!order) {
    res.status(404).json({ error: "order not found" });
    return;
  }

  // Ownership: an order that belongs to a user may only be paid by that user.
  // Guest orders (userId null) stay open for the guest-checkout flow.
  if (order.userId) {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    if (req.user.id !== order.userId) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
  }

  const authoritativePaise = resolvePayableAmountPaise(order);
  if (authoritativePaise == null) {
    res.status(409).json({ error: "order has no payable amount" });
    return;
  }
  if (typeof clientAmount === "number" && clientAmount !== authoritativePaise) {
    // Not fatal — we bill the authoritative amount regardless — but a divergence
    // is worth surfacing (client math drift or a tamper attempt).
    req.log.warn(
      { orderId, clientAmount, authoritativePaise },
      "upi intent amount mismatch — billing server amount",
    );
  }

  const rpRes = await fetch("https://api.razorpay.com/v1/payment_links", {
    method: "POST",
    headers: {
      Authorization: `Basic ${razorpayBasicAuth(keyId, keySecret)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: authoritativePaise,
      currency: "INR",
      description: "Tanmatra Order",
      reference_id: orderId,
      customer: { contact: phone },
      options: { checkout: { method: { upi: 1 } } },
      expire_by: Math.floor(Date.now() / 1000) + 1800,
    }),
    signal: AbortSignal.timeout(8000),
  });

  if (!rpRes.ok) {
    let body: unknown;
    try {
      body = await rpRes.json();
    } catch {
      body = await rpRes.text();
    }
    req.log.error({ status: rpRes.status, body }, "Razorpay payment link creation failed");
    res.status(502).json({ error: "payment gateway error" });
    return;
  }

  const link = (await rpRes.json()) as {
    id: string;
    short_url: string;
    expire_by: number;
  };

  res.json({
    intentId: link.id,
    paymentUrl: link.short_url,
    status: "pending",
    expiresAt: new Date(link.expire_by * 1000).toISOString(),
  });
});

/**
 * Every event on an order that the payout cap counts as money already returned.
 * Deliberately queried by NAME from `REFUND_EVENT_NAMES` and no wider: that
 * constant is the exact set `refundedSoFarPaise` sums, so "is this refund
 * already in the ledger" has to be asked of the same set. An audit record filed
 * under any other name (`refund_reversed`, say) is not in the ledger and must
 * not suppress a write.
 */
async function orderRefundLedger(orderId: number) {
  return db
    .select({
      id: deliveryEventsTable.id,
      event: deliveryEventsTable.event,
      meta: deliveryEventsTable.meta,
    })
    .from(deliveryEventsTable)
    .where(
      and(
        eq(deliveryEventsTable.orderId, orderId),
        inArray(deliveryEventsTable.event, [...REFUND_EVENT_NAMES]),
      ),
    );
}

/**
 * The ledger entries that belong to one particular gateway refund. Matched on
 * either identifier we may hold: the gateway's own refund id (written by the
 * console on success) or our refund_requests row id. Either alone is enough —
 * requiring both would silently reverse nothing in exactly the case reversal
 * exists for, which is that something about the first write went wrong.
 */
function entriesForRefund(
  ledger: Awaited<ReturnType<typeof orderRefundLedger>>,
  keys: { razorpayRefundId: string; refundRequestId: number | null },
) {
  return ledger.filter(
    (row) =>
      (keys.razorpayRefundId !== "" &&
        row.meta?.["razorpayRefundId"] === keys.razorpayRefundId) ||
      (keys.refundRequestId != null &&
        row.meta?.["refundRequestId"] === keys.refundRequestId),
  );
}

// ---------------------------------------------------------------------------
// POST /payments/razorpay/webhook
// ---------------------------------------------------------------------------
// Razorpay server-to-server event delivery. The body is received as a raw
// Buffer (mounted in app.ts before the JSON parser) so we can compute the
// HMAC before deserialising — this prevents processing forged events.
// Required env: RAZORPAY_WEBHOOK_SECRET

router.post("/payments/razorpay/webhook", async (req: Request, res: Response) => {
  const webhookSecret = process.env["RAZORPAY_WEBHOOK_SECRET"];
  if (!webhookSecret) {
    req.log.error("RAZORPAY_WEBHOOK_SECRET not configured");
    res.status(500).json({ error: "webhook not configured" });
    return;
  }

  // req.body is a Buffer when mounted with express.raw() — verify before parse.
  const rawBody = req.body as Buffer;
  if (!Buffer.isBuffer(rawBody)) {
    res.status(400).json({ error: "unexpected content type" });
    return;
  }

  const receivedSig = req.headers["x-razorpay-signature"];
  if (!receivedSig || typeof receivedSig !== "string") {
    res.status(400).json({ error: "missing signature" });
    return;
  }

  const expectedSig = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");

  let sigValid = false;
  try {
    sigValid = crypto.timingSafeEqual(
      Buffer.from(expectedSig, "hex"),
      Buffer.from(receivedSig, "hex"),
    );
  } catch {
    sigValid = false;
  }

  if (!sigValid) {
    req.log.warn({ receivedSig }, "invalid Razorpay webhook signature");
    res.status(400).json({ error: "invalid signature" });
    return;
  }

  let event: {
    id?: string;
    event?: string;
    payload?: {
      payment?: { entity?: { order_id?: string; id?: string; amount?: number } };
      payment_link?: { entity?: { id?: string; reference_id?: string; amount?: number; amount_paid?: number; status?: string } };
      refund?: {
        entity?: {
          id?: string;
          payment_id?: string;
          amount?: number;
          status?: string;
          notes?: Record<string, unknown>;
        };
      };
    };
  };
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    res.status(400).json({ error: "invalid json" });
    return;
  }

  const eventType = event.event ?? "unknown";
  const paymentEntity = event.payload?.payment?.entity;
  const headerId = typeof req.headers["x-razorpay-event-id"] === "string" ? req.headers["x-razorpay-event-id"] : null;
  const eventId = headerId || event.id || `rp-${paymentEntity?.id || paymentEntity?.order_id || crypto.createHash("sha256").update(rawBody).digest("hex").slice(0, 32)}`;

  // Store-and-forward ingestion into webhook_inbox.
  // INSERT ... ON CONFLICT DO NOTHING ensures strict deduplication.
  const inserted = await db
    .insert(webhookInboxTable)
    .values({
      eventId,
      source: "razorpay",
      eventType,
      signature: receivedSig,
      payload: rawBody.toString("utf8"),
      status: "pending",
    })
    .onConflictDoNothing({
      target: [webhookInboxTable.source, webhookInboxTable.eventId],
    })
    .returning();

  let attemptsCount = 1;

  if (inserted.length === 0) {
    const [existing] = await db
      .select()
      .from(webhookInboxTable)
      .where(
        and(
          eq(webhookInboxTable.source, "razorpay"),
          eq(webhookInboxTable.eventId, eventId),
        ),
      );

    if (existing && existing.status === "processed") {
      req.log.info({ source: "razorpay", eventId }, "webhook deduplicated via inbox");
      res.status(200).json({ ok: true, deduplicated: true, eventId });
      return;
    }

    if (existing) {
      attemptsCount = (existing.attempts ?? 0) + 1;
      req.log.info(
        { source: "razorpay", eventId, status: existing.status, attemptsCount },
        "re-attempting webhook processing after previous failure/pending",
      );
    }
  }

  // Process business logic and update inbox status.
  let processError: Error | null = null;
  try {
    if (eventType === "payment.captured") {
      const razorpayOrderId = paymentEntity?.order_id ?? "";
      const capturedAmount = paymentEntity?.amount;
      if (razorpayOrderId) {
        const rows = await db
          .select({
            order: ordersTable,
            user: {
              firstName: usersTable.firstName,
              lastName: usersTable.lastName,
              email: usersTable.email,
            },
          })
          .from(ordersTable)
          .leftJoin(usersTable, eq(ordersTable.userId, usersTable.id))
          .where(eq(ordersTable.razorpayOrderId, razorpayOrderId))
          .limit(1);
        const result = rows[0];
        const order = result?.order;
        const expected = order ? order.chargePaise ?? order.totalPaise : null;
        // Reconcile the captured amount against the authoritative order total.
        // A mismatch is an integrity alarm — record it and do NOT promote.
        if (order && expected != null && capturedAmount != null && capturedAmount !== expected) {
          req.log.error(
            { razorpayOrderId, capturedAmount, expected, orderId: order.id },
            "webhook: captured amount does not match order total — not confirming",
          );
        } else if (order) {
          // Guarded: only a placed order becomes preparing. Never resurrect a
          // cancelled/failed order or downgrade a later state. Capture the
          // payment id (used to issue refunds).
          const razorpayPaymentId = paymentEntity?.id ?? null;
          const updated = await db
            .update(ordersTable)
            .set({ status: "preparing", ...(razorpayPaymentId ? { razorpayPaymentId } : {}) })
            .where(and(eq(ordersTable.id, order.id), eq(ordersTable.status, "placed")))
            .returning({ id: ordersTable.id });
          // Capture confirmed: the customer paid an amount already net of the
          // company's share, so commit that share. Idempotent, and outside the
          // fresh-transition guard on purpose — losing the race to verify must
          // not skip the company charge.
          try {
            await commitSubsidyForOrder(order.id);
          } catch (err) {
            req.log.error(
              { err, orderId: order.id },
              "corporate subsidy commit failed in webhook",
            );
          }
          if (updated[0]) {
            void sendOrderConfirmation(updated[0].id).catch((err: unknown) =>
              req.log.error({ err, orderId: updated[0]!.id }, "sendOrderConfirmation failed"),
            );
            // Part 8 A4 — server-truth payment_succeeded (webhook won the
            // verify/webhook race for the placed→preparing transition).
            void emitServerEvent(
              "payment_succeeded",
              { charge_paise: order.chargePaise ?? order.totalPaise },
              order.userId,
            );
            const fullName = [result.user?.firstName, result.user?.lastName]
              .filter(Boolean)
              .join(" ");
            // Marketplace (shelf-stable goods) orders never go through the
            // kitchen — only meal orders get pushed to Petpooja.
            if (order.orderKind !== "marketplace") {
              // `req.log` is passed so the client's own diagnostics land in the
              // request log rather than nowhere: a POS rejection, and the
              // charge-not-reconciled warning, are both things ops has to see.
              pushOrderToPetpooja(order, {
                name: fullName || "Guest Customer",
                email: result.user?.email || null,
              }, req.log).catch((err) => {
                req.log.error({ err, orderId: order.id }, "webhook: failed to push order to Petpooja");
              });
            }
          } else if (order.status === "cancelled" || order.status === "failed") {
            req.log.error(
              { razorpayOrderId, orderId: order.id, status: order.status },
              "webhook: capture arrived for a cancelled/failed order — needs refund review",
            );
          }

          if (razorpayPaymentId && order.status !== "cancelled" && order.status !== "failed") {
            const creds = razorpayCredentials();
            if (creds) {
              const [kId, kSecret] = creds;
              await registerAutopayMandate(order.id, razorpayPaymentId, kId, kSecret, req.log);
            }
          }
        }
      }
    } else if (eventType === "payment_link.paid") {
      // UPI Payment Link capture. A payment link carries no razorpay order_id, so
      // it is matched to our order by `reference_id` (= externalOrderId). Without
      // this branch link captures were never reconciled and the money moved
      // silently. Reconcile against the authoritative amount and promote with the
      // same guarded transition used for payment.captured.
      const linkEntity = event.payload?.payment_link?.entity;
      const referenceId = linkEntity?.reference_id ?? "";
      const capturedAmount = paymentEntity?.amount ?? linkEntity?.amount_paid ?? null;
      if (referenceId) {
        const rows = await db
          .select({
            order: ordersTable,
            user: {
              firstName: usersTable.firstName,
              lastName: usersTable.lastName,
              email: usersTable.email,
            },
          })
          .from(ordersTable)
          .leftJoin(usersTable, eq(ordersTable.userId, usersTable.id))
          .where(eq(ordersTable.externalOrderId, referenceId))
          .limit(1);
        const result = rows[0];
        const order = result?.order;
        const expected = order ? order.chargePaise ?? order.totalPaise : null;
        if (order && !isCaptureAmountReconciled(expected, capturedAmount)) {
          // Underpayment / tamper — record the integrity alarm and do NOT promote.
          req.log.error(
            { referenceId, capturedAmount, expected, orderId: order.id },
            "webhook: payment link paid amount does not match order total — not confirming",
          );
        } else if (order) {
          const razorpayPaymentId = paymentEntity?.id ?? null;
          const updated = await db
            .update(ordersTable)
            .set({ status: "preparing", ...(razorpayPaymentId ? { razorpayPaymentId } : {}) })
            .where(and(eq(ordersTable.id, order.id), eq(ordersTable.status, "placed")))
            .returning({ id: ordersTable.id });
          // Capture confirmed: the customer paid an amount already net of the
          // company's share, so commit that share. Idempotent, and outside the
          // fresh-transition guard on purpose — losing the race to verify must
          // not skip the company charge.
          try {
            await commitSubsidyForOrder(order.id);
          } catch (err) {
            req.log.error(
              { err, orderId: order.id },
              "corporate subsidy commit failed in webhook",
            );
          }
          if (updated[0]) {
            void sendOrderConfirmation(updated[0].id).catch((err: unknown) =>
              req.log.error({ err, orderId: updated[0]!.id }, "sendOrderConfirmation failed"),
            );
            // Part 8 A4 — server-truth payment_succeeded (UPI payment-link
            // capture path; same fresh-transition guard as above).
            void emitServerEvent(
              "payment_succeeded",
              { charge_paise: order.chargePaise ?? order.totalPaise },
              order.userId,
            );
            const fullName = [result.user?.firstName, result.user?.lastName]
              .filter(Boolean)
              .join(" ");
            if (order.orderKind !== "marketplace") {
              // `req.log` is passed so the client's own diagnostics land in the
              // request log rather than nowhere: a POS rejection, and the
              // charge-not-reconciled warning, are both things ops has to see.
              pushOrderToPetpooja(order, {
                name: fullName || "Guest Customer",
                email: result.user?.email || null,
              }, req.log).catch((err) => {
                req.log.error({ err, orderId: order.id }, "webhook: failed to push order to Petpooja");
              });
            }
          } else if (order.status === "cancelled" || order.status === "failed") {
            req.log.error(
              { referenceId, orderId: order.id, status: order.status },
              "webhook: payment link capture arrived for a cancelled/failed order — needs refund review",
            );
          }
        }
      }
    } else if (eventType === "payment.failed") {
      // Mark the order failed so it leaves the active kitchen queue and the
      // client's recovery poller surfaces a terminal failure. Guarded to a
      // still-unpaid order so a retry-after-success can't flip a paid order.
      const razorpayOrderId = paymentEntity?.order_id ?? "";
      if (razorpayOrderId) {
        await db
          .update(ordersTable)
          .set({ status: "failed" })
          .where(and(eq(ordersTable.razorpayOrderId, razorpayOrderId), eq(ordersTable.status, "placed")));
      }
      req.log.warn({ razorpayOrderId }, "webhook: payment failed");
    } else if (eventType === "refund.processed" || eventType === "refund.failed") {
      // ─────────────────────────────────────────────────────────────────────
      // The refund lifecycle. Nothing here handled it before, and the console
      // (`routes/refunds.ts`) records a refund as settled the moment Razorpay's
      // POST returns 200. For `speed: "normal"` — which is what the console
      // sends — that 200 means *accepted*, not *paid*: the refund entity comes
      // back `pending` and settles over the following days. It can also fail.
      //
      // Two consequences, both money-visible:
      //
      //   * A refund that FAILED still left an `order_refunded` event on the
      //     order. That event is precisely what the payout cap subtracts, so a
      //     failed refund permanently shrank the order's refundable headroom —
      //     and the retry the operator is meant to make would be refused for
      //     "exceeds refundable balance", against money that never left. The
      //     worse the gateway failure, the more certainly that customer could
      //     never be refunded through the console again.
      //   * A refund issued straight from the Razorpay Dashboard — the thing a
      //     support agent does at 2am — was recorded nowhere at all, so the cap
      //     still believed the full amount was refundable and would send it a
      //     second time.
      //
      // So `processed` writes the refund into the ledger exactly once, and
      // `failed` unwinds the premature claim.
      const refundEntity = event.payload?.refund?.entity;
      const razorpayRefundId = refundEntity?.id ?? "";
      const refundPaymentId = refundEntity?.payment_id ?? paymentEntity?.id ?? "";
      const settled = eventType === "refund.processed";

      // Find our record of this refund. `razorpay_refund_id` is what the
      // console stores on success; `notes.refundRequestId` is the copy it puts
      // on the gateway object at creation time, which still resolves when the
      // DB write after the gateway call did not land.
      let request: typeof refundRequestsTable.$inferSelect | undefined;
      if (razorpayRefundId) {
        [request] = await db
          .select()
          .from(refundRequestsTable)
          .where(eq(refundRequestsTable.razorpayRefundId, razorpayRefundId))
          .limit(1);
      }
      if (!request) {
        const notedId = Number(refundEntity?.notes?.["refundRequestId"]);
        if (Number.isInteger(notedId) && notedId > 0) {
          [request] = await db
            .select()
            .from(refundRequestsTable)
            .where(eq(refundRequestsTable.id, notedId))
            .limit(1);
        }
      }

      // The order this refund belongs to: through our request row when we have
      // one, otherwise through the payment it was taken against. That second
      // route is what catches a refund we did not initiate.
      const [order] = request
        ? await db.select().from(ordersTable).where(eq(ordersTable.id, request.orderId)).limit(1)
        : refundPaymentId
          ? await db
              .select()
              .from(ordersTable)
              .where(eq(ordersTable.razorpayPaymentId, refundPaymentId))
              .limit(1)
          : [];

      if (!order) {
        req.log.error(
          { razorpayRefundId, refundPaymentId, eventType },
          "webhook: refund event matched neither a refund request nor a payment — reconcile by hand",
        );
      } else if (settled) {
        const keys = { razorpayRefundId, refundRequestId: request?.id ?? null };
        const existing = entriesForRefund(await orderRefundLedger(order.id), keys);
        // The gateway's own number is the authority for what actually moved;
        // our request row is the fallback when the entity is malformed.
        const entityAmount = refundEntity?.amount;
        const amountPaise =
          typeof entityAmount === "number" && Number.isInteger(entityAmount) && entityAmount > 0
            ? entityAmount
            : (request?.amountPaise ?? null);

        if (existing.length > 0) {
          // Already in the ledger — the console's optimistic write, or an
          // earlier delivery of this same event. Nothing to add; a second entry
          // would double-count against the cap.
          req.log.info(
            { razorpayRefundId, orderId: order.id },
            "webhook: refund settlement already recorded",
          );
        } else if (amountPaise == null) {
          // An amount-less refund event makes the ORDER's whole history
          // unreadable — `refundedSoFarPaise` returns null rather than guess,
          // and every later refund on this order would then be refused. Money
          // moved and we cannot say how much: alarm, but do not poison the
          // ledger.
          req.log.error(
            { razorpayRefundId, orderId: order.id },
            "webhook: refund settled with no readable amount — ledger NOT updated",
          );
        } else {
          await db.insert(deliveryEventsTable).values({
            orderId: order.id,
            event: "order_refunded",
            meta: {
              amountPaise,
              razorpayRefundId,
              settledBy: "refund.processed",
              ...(request
                ? { refundRequestId: request.id }
                : { source: "razorpay_dashboard" }),
            },
          });
        }

        if (request && request.status !== "refunded") {
          await db
            .update(refundRequestsTable)
            .set({
              status: "refunded",
              razorpayRefundId: razorpayRefundId || request.razorpayRefundId,
              note: "settled by gateway (refund.processed)",
            })
            .where(eq(refundRequestsTable.id, request.id));
        }

        // Flip the order only once the money back covers what was payable. A
        // partial refund — a goodwill ₹100 on a ₹1,200 order — is real money
        // returned but does not make this a refunded order, and saying so would
        // hide a still-live delivery from every board that filters on status.
        // (The console already flips the order at approve time regardless; that
        // asymmetry is its to fix, not this branch's to reach across into.)
        if (order.status !== "refunded") {
          const payable = resolvePayableAmountPaise(order);
          const backSoFar = refundedSoFarPaise(await orderRefundLedger(order.id));
          if (payable != null && backSoFar != null && backSoFar >= payable) {
            await db
              .update(ordersTable)
              .set({ status: "refunded" })
              .where(eq(ordersTable.id, order.id));
          }
        }
      } else {
        // refund.failed — the money did not go back. Unwind the claim.
        const keys = { razorpayRefundId, refundRequestId: request?.id ?? null };
        const claimed = entriesForRefund(await orderRefundLedger(order.id), keys);

        for (const entry of claimed) {
          // Delete and re-file, rather than annotate in place.
          // `refundedSoFarPaise` sums by event NAME, so anything left under
          // `order_refunded` keeps eating this order's headroom no matter what
          // we write into its meta — and the customer's order timeline would go
          // on showing a refund that never happened. The record is not lost: it
          // moves to `refund_reversed`, which the cap does not read.
          await db.delete(deliveryEventsTable).where(eq(deliveryEventsTable.id, entry.id));
          await db.insert(deliveryEventsTable).values({
            orderId: order.id,
            event: "refund_reversed",
            meta: {
              ...(entry.meta ?? {}),
              reversedFrom: entry.event,
              reversedAt: new Date().toISOString(),
              reason: "refund.failed",
              gatewayStatus: refundEntity?.status ?? null,
            },
          });
        }

        // Put the order back. `previousOrderStatus` is stamped by the console at
        // approve time; `cancelled` is the fallback for refunds approved before
        // that field existed, because the cancel path in `routes/orders.ts` is
        // the only production creator of refund_requests rows and it always
        // leaves the order `cancelled` — which is where an unwound refund
        // belongs. The status predicate keeps this from touching an order some
        // other path has since moved on.
        const previousOrderStatus = claimed
          .map((entry) => entry.meta?.["previousOrderStatus"])
          .find((value): value is string => typeof value === "string" && value.length > 0);
        if (order.status === "refunded") {
          await db
            .update(ordersTable)
            .set({ status: previousOrderStatus ?? "cancelled" })
            .where(and(eq(ordersTable.id, order.id), eq(ordersTable.status, "refunded")));
        }

        if (request) {
          await db
            .update(refundRequestsTable)
            .set({
              status: "failed",
              note: `gateway refund failed (${refundEntity?.status ?? "refund.failed"}) — re-approve to retry`,
            })
            .where(eq(refundRequestsTable.id, request.id));
        }

        req.log.error(
          {
            razorpayRefundId,
            orderId: order.id,
            refundRequestId: request?.id ?? null,
            reversedEvents: claimed.length,
            restoredStatus: previousOrderStatus ?? "cancelled",
          },
          "webhook: refund failed at the gateway — premature settlement reversed",
        );
      }
    }

    await db
      .update(webhookInboxTable)
      .set({ status: "processed", processedAt: new Date(), error: null, attempts: attemptsCount })
      .where(and(eq(webhookInboxTable.source, "razorpay"), eq(webhookInboxTable.eventId, eventId)));
  } catch (err) {
    processError = err instanceof Error ? err : new Error(String(err));
    req.log.error({ err, eventId, eventType }, "webhook inbox business logic failed");
    await db
      .update(webhookInboxTable)
      .set({ status: "failed", error: processError.message, attempts: attemptsCount })
      .where(and(eq(webhookInboxTable.source, "razorpay"), eq(webhookInboxTable.eventId, eventId)))
      .catch((markFailedErr: unknown) =>
        req.log.warn(
          { err: markFailedErr, eventId, eventType },
          "webhook: failed to mark inbox row as failed after a business-logic error",
        ),
      );
  }

  if (processError) {
    res.status(500).json({ error: "webhook business logic failed", eventId, processed: false });
    return;
  }
  // ACK success. Razorpay treats a missing/non-2xx response as a failed
  // delivery and retries the webhook indefinitely; without this the connection
  // hangs until timeout on every event. The inbox row is already marked
  // "processed" above, so any retry short-circuits via the dedup branch — this
  // response is what actually stops the retry loop (and is what the webhook
  // tests assert on the success path).
  res.status(200).json({ ok: true, processed: true, eventId });
});

const chargeMandateSchema = z.object({
  subscriptionId: z.number().int().positive(),
  amountPaise: z.number().int().positive(),
  scheduledChargeDate: z.string().or(z.date()),
});

/**
 * Internal/ops only — this debits a customer's stored Razorpay mandate token,
 * so it must never be reachable by an anonymous caller. `authMiddleware` is
 * attach-only (it never rejects an unauthenticated request), so the gate
 * below is the sole enforcement point.
 *
 * Meant to be called by the subscription-billing scheduler
 * (`chargeMandateScheduler.ts`, in-process — never over HTTP, so it is
 * unaffected by this gate either way) or manually by ops. Gated via
 * `requireOps` — the same ops-scope gate used by every other internal/ops-only
 * route in this codebase (see `src/lib/adminGate.ts`). Any ONE of the
 * following satisfies it:
 *   - HTTP header `x-admin-token` equal to env `RD_ADMIN_TOKEN`, or
 *   - a signed admin-session cookie (POST /admin/login), or
 *   - an authenticated user whose id is in env `OPS_USER_IDS` (comma-separated).
 * Missing/invalid credentials → 403 "ops scope required".
 */
router.post("/payments/charge-mandate", async (req: Request, res: Response) => {
  if (!(await requireOps(req, res))) return;
  const parsed = chargeMandateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid payload" });
    return;
  }

  const { subscriptionId, amountPaise, scheduledChargeDate } = parsed.data;
  const chargeDate = new Date(scheduledChargeDate);
  if (isNaN(chargeDate.getTime())) {
    res.status(400).json({ error: "invalid scheduledChargeDate" });
    return;
  }

  const result = await chargeMandateCore({
    subscriptionId,
    amountPaiseHint: amountPaise,
    requestedChargeDate: chargeDate,
    log: req.log,
  });
  res.status(result.httpStatus).json(result.body);
});

/**
 * Internal/ops only — manually triggers the pre-debit customer-notification
 * sweep (RBI-mandated notice before an autopay debit). Meant to be called by
 * the (separately wired-up) scheduler process, not end users; `authMiddleware`
 * is attach-only and never rejects, so `requireOps` below is the sole gate —
 * same convention as `/payments/charge-mandate` above and every other
 * internal/ops-only route (`src/lib/adminGate.ts`):
 *   - HTTP header `x-admin-token` equal to env `RD_ADMIN_TOKEN` (the
 *     credential the future cron/scheduler process should send), or
 *   - a signed admin-session cookie (POST /admin/login), or
 *   - an authenticated user whose id is in env `OPS_USER_IDS`.
 * Missing/invalid credentials → 403 "ops scope required".
 *
 * Also mounted with `paymentRateLimit` directly: this route's path
 * (`/jobs/...`) falls outside the `/api/payments` prefix that
 * `app.ts` rate-limits, so without this it would otherwise be exempt from
 * the per-IP payments rate limit entirely.
 */
router.post("/jobs/pre-debit-notifications", paymentRateLimit, async (req: Request, res: Response) => {
  if (!(await requireOps(req, res))) return;
  try {
    const result = await runPreDebitNotificationsSweep();
    res.json({ success: true, ...result });
  } catch (err) {
    req.log.error({ err }, "POST /jobs/pre-debit-notifications failed");
    res.status(500).json({
      error: "failed to run pre-debit notifications sweep",
      details: (err as Error).message,
    });
  }
});

export default router;

