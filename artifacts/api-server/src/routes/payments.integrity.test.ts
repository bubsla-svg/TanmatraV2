/**
 * Integration tests locking in the money-integrity invariants of the hardened
 * Razorpay payment path (artifacts/api-server/src/routes/payments.ts):
 *
 *   - verify() binds a valid signature to the razorpay order id stored on the
 *     order, defeating the ₹1-payment signature replay against another order.
 *   - verify() is idempotent on an already-paid order and refuses a
 *     cancelled/failed order.
 *   - the webhook reconciles the captured amount against charge_paise and only
 *     promotes a still-"placed" order; it never resurrects a cancelled order.
 *   - payment.failed marks a placed order failed but leaves a paid one alone.
 *
 * Harness mirrors payments.webhook.test.ts (test express app, RAZORPAY_* env,
 * HMAC signing, seed/clean DB rows).
 *
 *   - the three money-moving *creation* endpoints (razorpay/order,
 *     upi/intent, charge-mandate) each bill a server-derived amount and
 *     silently ignore a tampered client `amountPaise` — proven end-to-end by
 *     intercepting the outbound Razorpay HTTP call and asserting on the
 *     amount actually sent to the gateway.
 *
 * Run with:
 *   node --test --import tsx ./src/routes/payments.integrity.test.ts
 */

import assert from "node:assert/strict";
import { test, after, before } from "node:test";
import { randomUUID, createHmac } from "node:crypto";
import { type AddressInfo } from "node:net";
import http from "node:http";

import express, { type Express } from "express";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  ordersTable,
  webhookInboxTable,
  usersTable,
  subscriptionsTable,
  subscriptionMandatesTable,
  preDebitNotificationsTable,
} from "@workspace/db";

import paymentsRouter from "./payments";

// Match the env the run command exports; also set here so the suite is
// self-contained and the router (which reads process.env at request time)
// verifies against these exact secrets.
const KEY_ID = "rzp_test_x";
const KEY_SECRET = "secret_test";
const WEBHOOK_SECRET = "whsec_test";
// POST /payments/charge-mandate is gated by requireOps() (see lib/adminGate.ts)
// — hasAdminToken() short-circuits isOpsRequest() before it ever touches
// req.isAuthenticated(), so the test app's minimal mock req doesn't need an
// isAuthenticated() stub as long as this header/env pair matches.
const ADMIN_TOKEN = "test-ops-token";

process.env["RAZORPAY_KEY_ID"] = KEY_ID;
process.env["RAZORPAY_KEY_SECRET"] = KEY_SECRET;
process.env["RAZORPAY_WEBHOOK_SECRET"] = WEBHOOK_SECRET;
process.env["RD_ADMIN_TOKEN"] = ADMIN_TOKEN;

let server: http.Server;
let baseUrl = "";
const CREATED_ORDER_IDS: number[] = [];
const CREATED_EVENT_IDS: string[] = [];
const CREATED_USER_IDS: string[] = [];
const CREATED_SUBSCRIPTION_IDS: number[] = [];

// Unique per-run suffix so externalOrderIds / razorpayOrderIds never collide
// with a concurrent run or a leftover row.
const RUN = randomUUID().slice(0, 8);
const ext = (name: string) => `TAN-${name}-${RUN}`;
const rzp = (name: string) => `order_${name}_${RUN}`;

