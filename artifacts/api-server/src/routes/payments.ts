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
  amountPaise: z.number().int().positive().max(10_000_000),
  receipt: z.string().max(64).optional(),
  orderId: z.string().max(64).optional(),
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

  const { amountPaise, receipt } = parsed.data;

  const rpRes = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${razorpayBasicAuth(keyId, keySecret)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: "INR",
      receipt: receipt ?? `rp-${Date.now()}`,
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

  const targetOrderId = parsed.data.orderId ?? parsed.data.receipt;
  if (targetOrderId) {
    try {
      await db
        .update(ordersTable)
        .set({ razorpayOrderId: rp.id })
        .where(eq(ordersTable.externalOrderId, targetOrderId));
    } catch (err) {
      req.log.error({ err, targetOrderId, razorpayOrderId: rp.id }, "failed to store razorpayOrderId on order");
    }
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

  // Transition order to "preparing".
  try {
    const updated = await db
      .update(ordersTable)
      .set({ status: "preparing", razorpayOrderId })
      .where(eq(ordersTable.externalOrderId, orderId))
      .returning({ id: ordersTable.id });
    if (updated[0]) {
      void sendOrderConfirmation(updated[0].id);
    }
  } catch (err) {
    // Payment is confirmed by Razorpay — do not fail the response. The ops
    // team will reconcile via the Razorpay dashboard and the orders table.
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

  let event: { id?: string; event?: string; payload?: { payment?: { entity?: { order_id?: string; id?: string } } } };
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
      const razorpayPaymentId = paymentEntity?.id ?? "";
      if (razorpayOrderId) {
        const updated = await db
          .update(ordersTable)
          .set({ status: "preparing" })
          .where(eq(ordersTable.razorpayOrderId, razorpayOrderId))
          .returning({ id: ordersTable.id });
        if (updated[0]) {
          void sendOrderConfirmation(updated[0].id);
        }
      }
    } else if (eventType === "payment.failed") {
      req.log.warn({ razorpayOrderId: paymentEntity?.order_id }, "webhook: payment failed");
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
