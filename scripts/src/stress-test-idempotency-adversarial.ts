/**
 * Adversarial Stress Test Suite for REM-V5-02
 *
 * Covers:
 *   1. High-concurrency identical Idempotency-Key race (N parallel requests).
 *   2. Concurrent duplicate webhook storm with identical (source, eventId).
 *   3. Adversarial HMAC forgery / signature corruption on webhook endpoint.
 *   4. Crashed in-flight lock recovery under contention.
 *
 * Run with:
 *   pnpm tsx scripts/src/stress-test-idempotency-adversarial.ts
 */

import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { db, idempotencyKeysTable, webhookInboxTable, ordersTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { idempotencyMiddleware } from "../../artifacts/api-server/src/middlewares/idempotency";
import paymentsRouter from "../../artifacts/api-server/src/routes/payments";

async function runAdversarialStressSuite() {
  console.log("=== Starting REM-V5-02 Adversarial Stress Test Suite ===\n");
  let passed = 0;

  process.env["RAZORPAY_WEBHOOK_SECRET"] = "adversarial-secret-token-v5";
  const userId = `adv-user-${crypto.randomUUID()}`;
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

  app.post("/stress-order", idempotencyMiddleware, async (req: Request, res: Response) => {
    handlerRuns++;
    // Simulate 150ms async processing delay to enlarge concurrency race window
    await new Promise((r) => setTimeout(r, 150));
    res.status(201).json({
      ok: true,
      orderId: `adv-ord-${crypto.randomUUID()}`,
      run: handlerRuns,
    });
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, () => resolve()));
  const addr = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    // -------------------------------------------------------------------------
    // Stress Test 1: N Parallel Requests with Same Idempotency-Key
    // -------------------------------------------------------------------------
    console.log("[Stress Test 1] Launching 10 concurrent requests with identical Idempotency-Key...");
    const sharedKey = `adv-idem-${crypto.randomUUID()}`;
    const payload = { item: "adversarial-packet", qty: 10 };
    handlerRuns = 0;

    const concurrency = 10;
    const requests = Array.from({ length: concurrency }, () =>
      fetch(`${baseUrl}/stress-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": sharedKey,
        },
        body: JSON.stringify(payload),
      }).then(async (r) => ({
        status: r.status,
        replay: r.headers.get("idempotent-replay"),
        json: (await r.json()) as { ok: boolean; orderId: string; run: number },
      }))
    );

    const results = await Promise.all(requests);

    // Verify all 10 completed with 201 Created and identical JSON body
    for (const res of results) {
      assert.equal(res.status, 201, "All concurrent requests must succeed with 201");
      assert.equal(res.json.orderId, results[0]!.json.orderId, "All responses must return identical orderId");
    }

    assert.equal(handlerRuns, 1, "Handler must execute exactly ONCE across 10 concurrent requests");
    const replayCount = results.filter((r) => r.replay === "true").length;
    assert.equal(replayCount, concurrency - 1, `Exactly ${concurrency - 1} requests must be marked as replays`);

    await db
      .delete(idempotencyKeysTable)
      .where(and(eq(idempotencyKeysTable.userId, userId), eq(idempotencyKeysTable.key, sharedKey)));

    console.log("  ✔ High-concurrency idempotency race passed without duplicate execution or deadlock.\n");
    passed++;

    // -------------------------------------------------------------------------
    // Stress Test 2: Concurrent Webhook Storm with Identical (source, eventId)
    // -------------------------------------------------------------------------
    console.log("[Stress Test 2] Launching 5 concurrent identical webhook deliveries...");
    const eventId = `adv-evt-${crypto.randomUUID()}`;
    const rawBody = Buffer.from(
      JSON.stringify({
        event: "payment.captured",
        id: eventId,
        payload: {
          payment: {
            entity: {
              id: `pay_${crypto.randomUUID()}`,
              order_id: `ord_${crypto.randomUUID()}`,
            },
          },
        },
      }),
    );
    const validSig = crypto
      .createHmac("sha256", "adversarial-secret-token-v5")
      .update(rawBody)
      .digest("hex");

    const webhookStorm = Array.from({ length: 5 }, () =>
      fetch(`${baseUrl}/payments/razorpay/webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-razorpay-signature": validSig,
        },
        body: rawBody,
      }).then(async (r) => ({
        status: r.status,
        json: (await r.json()) as { ok: boolean; deduplicated?: boolean; eventId: string },
      }))
    );

    const stormResults = await Promise.all(webhookStorm);
    for (const res of stormResults) {
      assert.equal(res.status, 200, "All webhook storm requests must return 200 OK");
      assert.equal(res.json.eventId, eventId);
    }

    const dedupeCount = stormResults.filter((r) => r.json.deduplicated === true).length;
    assert.equal(dedupeCount, 4, "Exactly 4 out of 5 concurrent webhooks must be flagged as deduplicated");

    const inboxRows = await db
      .select()
      .from(webhookInboxTable)
      .where(and(eq(webhookInboxTable.source, "razorpay"), eq(webhookInboxTable.eventId, eventId)));
    assert.equal(inboxRows.length, 1, "Exactly 1 row must exist in webhook_inbox after storm");

    await db
      .delete(webhookInboxTable)
      .where(and(eq(webhookInboxTable.source, "razorpay"), eq(webhookInboxTable.eventId, eventId)));

    console.log("  ✔ Concurrent webhook storm deduplicated cleanly via ON CONFLICT DO NOTHING.\n");
    passed++;

    // -------------------------------------------------------------------------
    // Stress Test 3: Adversarial HMAC Forgery Attacks
    // -------------------------------------------------------------------------
    console.log("[Stress Test 3] Testing forged/corrupted HMAC webhook signatures...");
    const forgedEventId = `adv-forged-${crypto.randomUUID()}`;
    const forgedBody = Buffer.from(
      JSON.stringify({
        event: "payment.captured",
        id: forgedEventId,
        payload: { payment: { entity: { id: "pay_hack", order_id: "ord_hack" } } },
      })
    );

    const forgedAttacks = [
      "invalid-hex-string",
      "0000000000000000000000000000000000000000000000000000000000000000",
      crypto.createHmac("sha256", "wrong-secret").update(forgedBody).digest("hex"),
    ];

    for (const badSig of forgedAttacks) {
      const badRes = await fetch(`${baseUrl}/payments/razorpay/webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-razorpay-signature": badSig,
        },
        body: forgedBody,
      });
      assert.equal(badRes.status, 400, `Forged signature '${badSig.slice(0, 10)}...' must return 400 Bad Request`);
    }

    const forgedRows = await db
      .select()
      .from(webhookInboxTable)
      .where(and(eq(webhookInboxTable.source, "razorpay"), eq(webhookInboxTable.eventId, forgedEventId)));
    assert.equal(forgedRows.length, 0, "No rows must be added to webhook_inbox for forged HMAC requests");

    console.log("  ✔ All forged HMAC signature attacks rejected with 400; inbox protected.\n");
    passed++;

    // -------------------------------------------------------------------------
    // Stress Test 4: Crashed Lock Recovery Under Contention
    // -------------------------------------------------------------------------
    console.log("[Stress Test 4] Testing recovery of stale/crashed in-flight locks (>60s old)...");
    const crashedKey = `adv-crashed-${crypto.randomUUID()}`;
    const crashedAt = new Date(Date.now() - 65_000); // 65 seconds ago

    await db.insert(idempotencyKeysTable).values({
      userId,
      key: crashedKey,
      requestHash: "stalehash123",
      statusCode: null, // Un-stamped (in-flight crash)
      responseBody: null,
      createdAt: crashedAt,
      expiresAt: new Date(Date.now() + 86400_000),
    });

    handlerRuns = 0;
    const recoveryRes = await fetch(`${baseUrl}/stress-order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": crashedKey,
      },
      body: JSON.stringify({ item: "recovered-packet" }),
    });

    assert.equal(recoveryRes.status, 201, "Recovery request must succeed with 201 Created");
    assert.equal(recoveryRes.headers.get("idempotent-replay"), null, "Recovery request executes as fresh run");
    assert.equal(handlerRuns, 1, "Handler runs once after crashed lock recovery");

    await db
      .delete(idempotencyKeysTable)
      .where(and(eq(idempotencyKeysTable.userId, userId), eq(idempotencyKeysTable.key, crashedKey)));

    console.log("  ✔ Crashed in-flight locks older than 60s recovered cleanly without lockout.\n");
    passed++;

    console.log(`=== Adversarial Stress Suite Passed (${passed}/${passed} tests successful) ===`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

runAdversarialStressSuite().catch((err) => {
  console.error("Adversarial Stress Suite Failed:", err);
  process.exit(1);
});