function makeApp(): Express {
  const app = express();
  // Raw body for the webhook path (HMAC over the exact bytes), JSON for the
  // rest — mounted in the same order as app.ts so the JSON parser never
  // consumes the webhook body.
  app.use("/payments/razorpay/webhook", express.raw({ type: "application/json" }));
  app.use(express.json());
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
  process.env["RAZORPAY_KEY_ID"] = KEY_ID;
  process.env["RAZORPAY_KEY_SECRET"] = KEY_SECRET;
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
  if (CREATED_ORDER_IDS.length > 0) {
    await db.delete(ordersTable).where(inArray(ordersTable.id, CREATED_ORDER_IDS));
  }
  if (CREATED_EVENT_IDS.length > 0) {
    await db
      .delete(webhookInboxTable)
      .where(inArray(webhookInboxTable.eventId, CREATED_EVENT_IDS));
  }
  if (CREATED_SUBSCRIPTION_IDS.length > 0) {
    await db
      .delete(subscriptionMandatesTable)
      .where(inArray(subscriptionMandatesTable.subscriptionId, CREATED_SUBSCRIPTION_IDS));
    await db
      .delete(preDebitNotificationsTable)
      .where(inArray(preDebitNotificationsTable.subscriptionId, CREATED_SUBSCRIPTION_IDS));
    await db
      .delete(subscriptionsTable)
      .where(inArray(subscriptionsTable.id, CREATED_SUBSCRIPTION_IDS));
  }
  if (CREATED_USER_IDS.length > 0) {
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Seed an order directly via drizzle (no finalizeOrder). Returns its serial id. */
async function seedOrder(fields: {
  externalOrderId: string;
  status: string;
  razorpayOrderId?: string | null;
  chargePaise?: number | null;
  totalPaise?: number;
}): Promise<number> {
  const [row] = await db
    .insert(ordersTable)
    .values({
      externalOrderId: fields.externalOrderId,
      status: fields.status,
      razorpayOrderId: fields.razorpayOrderId ?? null,
      chargePaise: fields.chargePaise ?? null,
      totalPaise: fields.totalPaise ?? fields.chargePaise ?? 50000,
      items: [],
    })
    .returning({ id: ordersTable.id });
  CREATED_ORDER_IDS.push(row!.id);
  return row!.id;
}

async function orderStatus(id: number): Promise<string> {
  const [row] = await db
    .select({ status: ordersTable.status })
    .from(ordersTable)
    .where(eq(ordersTable.id, id))
    .limit(1);
  return row!.status;
}

/**
 * Intercepts global fetch for the duration of `fn`, routing any call whose
 * URL contains `urlSubstring` to `handler` (which returns the JSON body
 * the mocked Razorpay endpoint would send back) and recording every
 * intercepted request body in the returned `calls` array. Restores the
 * original fetch afterwards even if `fn` throws.
 */
async function withMockedRazorpayFetch<T>(
  urlSubstring: string,
  handler: (body: any) => unknown,
  fn: () => Promise<T>,
): Promise<{ result: T; calls: any[] }> {
  const calls: any[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = typeof input === "string" ? input : input.url;
    if (typeof url === "string" && url.includes(urlSubstring)) {
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      calls.push(body);
      const payload = handler(body);
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return realFetch(input, init);
  }) as typeof fetch;

  try {
    const result = await fn();
    return { result, calls };
  } finally {
    globalThis.fetch = realFetch;
  }
}

/** Seed an active user + subscription + active mandate + a valid, dispatched
 * pre-debit notification, so /payments/charge-mandate can be exercised
 * end-to-end without also testing the pre-debit guard rails. */
async function seedChargeableSubscription(pricePerDeliveryPaise: number): Promise<{
  subscriptionId: number;
  scheduledChargeDate: Date;
}> {
  const userId = randomUUID();
  await db.insert(usersTable).values({
    id: userId,
    email: `payments-integrity-${userId}@example.test`,
    firstName: "Integrity",
    lastName: "Tester",
  });
  CREATED_USER_IDS.push(userId);

  const startDate = new Date();
  const [sub] = await db
    .insert(subscriptionsTable)
    .values({
      userId,
      cadence: "weekly",
      mealsPerDelivery: 5,
      deliveryWindow: "12:00-14:00",
      status: "active",
      startDate,
      nextDeliveryAt: startDate,
      pricePerDeliveryPaise,
    })
    .returning({ id: subscriptionsTable.id });
  const subscriptionId = sub!.id;
  CREATED_SUBSCRIPTION_IDS.push(subscriptionId);

  await db.insert(subscriptionMandatesTable).values({
    subscriptionId,
    razorpayCustomerId: `cust_${RUN}`,
    razorpayTokenId: `tok_${RUN}`,
    status: "active",
  });

  const scheduledChargeDate = new Date();
  const dispatchedAt = new Date(Date.now() - 25 * 60 * 60 * 1000); // > 24h ago
  await db.insert(preDebitNotificationsTable).values({
    subscriptionId,
    scheduledChargeAt: scheduledChargeDate,
    dispatchedAt,
    status: "sent",
  });

  return { subscriptionId, scheduledChargeDate };
}

/** Razorpay's client-side signature: HMAC-SHA256("<orderId>|<paymentId>", key_secret). */
function verifySignature(razorpayOrderId: string, razorpayPaymentId: string): string {
  return createHmac("sha256", KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");
}

async function postVerify(body: {
  orderId: string;
  razorpayPaymentId: string;
  razorpayOrderId: string;
  razorpaySignature: string;
}) {
  const res = await fetch(`${baseUrl}/payments/razorpay/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as any;
  return { status: res.status, json };
}

/** Webhook body HMAC-SHA256 over the raw bytes, with the webhook secret. */
function webhookSignature(rawString: string): string {
  return createHmac("sha256", WEBHOOK_SECRET)
    .update(Buffer.from(rawString, "utf8"))
    .digest("hex");
}

async function postWebhook(payloadObj: unknown, eventId: string) {
  CREATED_EVENT_IDS.push(eventId);
  const rawString = JSON.stringify(payloadObj);
  const res = await fetch(`${baseUrl}/payments/razorpay/webhook`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-razorpay-signature": webhookSignature(rawString),
      "x-razorpay-event-id": eventId,
    },
    body: rawString,
  });
  const json = (await res.json()) as any;
  return { status: res.status, json };
}

function capturedEvent(razorpayOrderId: string, amount: number, paymentId: string) {
  return {
    event: "payment.captured",
    payload: { payment: { entity: { id: paymentId, order_id: razorpayOrderId, amount } } },
  };
}

function failedEvent(razorpayOrderId: string, paymentId: string) {
  return {
    event: "payment.failed",
    payload: { payment: { entity: { id: paymentId, order_id: razorpayOrderId } } },
  };
}

// ---------------------------------------------------------------------------
// 1. verify rejects a mismatched razorpay order id (₹1-replay attack)
// ---------------------------------------------------------------------------

test("verify rejects a valid signature bound to a DIFFERENT razorpay order id (₹1 replay)", async () => {
  const externalOrderId = ext("victim");
  const storedRzp = rzp("REAL");
  const attackerRzp = rzp("ATTACKER_1rupee");
  const id = await seedOrder({
    externalOrderId,
    status: "placed",
    chargePaise: 50000,
    razorpayOrderId: storedRzp,
  });

  // Signature is VALID for the attacker's own ₹1 order — but that order id is
  // not the one stored on TAN-victim, so it must be refused.
  const res = await postVerify({
    orderId: externalOrderId,
    razorpayPaymentId: "pay_x",
    razorpayOrderId: attackerRzp,
    razorpaySignature: verifySignature(attackerRzp, "pay_x"),
  });

  assert.equal(res.status, 400);
  assert.equal(res.json.error, "payment does not belong to this order");
  assert.equal(await orderStatus(id), "placed", "order must NOT be promoted");
});

// ---------------------------------------------------------------------------
// 2. verify happy path + idempotency
// ---------------------------------------------------------------------------

test("verify happy path promotes placed→preparing and is idempotent on replay", async () => {
  const externalOrderId = ext("ok");
  const storedRzp = rzp("OK");
  const id = await seedOrder({
    externalOrderId,
    status: "placed",
    chargePaise: 50000,
    razorpayOrderId: storedRzp,
  });

  const body = {
    orderId: externalOrderId,
    razorpayPaymentId: "pay_ok",
    razorpayOrderId: storedRzp,
    razorpaySignature: verifySignature(storedRzp, "pay_ok"),
  };

  const first = await postVerify(body);
  assert.equal(first.status, 200);
  assert.equal(first.json.ok, true);
  assert.equal(first.json.status, "preparing");
  assert.equal(await orderStatus(id), "preparing");

  // Same verify again: idempotent success (webhook/verify race), not an error.
  const second = await postVerify(body);
  assert.equal(second.status, 200);
  assert.equal(second.json.ok, true);
  assert.equal(second.json.status, "preparing");
  assert.equal(await orderStatus(id), "preparing");
});

// ---------------------------------------------------------------------------
// 3. verify refuses a cancelled order
// ---------------------------------------------------------------------------

test("verify refuses a cancelled order with 409 and does not resurrect it", async () => {
  const externalOrderId = ext("cancelled");
  const storedRzp = rzp("C");
  const id = await seedOrder({
    externalOrderId,
    status: "cancelled",
    chargePaise: 50000,
    razorpayOrderId: storedRzp,
  });

  const res = await postVerify({
    orderId: externalOrderId,
    razorpayPaymentId: "pay_c",
    razorpayOrderId: storedRzp,
    razorpaySignature: verifySignature(storedRzp, "pay_c"),
  });

  assert.equal(res.status, 409);
  assert.equal(res.json.error, "order not payable");
  assert.equal(await orderStatus(id), "cancelled");
});

// ---------------------------------------------------------------------------
// 4. webhook payment.captured reconciles the captured amount
// ---------------------------------------------------------------------------

test("webhook payment.captured ingests but does not promote on amount mismatch, promotes on match", async () => {
  const externalOrderId = ext("amt");
  const storedRzp = rzp("AMT");
  const id = await seedOrder({
    externalOrderId,
    status: "placed",
    chargePaise: 50000,
    razorpayOrderId: storedRzp,
  });

  // ₹1 captured against a ₹500 order — ingested (200) but NOT promoted.
  const mismatch = await postWebhook(
    capturedEvent(storedRzp, 100, "pay_amt_mismatch"),
    `evt_amt_mismatch_${randomUUID()}`,
  );
  assert.equal(mismatch.status, 200);
  assert.equal(mismatch.json.ok, true);
  assert.equal(mismatch.json.processed, true);
  assert.equal(await orderStatus(id), "placed", "amount mismatch must NOT promote");

  // Correct amount captured — order becomes preparing.
  const match = await postWebhook(
    capturedEvent(storedRzp, 50000, "pay_amt_match"),
    `evt_amt_match_${randomUUID()}`,
  );
  assert.equal(match.status, 200);
  assert.equal(match.json.processed, true);
  assert.equal(await orderStatus(id), "preparing", "matching amount must promote");
});

// ---------------------------------------------------------------------------
// 5. webhook payment.captured does NOT resurrect a cancelled order
// ---------------------------------------------------------------------------

test("webhook payment.captured does not resurrect a cancelled order even at the right amount", async () => {
  const externalOrderId = ext("cc");
  const storedRzp = rzp("CC");
  const id = await seedOrder({
    externalOrderId,
    status: "cancelled",
    chargePaise: 50000,
    razorpayOrderId: storedRzp,
  });

  const res = await postWebhook(
    capturedEvent(storedRzp, 50000, "pay_cc"),
    `evt_cc_${randomUUID()}`,
  );
  assert.equal(res.status, 200);
  assert.equal(res.json.processed, true);
  assert.equal(await orderStatus(id), "cancelled", "cancelled order must stay cancelled");
});

// ---------------------------------------------------------------------------
// 6. webhook payment.failed marks a placed order failed, leaves a paid one alone
// ---------------------------------------------------------------------------

test("webhook payment.failed marks a placed order failed but never flips a preparing order", async () => {
  const placedExt = ext("failed-placed");
  const placedRzp = rzp("F");
  const placedId = await seedOrder({
    externalOrderId: placedExt,
    status: "placed",
    chargePaise: 50000,
    razorpayOrderId: placedRzp,
  });

  const preparingExt = ext("failed-preparing");
  const preparingRzp = rzp("F2");
  const preparingId = await seedOrder({
    externalOrderId: preparingExt,
    status: "preparing",
    chargePaise: 50000,
    razorpayOrderId: preparingRzp,
  });

  const failPlaced = await postWebhook(
    failedEvent(placedRzp, "pay_f"),
    `evt_f_${randomUUID()}`,
  );
  assert.equal(failPlaced.status, 200);
  assert.equal(failPlaced.json.processed, true);
  assert.equal(await orderStatus(placedId), "failed", "placed order must become failed");

  const failPreparing = await postWebhook(
    failedEvent(preparingRzp, "pay_f2"),
    `evt_f2_${randomUUID()}`,
  );
  assert.equal(failPreparing.status, 200);
  assert.equal(failPreparing.json.processed, true);
  assert.equal(
    await orderStatus(preparingId),
    "preparing",
    "a paid (preparing) order must NOT be flipped to failed by a late payment.failed",
  );
});

// ---------------------------------------------------------------------------
// 7. POST /payments/razorpay/order bills the server-derived amount, not a
//    tampered client amountPaise
// ---------------------------------------------------------------------------

test("razorpay/order bills the order's authoritative chargePaise, ignoring a tampered client amountPaise", async () => {
  const externalOrderId = ext("tamper-order");
  const authoritativePaise = 63400; // ₹634 — the real, server-priced total
  const tamperedClientAmount = 1; // attacker tries to open the modal for ₹0.01

  await seedOrder({
    externalOrderId,
    status: "placed",
    chargePaise: authoritativePaise,
  });

  const { result: res, calls } = await withMockedRazorpayFetch(
    "api.razorpay.com/v1/orders",
    (body) => ({ id: `order_mock_${RUN}`, amount: body.amount, currency: "INR" }),
    async () => {
      const r = await fetch(`${baseUrl}/payments/razorpay/order`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId: externalOrderId, amountPaise: tamperedClientAmount }),
      });
      const json = (await r.json()) as any;
      return { status: r.status, json };
    },
  );

  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.equal(calls.length, 1, "exactly one Razorpay order-creation call must have been made");
  assert.equal(
    calls[0].amount,
    authoritativePaise,
    "the outbound Razorpay order request must carry the server-derived amount, not the tampered client value",
  );
  assert.notEqual(calls[0].amount, tamperedClientAmount);
  assert.equal(
    res.json.amount,
    authoritativePaise,
    "the response must echo the server-derived amount, not the tampered client value",
  );
});

// ---------------------------------------------------------------------------
// 8. POST /payments/upi/intent bills the server-derived amount, not a
//    tampered client amountPaise
// ---------------------------------------------------------------------------

test("upi/intent bills the order's authoritative payable amount, ignoring a tampered client amountPaise", async () => {
  const externalOrderId = ext("tamper-upi");
  const authoritativePaise = 78900; // ₹789 — the real, server-priced total
  const tamperedClientAmount = 1;

  await seedOrder({
    externalOrderId,
    status: "placed",
    totalPaise: authoritativePaise,
  });

  const { result: res, calls } = await withMockedRazorpayFetch(
    "api.razorpay.com/v1/payment_links",
    () => ({
      id: `plink_mock_${RUN}`,
      short_url: "https://rzp.io/i/mock",
      expire_by: Math.floor(Date.now() / 1000) + 1800,
    }),
    async () => {
      const r = await fetch(`${baseUrl}/payments/upi/intent`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderId: externalOrderId,
          amountPaise: tamperedClientAmount,
          phone: "+919999999999",
        }),
      });
      const json = (await r.json()) as any;
      return { status: r.status, json };
    },
  );

  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.equal(calls.length, 1, "exactly one Razorpay payment-link call must have been made");
  assert.equal(
    calls[0].amount,
    authoritativePaise,
    "the outbound Razorpay payment-link request must carry the server-derived amount, not the tampered client value",
  );
  assert.notEqual(calls[0].amount, tamperedClientAmount);
});

// ---------------------------------------------------------------------------
// 9. POST /payments/charge-mandate bills sub.pricePerDeliveryPaise, not a
//    tampered client amountPaise
// ---------------------------------------------------------------------------

test("charge-mandate bills the subscription's pricePerDeliveryPaise, ignoring a tampered client amountPaise", async () => {
  const authoritativePaise = 45600; // real per-delivery price
  const tamperedClientAmount = 1;

  const { subscriptionId, scheduledChargeDate } = await seedChargeableSubscription(authoritativePaise);

  const { result: res, calls } = await withMockedRazorpayFetch(
    "api.razorpay.com/v1/payments/charge",
    (body) => ({ id: `pay_mock_${RUN}`, status: "captured", amount: body.amount }),
    async () => {
      const r = await fetch(`${baseUrl}/payments/charge-mandate`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-admin-token": ADMIN_TOKEN },
        body: JSON.stringify({
          subscriptionId,
          amountPaise: tamperedClientAmount,
          scheduledChargeDate: scheduledChargeDate.toISOString(),
        }),
      });
      const json = (await r.json()) as any;
      return { status: r.status, json };
    },
  );

  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.equal(calls.length, 1, "exactly one Razorpay mandate-charge call must have been made");
  assert.equal(
    calls[0].amount,
    authoritativePaise,
    "the outbound Razorpay mandate-charge request must carry sub.pricePerDeliveryPaise, not the tampered client value",
  );
  assert.notEqual(calls[0].amount, tamperedClientAmount);
  assert.equal(
    res.json.amount,
    authoritativePaise,
    "the response must echo the server-derived amount, not the tampered client value",
  );
});
