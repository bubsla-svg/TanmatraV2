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
  companiesTable,
  companyMembersTable,
  companyBudgetUsageTable,
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
/**
 * The user the test app is signed in as, or null for a guest.
 *
 * Ownership on /payments/razorpay/order means an order with a user_id can only
 * be paid by that user, so any test seeding an OWNED order has to set this (and
 * reset it afterwards) or the route answers 401 before the amount logic runs.
 */
let authedUserId: string | null = null;
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
    const r = req as unknown as {
      log: Record<string, (...a: unknown[]) => void>;
      isAuthenticated: () => boolean;
      user?: { id: string };
    };
    r.log = {
      error: () => {},
      info: () => {},
      warn: () => {},
      debug: () => {},
      trace: () => {},
      fatal: () => {},
    };
    // Session identity, driven by the module-level `authedUserId` so a single
    // test can act as a signed-in user. Default null keeps every existing test
    // a guest, which is what the guest-checkout paths below assume.
    r.isAuthenticated = () => authedUserId !== null;
    if (authedUserId !== null) r.user = { id: authedUserId };
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
    // Some tests (e.g. the charge-mandate flow) cause the server to persist
    // its own orders-table ledger row that was never tracked in
    // CREATED_ORDER_IDS; delete any leftover orders by userId first since
    // orders.user_id has no cascade.
    await db.delete(ordersTable).where(inArray(ordersTable.userId, CREATED_USER_IDS));
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
  /** Owner of the order. Needed by any path that resolves the caller's company. */
  userId?: string | null;
}): Promise<number> {
  const [row] = await db
    .insert(ordersTable)
    .values({
      externalOrderId: fields.externalOrderId,
      status: fields.status,
      razorpayOrderId: fields.razorpayOrderId ?? null,
      chargePaise: fields.chargePaise ?? null,
      totalPaise: fields.totalPaise ?? fields.chargePaise ?? 50000,
      userId: fields.userId ?? null,
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

  const scheduledChargeDate = new Date();
  await db.insert(subscriptionMandatesTable).values({
    subscriptionId,
    razorpayCustomerId: `cust_${RUN}`,
    razorpayTokenId: `tok_${RUN}`,
    status: "active",
    nextChargeAt: scheduledChargeDate,
  });

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
// 7b. The same invariant for a caller who belongs to a company with unspent
//     corporate-subsidy budget — the one principal for whom "the client sent a
//     smaller number" has a plausible-sounding excuse.
//
// Why this exists as its own case: every tamper test above uses a fixture with
// no company membership, so a change that accepts a low client amount *when the
// caller is a corporate member* passes all of them and CI stays green. A
// proposed fix for corporate double-billing did exactly that — on a mismatch it
// looked up the member's remaining monthly budget and, if the shortfall fitted,
// assigned `authoritativePaise = clientAmount` before opening the gateway
// order. The client would then be naming its own price, bounded only by the
// company's unspent monthly budget: an employee could pay ₹1 on a ₹1,000 order
// and have the company silently billed the rest, with no check that the order
// was subsidy-eligible or that the discount matched any subsidy policy.
//
// Server-owns-the-amount is not conditional on who is asking. A subsidy must be
// computed server-side from policy and reflected in the order's own
// charge_paise, never inferred from the gap between the server's number and the
// client's. This test fails any implementation that reads the client's amount as
// a subsidy signal.
// ---------------------------------------------------------------------------

test("razorpay/order ignores a tampered client amountPaise even for a corporate member with budget left", async () => {
  const externalOrderId = ext("tamper-subsidy");
  const authoritativePaise = 100000; // ₹1,000 — the real, server-priced total
  const tamperedClientAmount = 100; // ₹1 — "the rest is my company's subsidy"
  const monthlyBudgetPaise = 500000; // ₹5,000 unspent: the shortfall "fits"

  const userId = randomUUID();
  await db.insert(usersTable).values({
    id: userId,
    email: `payments-subsidy-${userId}@example.test`,
    firstName: "Corporate",
    lastName: "Member",
  });
  CREATED_USER_IDS.push(userId);

  // companies.owner_user_id and company_members.user_id both cascade from
  // users, and company_budget_usage cascades from companies, so the existing
  // CREATED_USER_IDS cleanup in after() removes all of this.
  const [company] = await db
    .insert(companiesTable)
    .values({
      slug: `subsidy-co-${RUN}`,
      name: "Subsidy Co",
      ownerUserId: userId,
      perEmployeeMonthlyBudgetPaise: monthlyBudgetPaise,
    })
    .returning({ id: companiesTable.id });
  await db.insert(companyMembersTable).values({
    companyId: company!.id,
    userId,
    email: `payments-subsidy-${userId}@example.test`,
    role: "member",
    status: "active",
  });

  const orderId = await seedOrder({
    externalOrderId,
    status: "placed",
    chargePaise: authoritativePaise,
    userId,
  });

  // The order is owned, so the route requires the owner's session. Act as the
  // member: the attack this guards against is the legitimate account holder
  // under-declaring their own amount, not an outsider paying someone else's
  // order (which the ownership check above already refuses).
  authedUserId = userId;
  let res: { status: number; json: any };
  let calls: any[];
  try {
    ({ result: res, calls } = await withMockedRazorpayFetch(
      "api.razorpay.com/v1/orders",
      (body) => ({ id: `order_mock_subsidy_${RUN}`, amount: body.amount, currency: "INR" }),
      async () => {
        const r = await fetch(`${baseUrl}/payments/razorpay/order`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            orderId: externalOrderId,
            amountPaise: tamperedClientAmount,
          }),
        });
        const json = (await r.json()) as any;
        return { status: r.status, json };
      },
    ));
  } finally {
    // Restore guest identity even on failure — every other test in this file
    // depends on it.
    authedUserId = null;
  }

  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.equal(calls.length, 1, "exactly one Razorpay order-creation call must have been made");
  assert.equal(
    calls[0].amount,
    authoritativePaise,
    "corporate membership must not turn a low client amountPaise into the billed " +
      "amount — a subsidy is computed server-side from policy and lands in the " +
      "order's charge_paise, it is never inferred from client/server divergence",
  );
  assert.notEqual(calls[0].amount, tamperedClientAmount);
  assert.equal(res.json.amount, authoritativePaise);

  // And nothing may have quietly billed the company for the difference. A
  // company charge that appears as a side effect of the customer under-paying
  // is the same defect seen from the other end of the ledger.
  const usage = await db
    .select({ spentPaise: companyBudgetUsageTable.spentPaise })
    .from(companyBudgetUsageTable)
    .where(eq(companyBudgetUsageTable.userId, userId));
  assert.equal(
    usage.length,
    0,
    "opening a gateway order must not write company budget usage; the shortfall " +
      `was ${authoritativePaise - tamperedClientAmount} paise and the company was charged for it`,
  );

  // The order's own authoritative amount must be untouched by the attempt.
  const [after] = await db
    .select({ chargePaise: ordersTable.chargePaise })
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId))
    .limit(1);
  assert.equal(after!.chargePaise, authoritativePaise);
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

  // The recurring-charge gateway flow is two calls: create an order, then
  // charge the stored token against it (see lib/chargeMandate.ts's module
  // header for why the old single-call /v1/payments/charge mock no longer
  // applies).
  const orderCalls: any[] = [];
  const recurringCalls: any[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = typeof input === "string" ? input : input.url;
    if (typeof url === "string" && url.includes("api.razorpay.com/v1/orders")) {
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      orderCalls.push(body);
      return new Response(JSON.stringify({ id: `order_mock_${RUN}` }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (typeof url === "string" && url.includes("api.razorpay.com/v1/payments/create/recurring")) {
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      recurringCalls.push(body);
      return new Response(
        JSON.stringify({ id: `pay_mock_${RUN}`, status: "captured", amount: body.amount }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    return realFetch(input, init);
  }) as typeof fetch;

  let res: { status: number; json: any };
  try {
    const r = await fetch(`${baseUrl}/payments/charge-mandate`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-token": ADMIN_TOKEN },
      body: JSON.stringify({
        subscriptionId,
        amountPaise: tamperedClientAmount,
        scheduledChargeDate: scheduledChargeDate.toISOString(),
      }),
    });
    res = { status: r.status, json: await r.json() };
  } finally {
    globalThis.fetch = realFetch;
  }

  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.equal(orderCalls.length, 1, "exactly one Razorpay order-creation call must have been made");
  assert.equal(recurringCalls.length, 1, "exactly one Razorpay recurring-charge call must have been made");
  assert.equal(
    orderCalls[0].amount,
    authoritativePaise,
    "the outbound Razorpay order must carry sub.pricePerDeliveryPaise, not the tampered client value",
  );
  assert.equal(
    recurringCalls[0].amount,
    authoritativePaise,
    "the outbound Razorpay recurring-charge request must carry sub.pricePerDeliveryPaise, not the tampered client value",
  );
  assert.notEqual(recurringCalls[0].amount, tamperedClientAmount);
  assert.equal(
    res.json.amount,
    authoritativePaise,
    "the response must echo the server-derived amount, not the tampered client value",
  );
});
