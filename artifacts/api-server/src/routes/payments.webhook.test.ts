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
import {
  db,
  ordersTable,
  webhookInboxTable,
  deliveryEventsTable,
  refundRequestsTable,
} from "@workspace/db";

import paymentsRouter from "./payments";
import { REFUND_EVENT_NAMES, remainingRefundablePaise } from "../lib/paymentIntegrity";

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

async function seedPlacedOrder(externalOrderId: string, totalPaise: number): Promise<number> {
  const [row] = await db
    .insert(ordersTable)
    .values({
      userId: null,
      externalOrderId,
      status: "placed",
      totalPaise,
      addressLabel: "Test",
      addressLine: "1 Test Rd",
      city: "Noida",
      pincode: "201301",
      phone: "9999999999",
      items: [{ id: 1, name: "Test Dish", qty: 1, price: totalPaise }],
      fulfillmentType: "delivery",
    })
    .returning({ id: ordersTable.id });
  return row!.id;
}

test("payment_link.paid: matching amount promotes the order (reconciled by reference_id)", async () => {
  const externalOrderId = `ord_link_ok_${randomUUID()}`;
  const eventId = `evt_link_ok_${randomUUID()}`;
  CREATED_EVENT_IDS.push(eventId);
  const orderId = await seedPlacedOrder(externalOrderId, 45000);
  try {
    const payload = {
      event: "payment_link.paid",
      payload: {
        payment_link: { entity: { id: "plink_ok", reference_id: externalOrderId, amount: 45000, amount_paid: 45000, status: "paid" } },
        payment: { entity: { id: "pay_link_ok", amount: 45000 } },
      },
    };
    const res = await postWebhook(payload, eventId);
    assert.equal(res.status, 200);
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
    assert.equal(order!.status, "preparing", "matching link payment must promote the order");
    assert.equal(order!.razorpayPaymentId, "pay_link_ok");
  } finally {
    await db.delete(ordersTable).where(eq(ordersTable.id, orderId));
  }
});

