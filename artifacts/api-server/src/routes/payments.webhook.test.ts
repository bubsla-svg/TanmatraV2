/**
 * Automated tests for Razorpay webhook ingestion and failed business logic retry recovery.
 *
 * Run with:
 *   node --test --import tsx ./src/routes/payments.webhook.test.ts
 */

import assert from "node:assert/strict";
import { test, after, before } from "node:test";
import { randomUUID, createHmac } from "node:crypto";
import { type AddressInfo } from "node:net";
import http from "node:http";

import express, { type Express } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { db, webhookInboxTable } from "@workspace/db";

import paymentsRouter from "./payments";

const WEBHOOK_SECRET = "test_razorpay_secret_12345";
let server: http.Server;
let baseUrl = "";
const CREATED_EVENT_IDS: string[] = [];

function makeApp(): Express {
  const app = express();
  // Mount raw body parser exactly as app.ts does for webhook path
  app.use("/payments/razorpay/webhook", express.raw({ type: "application/json" }));
  app.use((req, _res, next) => {
    const r = req as unknown as { log: Record<string, (...a: unknown[]) => void> };
    r.log = {
      error: () => {},
      info: () => {},
      warn: () => {},
      debug: () => {},
      trace: () => {},
      fatal: () => {},
    };
    next();
  });
  app.use(paymentsRouter);
  return app;
}

before(() => {
  process.env["RAZORPAY_WEBHOOK_SECRET"] = WEBHOOK_SECRET;
});

await new Promise<void>((resolve) => {
  server = http.createServer(makeApp()).listen(0, () => {
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
    resolve();
  });
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  if (CREATED_EVENT_IDS.length > 0) {
    await db
      .delete(webhookInboxTable)
      .where(inArray(webhookInboxTable.eventId, CREATED_EVENT_IDS));
  }
});

function signPayload(rawString: string): string {
  return createHmac("sha256", WEBHOOK_SECRET).update(Buffer.from(rawString, "utf8")).digest("hex");
}

async function postWebhook(payloadObj: unknown, eventId?: string) {
  const rawString = JSON.stringify(payloadObj);
  const signature = signPayload(rawString);
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-razorpay-signature": signature,
  };
  if (eventId) {
    headers["x-razorpay-event-id"] = eventId;
  }

  const res = await fetch(`${baseUrl}/payments/razorpay/webhook`, {
    method: "POST",
    headers,
    body: rawString,
  });
  const json = (await res.json()) as any;
  return { status: res.status, json };
}

test("webhook normal delivery is ingested and marked processed, subsequent delivery deduplicated", async () => {
  const eventId = `evt_test_${randomUUID()}`;
  CREATED_EVENT_IDS.push(eventId);

  const payload = {
    event: "order.paid",
    payload: { payment: { entity: { id: "pay_123" } } },
  };

  // 1. Initial delivery
  const first = await postWebhook(payload, eventId);
  assert.equal(first.status, 200);
  assert.equal(first.json.ok, true);
  assert.equal(first.json.processed, true);
  assert.equal(first.json.eventId, eventId);

  const [row] = await db
    .select()
    .from(webhookInboxTable)
    .where(and(eq(webhookInboxTable.source, "razorpay"), eq(webhookInboxTable.eventId, eventId)));
  assert.ok(row);
  assert.equal(row!.status, "processed");
  assert.equal(row!.attempts, 1);
  assert.equal(row!.error, null);

  // 2. Duplicate delivery attempt when existing row is processed
  const second = await postWebhook(payload, eventId);
  assert.equal(second.status, 200);
  assert.equal(second.json.ok, true);
  assert.equal(second.json.deduplicated, true);

  // Verify attempts remained 1 in database
  const [rowAfter] = await db
    .select()
    .from(webhookInboxTable)
    .where(and(eq(webhookInboxTable.source, "razorpay"), eq(webhookInboxTable.eventId, eventId)));
  assert.equal(rowAfter!.attempts, 1);
});

test("webhook retry recovery: does not swallow retry if previous delivery failed during business logic", async () => {
  const eventId = `evt_retry_${randomUUID()}`;
  CREATED_EVENT_IDS.push(eventId);

  const payload = {
    event: "payment.captured",
    payload: { payment: { entity: { id: "pay_failed_prev", order_id: "nonexistent_ord" } } },
  };

  // Simulate an initial delivery that failed business logic leaving status 'failed' and attempts = 1
  await db.insert(webhookInboxTable).values({
    eventId,
    source: "razorpay",
    eventType: "payment.captured",
    signature: signPayload(JSON.stringify(payload)),
    payload: JSON.stringify(payload),
    status: "failed",
    error: "simulated prior network error",
    attempts: 1,
  });

  // Razorpay retries sending the exact same eventId
  const retry = await postWebhook(payload, eventId);
  assert.equal(retry.status, 200);
  assert.equal(retry.json.ok, true);
  assert.equal(retry.json.processed, true);
  assert.equal(retry.json.deduplicated, undefined, "failed row must not be skipped as deduplicated!");

  const [recoveredRow] = await db
    .select()
    .from(webhookInboxTable)
    .where(and(eq(webhookInboxTable.source, "razorpay"), eq(webhookInboxTable.eventId, eventId)));
  assert.ok(recoveredRow);
  assert.equal(recoveredRow!.status, "processed");
  assert.equal(recoveredRow!.error, null);
  assert.equal(recoveredRow!.attempts, 2, "attempts count must increment from 1 to 2");
});
