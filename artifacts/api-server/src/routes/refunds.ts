import { Router, type IRouter, type Request, type Response } from "express";
import { db, ordersTable, refundRequestsTable, deliveryEventsTable } from "@workspace/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod/v4";
import { requireOps } from "../lib/adminGate";
import { REFUND_EVENT_NAMES, remainingRefundablePaise } from "../lib/paymentIntegrity";

const router: IRouter = Router();

/** Returns [keyId, keySecret] or null when either env var is absent. */
function razorpayCredentials(): [string, string] | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return [keyId, keySecret];
}

function basicAuth(keyId: string, keySecret: string): string {
  return Buffer.from(`${keyId}:${keySecret}`).toString("base64");
}

const listQuery = z.object({
  status: z
    .enum(["pending", "processing", "refunded", "failed", "rejected", "all"])
    .default("pending"),
});

const decideBody = z.object({
  note: z.string().max(512).optional(),
});

// ---------------------------------------------------------------------------
// GET /admin/refunds?status=pending
// ---------------------------------------------------------------------------
router.get("/admin/refunds", async (req: Request, res: Response) => {
  const gate = await requireOps(req, res);
  if (!gate) return;

  const parsed = listQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid query" });
    return;
  }
  const { status } = parsed.data;

  const rows = await db
    .select()
    .from(refundRequestsTable)
    .where(status === "all" ? undefined : eq(refundRequestsTable.status, status))
    .orderBy(desc(refundRequestsTable.createdAt))
    .limit(100);

  res.json({ refunds: rows });
});