test("payment_link.paid: underpayment does NOT promote (the ₹1-for-any-order attack is blocked)", async () => {
  const externalOrderId = `ord_link_bad_${randomUUID()}`;
  const eventId = `evt_link_bad_${randomUUID()}`;
  CREATED_EVENT_IDS.push(eventId);
  const orderId = await seedPlacedOrder(externalOrderId, 45000);
  try {
    const payload = {
      event: "payment_link.paid",
      payload: {
        payment_link: { entity: { id: "plink_bad", reference_id: externalOrderId, amount: 100, amount_paid: 100, status: "paid" } },
        payment: { entity: { id: "pay_link_bad", amount: 100 } },
      },
    };
    const res = await postWebhook(payload, eventId);
    assert.equal(res.status, 200, "webhook is still accepted (ingested) — but must not confirm");
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
    assert.equal(order!.status, "placed", "underpaid link payment must NOT promote the order");
  } finally {
    await db.delete(ordersTable).where(eq(ordersTable.id, orderId));
  }
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

// ───────────────────────────────────────────────────────────────────────────
// Refund lifecycle: refund.processed / refund.failed
//
// A `speed: "normal"` refund is asynchronous. The console records settlement
// optimistically the moment Razorpay's POST returns 200, so these two events
// are what make that optimism honest — and what stops a FAILED refund from
// permanently eating the order's refundable headroom (the payout cap in
// routes/refunds.ts subtracts exactly the events asserted on here).
// ───────────────────────────────────────────────────────────────────────────

async function seedOrder(fields: {
  status: string;
  chargePaise?: number | null;
  totalPaise?: number;
  razorpayPaymentId?: string;
}): Promise<number> {
  const [row] = await db
    .insert(ordersTable)
    .values({
      userId: null,
      externalOrderId: `ord_refund_${randomUUID()}`,
      status: fields.status,
      totalPaise: fields.totalPaise ?? fields.chargePaise ?? 50000,
      chargePaise: fields.chargePaise ?? null,
      razorpayPaymentId: fields.razorpayPaymentId ?? null,
      addressLabel: "Test",
      addressLine: "1 Test Rd",
      city: "Noida",
      pincode: "201301",
      phone: "9999999999",
      items: [{ id: 1, name: "Test Dish", qty: 1, price: 50000 }],
      fulfillmentType: "delivery",
    })
    .returning({ id: ordersTable.id });
  return row!.id;
}

async function seedRefundRequest(fields: {
  orderId: number;
  amountPaise: number;
  status: string;
  razorpayRefundId?: string;
  razorpayPaymentId?: string;
}): Promise<number> {
  const [row] = await db
    .insert(refundRequestsTable)
    .values({
      orderId: fields.orderId,
      amountPaise: fields.amountPaise,
      status: fields.status,
      razorpayRefundId: fields.razorpayRefundId ?? null,
      razorpayPaymentId: fields.razorpayPaymentId ?? null,
    })
    .returning({ id: refundRequestsTable.id });
  return row!.id;
}

/** The console's optimistic settlement write, exactly as routes/refunds.ts makes it. */
async function seedOptimisticSettlement(
  orderId: number,
  meta: Record<string, unknown>,
): Promise<void> {
  await db.insert(deliveryEventsTable).values({ orderId, event: "order_refunded", meta });
}

/** Only the events the payout cap reads. */
async function refundLedger(orderId: number) {
  return db
    .select({ event: deliveryEventsTable.event, meta: deliveryEventsTable.meta })
    .from(deliveryEventsTable)
    .where(
      and(
        eq(deliveryEventsTable.orderId, orderId),
        inArray(deliveryEventsTable.event, [...REFUND_EVENT_NAMES]),
      ),
    );
}

async function allEvents(orderId: number) {
  return db
    .select({ event: deliveryEventsTable.event, meta: deliveryEventsTable.meta })
    .from(deliveryEventsTable)
    .where(eq(deliveryEventsTable.orderId, orderId));
}

async function cleanupOrder(orderId: number): Promise<void> {
  await db.delete(deliveryEventsTable).where(eq(deliveryEventsTable.orderId, orderId));
  await db.delete(refundRequestsTable).where(eq(refundRequestsTable.orderId, orderId));
  await db.delete(ordersTable).where(eq(ordersTable.id, orderId));
}

test("refund.failed: the premature settlement is reversed and the headroom comes back", async () => {
  const eventId = `evt_rfnd_fail_${randomUUID()}`;
  CREATED_EVENT_IDS.push(eventId);
  const refundId = `rfnd_fail_${randomUUID().slice(0, 8)}`;
  // charge_paise > total_paise, as on every order the loyalty finalize path
  // writes: 40000 meal + GST + fee = 51200 actually billed.
  const orderId = await seedOrder({
    status: "refunded",
    chargePaise: 51200,
    totalPaise: 40000,
    razorpayPaymentId: "pay_fail_1",
  });
  try {
    const requestId = await seedRefundRequest({
      orderId,
      amountPaise: 51200,
      status: "refunded",
      razorpayRefundId: refundId,
      razorpayPaymentId: "pay_fail_1",
    });
    await seedOptimisticSettlement(orderId, {
      refundRequestId: requestId,
      amountPaise: 51200,
      razorpayRefundId: refundId,
      approvedBy: "ops-1",
      gatewayStatus: "pending",
      previousOrderStatus: "cancelled",
    });

    const res = await postWebhook(
      {
        event: "refund.failed",
        payload: {
          refund: {
            entity: {
              id: refundId,
              payment_id: "pay_fail_1",
              amount: 51200,
              status: "failed",
              notes: { refundRequestId: String(requestId) },
            },
          },
        },
      },
      eventId,
    );
    assert.equal(res.status, 200);

    const ledger = await refundLedger(orderId);
    assert.equal(ledger.length, 0, "a failed refund must leave NOTHING the cap counts as money returned");

    const events = await allEvents(orderId);
    const reversed = events.filter((e) => e.event === "refund_reversed");
    assert.equal(reversed.length, 1, "the record is re-filed, not destroyed");
    assert.equal(reversed[0]!.meta?.["amountPaise"], 51200);
    assert.equal(reversed[0]!.meta?.["reversedFrom"], "order_refunded");
    assert.equal(reversed[0]!.meta?.["reason"], "refund.failed");

    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
    assert.equal(order!.status, "cancelled", "an order whose refund failed is not a refunded order");

    const [request] = await db
      .select()
      .from(refundRequestsTable)
      .where(eq(refundRequestsTable.id, requestId));
    assert.equal(request!.status, "failed", "failed is the re-approvable state — ops must be able to retry");
    assert.match(request!.note ?? "", /re-approve to retry/);

    // The assertion this whole branch exists for: the operator's retry is not
    // capped at zero by a refund that never happened.
    assert.equal(
      remainingRefundablePaise(
        { chargePaise: order!.chargePaise, totalPaise: order!.totalPaise },
        await refundLedger(orderId),
      ),
      51200,
      "the full charge must be refundable again after a failed refund",
    );
  } finally {
    await cleanupOrder(orderId);
  }
});

test("refund.failed: restores the status the order actually had, not a hardcoded one", async () => {
  const eventId = `evt_rfnd_prev_${randomUUID()}`;
  CREATED_EVENT_IDS.push(eventId);
  const refundId = `rfnd_prev_${randomUUID().slice(0, 8)}`;
  const orderId = await seedOrder({
    status: "refunded",
    chargePaise: 30000,
    razorpayPaymentId: "pay_prev_1",
  });
  try {
    const requestId = await seedRefundRequest({
      orderId,
      amountPaise: 30000,
      status: "refunded",
      razorpayRefundId: refundId,
    });
    // A goodwill refund raised against an order that was already delivered.
    await seedOptimisticSettlement(orderId, {
      refundRequestId: requestId,
      amountPaise: 30000,
      razorpayRefundId: refundId,
      previousOrderStatus: "delivered",
    });

    const res = await postWebhook(
      {
        event: "refund.failed",
        payload: {
          refund: { entity: { id: refundId, payment_id: "pay_prev_1", amount: 30000, status: "failed" } },
        },
      },
      eventId,
    );
    assert.equal(res.status, 200);

    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
    assert.equal(order!.status, "delivered", "a delivered order must not be filed back as cancelled");
  } finally {
    await cleanupOrder(orderId);
  }
});

test("refund.processed: a Dashboard-issued refund we never initiated is written into the ledger", async () => {
  const eventId = `evt_rfnd_dash_${randomUUID()}`;
  CREATED_EVENT_IDS.push(eventId);
  const refundId = `rfnd_dash_${randomUUID().slice(0, 8)}`;
  const paymentId = `pay_dash_${randomUUID().slice(0, 8)}`;
  const orderId = await seedOrder({
    status: "delivered",
    chargePaise: 60000,
    razorpayPaymentId: paymentId,
  });
  try {
    const res = await postWebhook(
      {
        event: "refund.processed",
        payload: {
          refund: { entity: { id: refundId, payment_id: paymentId, amount: 60000, status: "processed" } },
        },
      },
      eventId,
    );
    assert.equal(res.status, 200);

    const ledger = await refundLedger(orderId);
    assert.equal(ledger.length, 1, "a refund taken outside the console still has to reach the ledger");
    assert.equal(ledger[0]!.meta?.["amountPaise"], 60000);
    assert.equal(ledger[0]!.meta?.["source"], "razorpay_dashboard");

    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
    assert.equal(order!.status, "refunded", "a full refund settles the order");

    assert.equal(
      remainingRefundablePaise(
        { chargePaise: order!.chargePaise, totalPaise: order!.totalPaise },
        ledger,
      ),
      0,
      "the console must not be able to send this money a second time",
    );
  } finally {
    await cleanupOrder(orderId);
  }
});

test("refund.processed: a PARTIAL refund is ledgered but does not mark the order refunded", async () => {
  const eventId = `evt_rfnd_part_${randomUUID()}`;
  CREATED_EVENT_IDS.push(eventId);
  const refundId = `rfnd_part_${randomUUID().slice(0, 8)}`;
  const paymentId = `pay_part_${randomUUID().slice(0, 8)}`;
  const orderId = await seedOrder({
    status: "delivered",
    chargePaise: 60000,
    razorpayPaymentId: paymentId,
  });
  try {
    const res = await postWebhook(
      {
        event: "refund.processed",
        payload: {
          refund: { entity: { id: refundId, payment_id: paymentId, amount: 10000, status: "processed" } },
        },
      },
      eventId,
    );
    assert.equal(res.status, 200);

    const ledger = await refundLedger(orderId);
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0]!.meta?.["amountPaise"], 10000);

    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
    assert.equal(order!.status, "delivered", "₹100 back on a ₹600 order is not a refunded order");

    assert.equal(
      remainingRefundablePaise(
        { chargePaise: order!.chargePaise, totalPaise: order!.totalPaise },
        ledger,
      ),
      50000,
      "the rest of the order stays refundable",
    );
  } finally {
    await cleanupOrder(orderId);
  }
});

