import { Router, type Request, type Response } from "express";
import { db, paymentAttemptsTable, quotesTable, ordersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod/v4";
import crypto from "crypto";
import { calculateCartTotals } from "../lib/cartMath";

const router = Router();

const createAttemptSchema = z.object({
  quoteId: z.string().min(1),
});

router.post("/payment-attempts", async (req: Request, res: Response) => {
  const parsed = createAttemptSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "invalid payload" }); return; }
  
  const idempotencyKey = req.headers["idempotency-key"] as string;
  if (!idempotencyKey || Array.isArray(idempotencyKey)) { res.status(400).json({ error: "missing idempotency key" }); return; }
  
  // Actually, we need user. For guest, maybe customerId is a generated session id or null. 
  // Let's assume customerId is required. 
  const authUserId = req.isAuthenticated?.() ? req.user.id : "guest"; // using "guest" for simplicity in tests or require auth
  
  // Check idempotency first
  const existing = await db.select().from(paymentAttemptsTable)
    .where(and(eq(paymentAttemptsTable.customerId, authUserId), eq(paymentAttemptsTable.idempotencyKey, idempotencyKey)))
    .limit(1);
  
  if (existing.length) {
    if (existing[0].quoteId !== parsed.data.quoteId) {
      res.status(409).json({ code: "IDEMPOTENCY_KEY_REUSE_CONFLICT", error: "Idempotency key reused with different parameters" });
      return;
    }
    if (existing[0].status === "succeeded") {
      res.status(409).json({ code: "ORDER_ALREADY_CONFIRMED", paymentAttemptId: existing[0].id, status: existing[0].status, orderId: existing[0].orderId });
      return;
    }
    res.status(409).json({ code: "PAYMENT_ATTEMPT_ALREADY_EXISTS", paymentAttemptId: existing[0].id, status: existing[0].status });
    return;
  }

  const quoteRows = await db.select().from(quotesTable).where(eq(quotesTable.id, parsed.data.quoteId)).limit(1);
  if (!quoteRows.length) { res.status(404).json({ error: "quote not found" }); return; }
  
  const quote = quoteRows[0];
  if (quote.status !== "active") { res.status(409).json({ code: "quote_superseded", error: "Quote is not active" }); return; }
  if (new Date(quote.expiresAt).getTime() < Date.now()) {
    await db.update(quotesTable).set({ status: "expired" }).where(eq(quotesTable.id, quote.id));
    res.status(409).json({ code: "quote_expired", error: "Quote expired" });
    return;
  }
  
  try {
    const id = crypto.randomUUID();
    await db.insert(paymentAttemptsTable).values({
      id,
      customerId: authUserId,
      quoteId: quote.id,
      idempotencyKey,
      status: "processing"
    });
    
    // Simulate payment process
    res.status(201).json({ id, status: "processing", quoteId: quote.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    const isDuplicate = msg.includes("uniq_payment_attempts_customer_idempotency") || msg.includes("23505") || (err as any).code === "23505" || ((err as any).cause && (err as any).cause.code === "23505");
    if (isDuplicate) {
      const existingSecond = await db.select().from(paymentAttemptsTable)
        .where(and(eq(paymentAttemptsTable.customerId, authUserId), eq(paymentAttemptsTable.idempotencyKey, idempotencyKey)))
        .limit(1);
      
      if (existingSecond.length) {
        if (existingSecond[0].quoteId !== parsed.data.quoteId) {
          res.status(409).json({ code: "IDEMPOTENCY_KEY_REUSE_CONFLICT", error: "Idempotency key reused with different parameters" });
          return;
        }
        if (existingSecond[0].status === "succeeded") {
          res.status(409).json({ code: "ORDER_ALREADY_CONFIRMED", paymentAttemptId: existingSecond[0].id, status: existingSecond[0].status, orderId: existingSecond[0].orderId });
          return;
        }
        res.status(409).json({ code: "PAYMENT_ATTEMPT_ALREADY_EXISTS", paymentAttemptId: existingSecond[0].id, status: existingSecond[0].status });
        return;
      }
    }
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/payment-attempts/by-idempotency-key/:key", async (req: Request, res: Response) => {
  const authUserId = req.isAuthenticated?.() ? req.user.id : "guest";
  const idempotencyKey = req.params.key as string;
  
  const existing = await db.select().from(paymentAttemptsTable)
    .where(and(eq(paymentAttemptsTable.customerId, authUserId), eq(paymentAttemptsTable.idempotencyKey, idempotencyKey)))
    .limit(1);
    
  if (!existing.length) { res.status(404).json({ error: "not found" }); return; }
  
  const attempt = existing[0];
  res.json({ id: attempt.id, status: attempt.status, orderId: attempt.orderId });
});

router.post("/payment-attempts/:id/fail", async (req: Request, res: Response) => {
  const attemptId = req.params.id as string;
  const attempts = await db.select().from(paymentAttemptsTable).where(eq(paymentAttemptsTable.id, attemptId)).limit(1);
  if (!attempts.length) { res.status(404).json({ error: "not found" }); return; }

  const attempt = attempts[0];
  if (attempt.status === "succeeded") {
    res.status(409).json({ error: "already succeeded", code: "ORDER_ALREADY_CONFIRMED" });
    return;
  }

  await db.update(paymentAttemptsTable).set({ status: "failed" }).where(eq(paymentAttemptsTable.id, attemptId));
  
  // Release reservation by expiring the quote
  await db.update(quotesTable).set({ status: "expired" }).where(eq(quotesTable.id, attempt.quoteId));

  res.json({ ok: true, status: "failed" });
});

export default router;