// ---------------------------------------------------------------------------
// POST /admin/refunds/:id/approve — approve + issue the gateway refund
// ---------------------------------------------------------------------------
router.post("/admin/refunds/:id/approve", async (req: Request, res: Response) => {
  const gate = await requireOps(req, res);
  if (!gate) return;
  const operatorId = gate.operatorId ?? "operator";

  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  const parsed = decideBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "invalid payload" });
    return;
  }

  const creds = razorpayCredentials();
  if (!creds) {
    res.status(503).json({ error: "payment gateway not configured" });
    return;
  }
  const [keyId, keySecret] = creds;

  // Claim the request atomically: only a pending/failed request can be moved to
  // processing, and the UPDATE...returning guarantees exactly one caller wins.
  // This prevents two concurrent approvals from both refunding.
  const [claimed] = await db
    .update(refundRequestsTable)
    .set({ status: "processing", decidedBy: operatorId, decidedAt: new Date() })
    .where(
      and(
        eq(refundRequestsTable.id, id),
        inArray(refundRequestsTable.status, ["pending", "failed"]),
      ),
    )
    .returning();

  if (!claimed) {
    // Either it doesn't exist, or it's already refunded/processing/rejected.
    const [existing] = await db
      .select()
      .from(refundRequestsTable)
      .where(eq(refundRequestsTable.id, id))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "refund request not found" });
      return;
    }
    if (existing.status === "refunded") {
      // Idempotent success — already refunded, return the record.
      res.json({ ok: true, refund: existing, alreadyRefunded: true });
      return;
    }
    res.status(409).json({ error: "refund not in an approvable state", status: existing.status });
    return;
  }

  if (!claimed.razorpayPaymentId) {
    // Can't refund without the captured payment id. Park it back as failed so
    // ops can see why (e.g. payment id was never captured on the order).
    await db
      .update(refundRequestsTable)
      .set({ status: "failed", note: "no razorpay_payment_id on order" })
      .where(eq(refundRequestsTable.id, id));
    res.status(409).json({ error: "no captured payment to refund against" });
    return;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Cap the payout against the ORDER, not against the request row.
  //
  // Until now this route sent `claimed.amountPaise` to Razorpay having never
  // read the order it belongs to. That amount is a snapshot the cancel path
  // wrote (`routes/orders.ts` — chargePaise ?? totalPaise at cancel time), and
  // a snapshot is not an authority:
  //
  //   * It nets off nothing already refunded. The ops agent's `refund_order`
  //     tool records `refund_issued` against the order without ever touching
  //     refund_requests, so an order it has already refunded still carries a
  //     full-value pending request here, and this route pays it in full. That
  //     is a bookkeeping contradiction today — the agent tool records intent
  //     and does not call the gateway — but it is the guard that has to exist
  //     BEFORE that TODO is wired, not after.
  //   * A `failed` request is re-approvable (the claim CAS above accepts it),
  //     and "failed" includes a gateway 5xx returned after Razorpay accepted
  //     the refund. Retrying then pays a second time.
  //   * If the order's charge_paise is corrected downward after the request is
  //     raised, the stale higher number is still what gets sent.
  //
  // So re-derive the headroom from the order plus its refund history at the
  // moment of payout, and refuse — do not silently clamp — when the request
  // exceeds it. Clamping would pay a different amount than the console shows
  // its operator, which is its own kind of wrong.
  //
  // No netting of other in-flight requests is needed: `uniq_refund_requests_
  // order` allows exactly one refund_requests row per order, and the claim CAS
  // above serializes approvals of that row. There is no second request to race.
  const [order] = await db
    .select({
      chargePaise: ordersTable.chargePaise,
      totalPaise: ordersTable.totalPaise,
      // Read for the reversal path, not the cap: a `speed: normal` refund is
      // only *accepted* by the gateway here, and can still fail days later. The
      // `refund.failed` webhook has to put the order back where it was, and the
      // only moment that value is knowable is right now, before we overwrite it.
      status: ordersTable.status,
    })
    .from(ordersTable)
    .where(eq(ordersTable.id, claimed.orderId))
    .limit(1);
  const priorRefundEvents = order
    ? await db
        .select({ meta: deliveryEventsTable.meta })
        .from(deliveryEventsTable)
        .where(
          and(
            eq(deliveryEventsTable.orderId, claimed.orderId),
            inArray(deliveryEventsTable.event, [...REFUND_EVENT_NAMES]),
          ),
        )
    : [];
  const remainingPaise = order ? remainingRefundablePaise(order, priorRefundEvents) : null;
  // `!order` is already implied by `remainingPaise == null` — it is spelled out
  // so the compiler narrows `order` for the settlement block below, which needs
  // its pre-refund status.
  if (!order || remainingPaise == null || claimed.amountPaise > remainingPaise) {
    // Park it back as `failed` (re-approvable, and visible in the console with
    // the reason) rather than leaving it stuck in `processing` with no money
    // moved. A deterministic refusal will refuse again on retry — which is
    // correct: it needs the amount corrected, not another attempt.
    const note =
      remainingPaise == null
        ? "refund cap unknown: order missing or unreadable refund history"
        : `exceeds refundable balance (${remainingPaise} paise left of order)`;
    req.log.error(
      {
        refundRequestId: claimed.id,
        orderId: claimed.orderId,
        requestedPaise: claimed.amountPaise,
        remainingPaise,
      },
      "refund approval refused: amount exceeds what is still refundable on the order",
    );
    await db
      .update(refundRequestsTable)
      .set({ status: "failed", note })
      .where(eq(refundRequestsTable.id, id));
    res.status(409).json({
      error:
        remainingPaise == null
          ? "cannot establish how much is still refundable on this order"
          : "refund exceeds the amount still refundable on this order",
      requestedPaise: claimed.amountPaise,
      ...(remainingPaise == null ? {} : { remainingPaise }),
    });
    return;
  }

  // Issue the refund against the payment. Idempotency-Key makes a retry safe:
  // Razorpay returns the same refund instead of creating a second one.
  //
  // `speed: "normal"` is ASYNCHRONOUS. A 200 here means Razorpay accepted the
  // instruction, not that the customer has their money — the entity comes back
  // with status `pending` and settles over the following days, and it can still
  // fail. We nevertheless record settlement optimistically below, for one
  // reason: the reconciling webhook is not registered in every environment yet,
  // and a refund that silently sat in `processing` forever would be worse than
  // one recorded early and corrected late. `refund.processed` /`refund.failed`
  // in `routes/payments.ts` are what make that optimism safe — `failed` deletes
  // the premature `order_refunded` event (so the cap stops counting money that
  // never left) and restores `previousOrderStatus` from its meta.
  let refundId: string;
  let gatewayRefundStatus: string | null = null;
  try {
    const rpRes = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(claimed.razorpayPaymentId)}/refund`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth(keyId, keySecret)}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `refund-${claimed.id}`,
        },
        body: JSON.stringify({
          amount: claimed.amountPaise,
          speed: "normal",
          notes: { orderId: claimed.externalOrderId ?? "", refundRequestId: String(claimed.id) },
        }),
      },
    );
    if (!rpRes.ok) {
      let body: unknown;
      try { body = await rpRes.json(); } catch { body = await rpRes.text(); }
      req.log.error({ status: rpRes.status, body, refundId: claimed.id }, "razorpay refund failed");
      await db
        .update(refundRequestsTable)
        .set({ status: "failed", note: `gateway ${rpRes.status}` })
        .where(eq(refundRequestsTable.id, id));
      res.status(502).json({ error: "payment gateway error" });
      return;
    }
    const refund = (await rpRes.json()) as { id: string; status?: string };
    refundId = refund.id;
    gatewayRefundStatus = typeof refund.status === "string" ? refund.status : null;
  } catch (err) {
    req.log.error({ err, refundId: claimed.id }, "razorpay refund threw");
    await db
      .update(refundRequestsTable)
      .set({ status: "failed", note: "gateway unreachable" })
      .where(eq(refundRequestsTable.id, id));
    res.status(502).json({ error: "payment gateway unreachable" });
    return;
  }

  // Success — record the gateway refund, mark the order refunded, and audit.
  const [updated] = await db
    .update(refundRequestsTable)
    .set({ status: "refunded", razorpayRefundId: refundId, note: parsed.data.note ?? null })
    .where(eq(refundRequestsTable.id, id))
    .returning();
  await db
    .update(ordersTable)
    .set({ status: "refunded" })
    .where(eq(ordersTable.id, claimed.orderId));
  await db.insert(deliveryEventsTable).values({
    orderId: claimed.orderId,
    event: "order_refunded",
    meta: {
      refundRequestId: claimed.id,
      amountPaise: claimed.amountPaise,
      razorpayRefundId: refundId,
      approvedBy: operatorId,
      // What the gateway actually said when it accepted the instruction —
      // usually "pending" for speed: normal. Recorded so this row does not
      // read as a settlement it has not yet earned.
      gatewayStatus: gatewayRefundStatus,
      // The order's status immediately before this line overwrote it. The
      // `refund.failed` webhook restores it; without it a failed refund leaves
      // the order permanently displaying "refunded" with no money returned.
      previousOrderStatus: order.status,
    },
  });

  res.json({ ok: true, refund: updated });
});

// ---------------------------------------------------------------------------
// POST /admin/refunds/:id/reject — decline the refund (no money moves)
// ---------------------------------------------------------------------------
router.post("/admin/refunds/:id/reject", async (req: Request, res: Response) => {
  const gate = await requireOps(req, res);
  if (!gate) return;
  const operatorId = gate.operatorId ?? "operator";

  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  const parsed = decideBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "invalid payload" });
    return;
  }

  const [updated] = await db
    .update(refundRequestsTable)
    .set({ status: "rejected", decidedBy: operatorId, decidedAt: new Date(), note: parsed.data.note ?? null })
    .where(
      and(
        eq(refundRequestsTable.id, id),
        inArray(refundRequestsTable.status, ["pending", "failed"]),
      ),
    )
    .returning();

  if (!updated) {
    res.status(409).json({ error: "refund not in a rejectable state" });
    return;
  }
  res.json({ ok: true, refund: updated });
});

export default router;
