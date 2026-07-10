import { Router, type IRouter, type Request, type Response } from "express";
import { db, ordersTable, refundRequestsTable, deliveryEventsTable } from "@workspace/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod/v4";
import { requireOps } from "../lib/adminGate";

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
  const gate = requireOps(req, res);
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
  const gate = requireOps(req, res);
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

  // Issue the refund against the payment. Idempotency-Key makes a retry safe:
  // Razorpay returns the same refund instead of creating a second one.
  let refundId: string;
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
    const refund = (await rpRes.json()) as { id: string };
    refundId = refund.id;
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
    },
  });

  res.json({ ok: true, refund: updated });
});

// ---------------------------------------------------------------------------
// POST /admin/refunds/:id/reject — decline the refund (no money moves)
// ---------------------------------------------------------------------------
router.post("/admin/refunds/:id/reject", async (req: Request, res: Response) => {
  const gate = requireOps(req, res);
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
