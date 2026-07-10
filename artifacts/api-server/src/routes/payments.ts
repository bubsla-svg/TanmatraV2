import * as crypto from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { db, ordersTable, webhookInboxTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { sendOrderConfirmation } from "../lib/orderNotification";

const router: IRouter = Router();

/** Returns [keyId, keySecret] or null when either env var is absent. */
function razorpayCredentials(): [string, string] | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return [keyId, keySecret];
}

function razorpayBasicAuth(keyId: string, keySecret: string): string {
  return Buffer.from(`${keyId}:${keySecret}`).toString("base64");
}

// ---------------------------------------------------------------------------
// Schema definitions
// ---------------------------------------------------------------------------

const createRazorpayOrderSchema = z.object({
  // Retained for backward compatibility and tamper detection only — the
  // gateway order is ALWAYS created for the server-stored charge, never this.
  amountPaise: z.number().int().positive().max(10_000_000).optional(),
  receipt: z.string().max(64).optional(),
  orderId: z.string().min(1).max(64),
});

const verifyPaymentSchema = z.object({
  orderId: z.string().min(1).max(64),
  razorpayPaymentId: z.string().min(1).max(64),
  razorpayOrderId: z.string().min(1).max(64),
  razorpaySignature: z.string().min(1).max(128),
});

const upiIntentSchema = z.object({
  amountPaise: z.number().int().positive(),
  orderId: z.string().max(40),
  phone: z.string().max(20),
});

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

  const { amountPaise: clientAmount, orderId } = parsed.data;

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

  const rpRes = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${razorpayBasicAuth(keyId, keySecret)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: authoritativePaise,
      currency: "INR",
      receipt: orderId.slice(0, 40),
      payment_capture: 1,
    }),
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

  // Guarded transition placed → preparing (never downgrade a paid state).
  // Capture the payment id too — refunds are issued against it.
  try {
    const updated = await db
      .update(ordersTable)
      .set({ status: "preparing", razorpayPaymentId })
      .where(and(eq(ordersTable.id, order.id), eq(ordersTable.status, "placed")))
      .returning({ id: ordersTable.id });
    if (updated[0]) {
      void sendOrderConfirmation(updated[0].id);
    }
  } catch (err) {
    // Payment is confirmed by Razorpay — do not fail the response. The webhook
    // reconciles the status independently; ops can verify via the dashboard.
    req.log.error({ err, orderId }, "order status update failed after payment verification");
    res.json({ ok: true, orderId, status: "placed", warning: "status_update_failed" });
    return;
  }

  res.json({ ok: true, orderId, status: "preparing" });
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

  const { amountPaise, orderId, phone } = parsed.data;

  const rpRes = await fetch("https://api.razorpay.com/v1/payment_links", {
    method: "POST",
    headers: {
      Authorization: `Basic ${razorpayBasicAuth(keyId, keySecret)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: "INR",
      description: "Tanmatra Order",
      reference_id: orderId,
      customer: { contact: phone },
      options: { checkout: { method: { upi: 1 } } },
      expire_by: Math.floor(Date.now() / 1000) + 1800,
    }),
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

  let event: { id?: string; event?: string; payload?: { payment?: { entity?: { order_id?: string; id?: string; amount?: number } } } };
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
        const [order] = await db
          .select({
            id: ordersTable.id,
            status: ordersTable.status,
            chargePaise: ordersTable.chargePaise,
            totalPaise: ordersTable.totalPaise,
          })
          .from(ordersTable)
          .where(eq(ordersTable.razorpayOrderId, razorpayOrderId))
          .limit(1);
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
          if (updated[0]) {
            void sendOrderConfirmation(updated[0].id);
          } else if (order.status === "cancelled" || order.status === "failed") {
            req.log.error(
              { razorpayOrderId, orderId: order.id, status: order.status },
              "webhook: capture arrived for a cancelled/failed order — needs refund review",
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
      .catch(() => {});
  }

  if (processError) {
    res.status(500).json({ error: "webhook business logic failed", eventId, processed: false });
    return;
  }

  res.status(200).json({ ok: true, eventId, processed: true });
});

export default router;