test("refund.processed: settlement of a refund already in the ledger is not counted twice", async () => {
  const eventId = `evt_rfnd_dup_${randomUUID()}`;
  CREATED_EVENT_IDS.push(eventId);
  const refundId = `rfnd_dup_${randomUUID().slice(0, 8)}`;
  const orderId = await seedOrder({
    status: "refunded",
    chargePaise: 51200,
    totalPaise: 40000,
    razorpayPaymentId: "pay_dup_1",
  });
  try {
    // The console already claimed settlement optimistically and left the row
    // mid-flight; this is the confirming event arriving days later.
    const requestId = await seedRefundRequest({
      orderId,
      amountPaise: 51200,
      status: "processing",
      razorpayRefundId: refundId,
    });
    await seedOptimisticSettlement(orderId, {
      refundRequestId: requestId,
      amountPaise: 51200,
      razorpayRefundId: refundId,
      gatewayStatus: "pending",
      previousOrderStatus: "cancelled",
    });

    const res = await postWebhook(
      {
        event: "refund.processed",
        payload: {
          refund: { entity: { id: refundId, payment_id: "pay_dup_1", amount: 51200, status: "processed" } },
        },
      },
      eventId,
    );
    assert.equal(res.status, 200);

    const ledger = await refundLedger(orderId);
    assert.equal(ledger.length, 1, "confirming a refund must not add a second ledger entry");
    assert.equal(
      remainingRefundablePaise({ chargePaise: 51200, totalPaise: 40000 }, ledger),
      0,
      "double-counting would drive the headroom below zero and hide a real overpayment",
    );

    const [request] = await db
      .select()
      .from(refundRequestsTable)
      .where(eq(refundRequestsTable.id, requestId));
    assert.equal(request!.status, "refunded", "the in-flight request settles on the webhook");
    assert.match(request!.note ?? "", /refund\.processed/);
  } finally {
    await cleanupOrder(orderId);
  }
});
