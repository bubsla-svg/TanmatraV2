import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { db, idempotencyKeysTable, webhookInboxTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { idempotencyMiddleware } from "../../artifacts/api-server/src/middlewares/idempotency";
import paymentsRouter from "../../artifacts/api-server/src/routes/payments";

async function verifySuite() {
  console.log("=== Starting REM-V5-02 Idempotency & Webhook Inbox Verification Suite ===\n");
  let passed = 0;

  process.env["RAZORPAY_WEBHOOK_SECRET"] = "verify-secret-token";

  const userId = `verify-user-${crypto.randomUUID()}`;
  let handlerRuns = 0;

  const app: Express = express();
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const r = req as unknown as {
      isAuthenticated: () => boolean;
      user?: { id: string };
      log: Record<string, (...args: unknown[]) => void>;
    };
    r.isAuthenticated = () => true;
    r.user = { id: userId };
    r.log = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      trace: () => {},
      fatal: () => {},
    };
    next();
  });

  app.use("/payments/razorpay/webhook", express.raw({ type: "application/json" }));
  app.use(express.json());
  app.use(paymentsRouter);

  app.post("/test-idempotency", idempotencyMiddleware, (req: Request, res: Response) => {
    handlerRuns++;
    res.status(201).json({
      success: true,
      run: handlerRuns,
      echo: req.body,
    });
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, () => resolve()));
  const addr = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    // -------------------------------------------------------------------------
    // Part (a): Verification of Idempotency Replay without Side Effects
    // -------------------------------------------------------------------------
    console.log("[Test 1] Verifying idempotency middleware replays cached response without re-running handler...");
    const key = `verify-idem-${crypto.randomUUID()}`;
    const payload = { item: "verification-box", count: 3 };

    const firstRes = await fetch(`${baseUrl}/test-idempotency`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": key,
      },
      body: JSON.stringify(payload),
    });

    assert.equal(firstRes.status, 201, "First request must return 201 Created");
    const firstJson = (await firstRes.json()) as { success: boolean; run: number };
    assert.equal(firstJson.success, true);
    assert.equal(firstJson.run, 1);
    assert.equal(firstRes.headers.get("idempotent-replay"), null);
    assert.equal(handlerRuns, 1, "Handler must run exactly once initially");

    const secondRes = await fetch(`${baseUrl}/test-idempotency`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": key,
      },
      body: JSON.stringify(payload),
    });

    assert.equal(secondRes.status, 201, "Replay request must return 201 Created");
    const secondJson = (await secondRes.json()) as { success: boolean; run: number };
    assert.equal(secondJson.success, true);
    assert.equal(secondJson.run, 1, "Replay response must contain the cached output (run 1)");
    assert.equal(secondRes.headers.get("idempotent-replay"), "true", "Replay header must be set to true");
    assert.equal(handlerRuns, 1, "Handler runs counter must NOT increment on replay");

    await db
      .delete(idempotencyKeysTable)
      .where(and(eq(idempotencyKeysTable.userId, userId), eq(idempotencyKeysTable.key, key)));

    console.log("  ✔ Idempotency replay and side-effect suppression verified.\n");
    passed++;

    // -------------------------------------------------------------------------
    // Part (b): Verification of Webhook Deduplication via webhook_inbox
    // -------------------------------------------------------------------------
    console.log("[Test 2] Verifying webhook deduplication via store-and-forward webhook_inbox...");
    const eventId = `evt-verify-${crypto.randomUUID()}`;
    const rawBody = Buffer.from(
      JSON.stringify({
        event: "payment.captured",
        id: eventId,
        payload: {
          payment: {
            entity: {
              id: `pay_${crypto.randomUUID()}`,
              order_id: "order_test_nonexistent",
            },
          },
        },
      }),
    );

    const sig = crypto
      .createHmac("sha256", "verify-secret-token")
      .update(rawBody)
      .digest("hex");

    const whFirstRes = await fetch(`${baseUrl}/payments/razorpay/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-razorpay-signature": sig,
      },
      body: rawBody,
    });

    assert.equal(whFirstRes.status, 200, "First webhook delivery must return 200 OK");
    const whFirstJson = (await whFirstRes.json()) as { ok: boolean; eventId: string; processed?: boolean };
    assert.equal(whFirstJson.ok, true);
    assert.equal(whFirstJson.eventId, eventId);

    const inboxRowsBefore = await db
      .select()
      .from(webhookInboxTable)
      .where(and(eq(webhookInboxTable.source, "razorpay"), eq(webhookInboxTable.eventId, eventId)));
    assert.equal(inboxRowsBefore.length, 1, "Exactly one row must be recorded in webhook_inbox");
    assert.equal(inboxRowsBefore[0]!.status, "processed");

    // Send duplicate webhook delivery
    const whSecondRes = await fetch(`${baseUrl}/payments/razorpay/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-razorpay-signature": sig,
      },
      body: rawBody,
    });

    assert.equal(whSecondRes.status, 200, "Duplicate webhook delivery must return 200 OK");
    const whSecondJson = (await whSecondRes.json()) as { ok: boolean; deduplicated?: boolean; eventId: string };
    assert.equal(whSecondJson.ok, true);
    assert.equal(whSecondJson.deduplicated, true, "Response must explicitly flag deduplicated=true");

    const inboxRowsAfter = await db
      .select()
      .from(webhookInboxTable)
      .where(and(eq(webhookInboxTable.source, "razorpay"), eq(webhookInboxTable.eventId, eventId)));
    assert.equal(inboxRowsAfter.length, 1, "Row count in webhook_inbox must remain exactly 1 after duplicate delivery");
    assert.equal(inboxRowsAfter[0]!.attempts, 1, "Business logic attempts must not re-run on duplicate");

    await db
      .delete(webhookInboxTable)
      .where(and(eq(webhookInboxTable.source, "razorpay"), eq(webhookInboxTable.eventId, eventId)));

    console.log("  ✔ Webhook deduplication via webhook_inbox verified.\n");
    passed++;

    console.log(`=== Verification Suite Passed (${passed}/${passed} tests successful) ===`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

verifySuite().catch((err) => {
  console.error("Verification Suite Failed:", err);
  process.exit(1);
});
