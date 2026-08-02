/**
 * Integration tests locking in the refund-after-approval pipeline
 * (artifacts/api-server/src/routes/refunds.ts) plus the cancel→refund-request
 * bridge in orders.ts:
 *
 *   - approve claims a pending request, calls Razorpay ONCE, records the
 *     gateway refund id, marks the request 'refunded' AND the order 'refunded'.
 *   - approve is idempotent: a second approve on a refunded row returns
 *     alreadyRefunded and never hits the gateway again.
 *   - approve without a captured payment id → 409 and parks the row 'failed'
 *     with no gateway call.
 *   - a gateway failure marks the request 'failed' and returns 502 without
 *     refunding the order; a 'failed' row is re-approvable and can then succeed.
 *   - reject declines the request with no gateway call and leaves the order.
 *   - the ops gate: no x-admin-token → 403 on list and approve.
 *   - cancelling a PAID order (orders.ts) raises a 'pending' refund request.
 *
 * Harness mirrors payments.integrity.test.ts (test express app, req.log stub,
 * http.createServer().listen(0), after() cleanup, direct db.insert seeding) and
 * loyalty.checkout.test.ts's per-request auth stub for the orders router.
 *
 * The Razorpay refund HTTP call is intercepted by a global `fetch` shim that
 * ONLY handles URLs containing "api.razorpay.com" and delegates every other
 * URL (the test client hitting the local server) to the real fetch. The
 * original fetch is saved at module load and restored in after().
 *
 * Run with:
 *   node --test --import tsx ./src/routes/refunds.test.ts
 */

import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";
import { type AddressInfo } from "node:net";
import http from "node:http";

import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  ordersTable,
  refundRequestsTable,
  deliveryEventsTable,
  usersTable,
  adminRolesTable,
} from "@workspace/db";

import refundsRouter from "./refunds";
import ordersRouter from "./orders";

// Match the env the run command exports; also set here so the suite is
// self-contained and the router (which reads process.env at request time)
// authenticates against these exact secrets.
const ADMIN_TOKEN = "test_admin_tok";
process.env["RD_ADMIN_TOKEN"] = ADMIN_TOKEN;
process.env["RAZORPAY_KEY_ID"] = process.env["RAZORPAY_KEY_ID"] ?? "rzp_test_x";
process.env["RAZORPAY_KEY_SECRET"] = process.env["RAZORPAY_KEY_SECRET"] ?? "secret_test";

// Unique per-run suffix so ids never collide with a concurrent run or leftover.
const RUN = randomUUID().slice(0, 8);
const ext = (name: string) => `TAN-RF-${name}-${RUN}`;

// ---------------------------------------------------------------------------
// Razorpay fetch shim — intercept ONLY api.razorpay.com, delegate the rest.
// ---------------------------------------------------------------------------
const realFetch = globalThis.fetch;

interface RzpCall {
  url: string;
  paymentId: string;
  body: any;
}
let rzpMode: "success" | "fail" = "success";
let rzpCalls: RzpCall[] = [];
let rfndSeq = 0;

function resetRzp(mode: "success" | "fail" = "success") {
  rzpMode = mode;
  rzpCalls = [];
}

globalThis.fetch = (async (input: any, init?: any) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : (input?.url ?? String(input));

  if (url.includes("api.razorpay.com")) {
    // .../v1/payments/<paymentId>/refund
    const m = url.match(/\/payments\/([^/]+)\/refund/);
    const paymentId = m ? decodeURIComponent(m[1]!) : "";
    let body: any = undefined;
    try {
      body = init?.body ? JSON.parse(String(init.body)) : undefined;
    } catch {
      body = init?.body;
    }
    rzpCalls.push({ url, paymentId, body });

    if (rzpMode === "fail") {
      return {
        ok: false,
        status: 400,
        json: async () => ({ error: {} }),
        text: async () => "{}",
      } as unknown as Response;
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: `rfnd_test_${Date.now()}_${rfndSeq++}` }),
      text: async () => "{}",
    } as unknown as Response;
  }

  // Everything else (the test client → local server) uses the real fetch.
  return realFetch(input, init);
}) as typeof fetch;

// ---------------------------------------------------------------------------
// Test app: mounts BOTH routers. A single per-request middleware stubs req.log,
// and (for the orders router) req.user / req.isAuthenticated from an
// x-test-user-id header. Admin refund requests carry x-admin-token instead and
// are gated purely by requireOps, so req.user stays undefined for them.
// ---------------------------------------------------------------------------
const USER_REGISTRY = new Map<string, { id: string }>();

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const r = req as unknown as {
      user?: unknown;
      cookies?: Record<string, string>;
      log: Record<string, (...a: unknown[]) => void>;
      isAuthenticated: () => boolean;
    };
    const headerId = req.header("x-test-user-id");
    const u = headerId ? USER_REGISTRY.get(headerId) : undefined;
    if (u) r.user = u;
    r.cookies = r.cookies ?? {};
    r.isAuthenticated = () => r.user != null;
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
  app.use(refundsRouter);
  app.use(ordersRouter);
  return app;
}

let server: http.Server;
let baseUrl = "";
const CREATED_ORDER_IDS: number[] = [];
const CREATED_USER_IDS: string[] = [];

await new Promise<void>((resolve) => {
  server = http.createServer(makeApp()).listen(0, () => {
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
    resolve();
  });
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  globalThis.fetch = realFetch;
  if (CREATED_ORDER_IDS.length > 0) {
    // delivery_events + refund_requests both FK → orders; drop them first.
    await db
      .delete(deliveryEventsTable)
      .where(inArray(deliveryEventsTable.orderId, CREATED_ORDER_IDS));
    await db
      .delete(refundRequestsTable)
      .where(inArray(refundRequestsTable.orderId, CREATED_ORDER_IDS));
    await db.delete(ordersTable).where(inArray(ordersTable.id, CREATED_ORDER_IDS));
  }
  if (CREATED_USER_IDS.length > 0) {
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
});

// ---------------------------------------------------------------------------
// Seeding + client helpers
// ---------------------------------------------------------------------------

async function seedOrder(fields: {
  externalOrderId: string;
  status: string;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  chargePaise?: number | null;
  /**
   * Defaults to chargePaise so most fixtures can set one number. Set it apart
   * from chargePaise to exercise the real schema relationship: total_paise is
   * the meal subtotal (no GST, no delivery fee) and charge_paise is what was
   * billed, so charge_paise >= total_paise on every finalized order.
   */
  totalPaise?: number | null;
  userId?: string | null;
}): Promise<number> {
  const [row] = await db
    .insert(ordersTable)
    .values({
      userId: fields.userId ?? null,
      externalOrderId: fields.externalOrderId,
      status: fields.status,
      razorpayOrderId: fields.razorpayOrderId ?? null,
      razorpayPaymentId: fields.razorpayPaymentId ?? null,
      chargePaise: fields.chargePaise ?? null,
      totalPaise: fields.totalPaise ?? fields.chargePaise ?? 50000,
      items: [],
    })
    .returning({ id: ordersTable.id });
  CREATED_ORDER_IDS.push(row!.id);
  return row!.id;
}

/**
 * Record a refund against an order the way the ops agent's `refund_order` tool
 * does — a delivery_events row, no refund_requests row involved. This is the
 * cross-path history the approve route has to read.
 */
async function seedAgentRefundEvent(orderId: number, meta: Record<string, unknown>) {
  await db.insert(deliveryEventsTable).values({ orderId, event: "refund_issued", meta });
}

async function seedRefund(fields: {
  orderId: number;
  externalOrderId: string;
  amountPaise: number;
  razorpayPaymentId?: string | null;
  status?: string;
}): Promise<number> {
  const [row] = await db
    .insert(refundRequestsTable)
    .values({
      orderId: fields.orderId,
      externalOrderId: fields.externalOrderId,
      amountPaise: fields.amountPaise,
      status: fields.status ?? "pending",
      reason: "test refund",
      razorpayPaymentId: fields.razorpayPaymentId ?? null,
      requestedBy: "test",
    })
    .returning({ id: refundRequestsTable.id });
  return row!.id;
}

async function assignRole(userId: string, role: string) {
  await db.insert(adminRolesTable).values({
    userId,
    role,
    assignedBy: null,
  });
}

async function makeUser(label: string): Promise<{ id: string }> {
  const id = randomUUID();
  await db.insert(usersTable).values({
    id,
    email: `refunds-${label}-${id}@example.test`,
    firstName: label,
  });
  CREATED_USER_IDS.push(id);
  const user = { id };
  USER_REGISTRY.set(id, user);
  return user;
}

// Seed global finance user for admin requests
const financeUser = await makeUser("finance-admin");
await assignRole(financeUser.id, "finance");

async function refundRow(id: number) {
  const [row] = await db
    .select()
    .from(refundRequestsTable)
    .where(eq(refundRequestsTable.id, id))
    .limit(1);
  return row!;
}

async function orderStatus(id: number): Promise<string> {
  const [row] = await db
    .select({ status: ordersTable.status })
    .from(ordersTable)
    .where(eq(ordersTable.id, id))
    .limit(1);
  return row!.status;
}

async function readJson(res: Awaited<ReturnType<typeof fetch>>) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

/** Admin (ops) request carrying per-operator auth or x-admin-token. */
async function admin(
  method: string,
  path: string,
  body?: unknown,
  opts: { token?: string | null; userId?: string | null } = {},
): Promise<{ status: number; json: any }> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  
  // Default to financeUser if no userId specified
  const userId = "userId" in opts ? opts.userId : financeUser.id;
  if (userId) headers["x-test-user-id"] = userId;

  const token = "token" in opts ? opts.token : ADMIN_TOKEN;
  if (token) headers["x-admin-token"] = token;

  const noBody = method === "GET" || method === "HEAD";
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: noBody ? undefined : JSON.stringify(body === undefined ? {} : body),
  });
  return { status: res.status, json: await readJson(res) };
}

/** Owner (patient) request for the orders router, authed via x-test-user-id. */
async function asUser(
  method: string,
  path: string,
  body: unknown,
  userId: string,
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-test-user-id": userId,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: await readJson(res) };
}

// ---------------------------------------------------------------------------
// 1. approve issues a refund and marks the order refunded
// ---------------------------------------------------------------------------
test("approve issues a Razorpay refund once and marks request + order refunded", async () => {
  resetRzp("success");
  const orderId = await seedOrder({
    externalOrderId: ext("approve"),
    status: "preparing",
    razorpayPaymentId: "pay_X",
    chargePaise: 50000,
  });
  const refundId = await seedRefund({
    orderId,
    externalOrderId: ext("approve"),
    amountPaise: 50000,
    razorpayPaymentId: "pay_X",
  });

  const r = await admin("POST", `/admin/refunds/${refundId}/approve`, { note: "ok to refund" });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.ok, true);
  assert.equal(r.json.refund.status, "refunded");
  assert.ok(r.json.refund.razorpayRefundId, "response must carry a razorpay_refund_id");

  // Persisted request + order both flipped to refunded.
  assert.equal((await refundRow(refundId)).status, "refunded");
  assert.equal(await orderStatus(orderId), "refunded");

  // Gateway hit exactly once, against the right payment id + amount.
  assert.equal(rzpCalls.length, 1, "Razorpay must be called exactly once");
  assert.equal(rzpCalls[0]!.paymentId, "pay_X");
  assert.equal(rzpCalls[0]!.body.amount, 50000);
});

// ---------------------------------------------------------------------------
// 2. approve is idempotent — no double refund
// ---------------------------------------------------------------------------
test("approve is idempotent: a second approve returns alreadyRefunded and does not re-hit the gateway", async () => {
  resetRzp("success");
  const orderId = await seedOrder({
    externalOrderId: ext("idem"),
    status: "preparing",
    razorpayPaymentId: "pay_IDEM",
    chargePaise: 50000,
  });
  const refundId = await seedRefund({
    orderId,
    externalOrderId: ext("idem"),
    amountPaise: 50000,
    razorpayPaymentId: "pay_IDEM",
  });

  const first = await admin("POST", `/admin/refunds/${refundId}/approve`);
  assert.equal(first.status, 200, JSON.stringify(first.json));
  assert.equal(first.json.refund.status, "refunded");
  assert.equal(rzpCalls.length, 1, "first approve hits the gateway once");

  // Second approve on the already-refunded row: idempotent success, no refund.
  const second = await admin("POST", `/admin/refunds/${refundId}/approve`);
  assert.equal(second.status, 200, JSON.stringify(second.json));
  assert.equal(second.json.alreadyRefunded, true);
  assert.equal(rzpCalls.length, 1, "second approve must NOT call the gateway again");
  assert.equal((await refundRow(refundId)).status, "refunded");
});

// ---------------------------------------------------------------------------
// 3. approve without a captured payment id → 409, no gateway call, row 'failed'
// ---------------------------------------------------------------------------
test("approve with no razorpay_payment_id → 409, no gateway call, row parked 'failed'", async () => {
  resetRzp("success");
  const orderId = await seedOrder({
    externalOrderId: ext("nopay"),
    status: "preparing",
    razorpayPaymentId: null,
    chargePaise: 50000,
  });
  const refundId = await seedRefund({
    orderId,
    externalOrderId: ext("nopay"),
    amountPaise: 50000,
    razorpayPaymentId: null,
  });

  const r = await admin("POST", `/admin/refunds/${refundId}/approve`);
  assert.equal(r.status, 409, JSON.stringify(r.json));
  assert.equal(rzpCalls.length, 0, "no captured payment ⇒ no gateway call");
  assert.equal((await refundRow(refundId)).status, "failed");
  assert.equal(await orderStatus(orderId), "preparing", "order must NOT be refunded");
});

// ---------------------------------------------------------------------------
// 4. gateway failure → 502 + 'failed'; re-approvable to success
// ---------------------------------------------------------------------------
test("gateway failure marks the request 'failed' and returns 502; a failed row is re-approvable", async () => {
  const orderId = await seedOrder({
    externalOrderId: ext("gwfail"),
    status: "preparing",
    razorpayPaymentId: "pay_GW",
    chargePaise: 50000,
  });
  const refundId = await seedRefund({
    orderId,
    externalOrderId: ext("gwfail"),
    amountPaise: 50000,
    razorpayPaymentId: "pay_GW",
  });

  // First attempt: gateway returns ok:false 400.
  resetRzp("fail");
  const failed = await admin("POST", `/admin/refunds/${refundId}/approve`);
  assert.equal(failed.status, 502, JSON.stringify(failed.json));
  assert.equal(rzpCalls.length, 1, "gateway was attempted once");
  assert.equal((await refundRow(refundId)).status, "failed");
  assert.equal(await orderStatus(orderId), "preparing", "order must NOT be refunded on gateway failure");

  // Retry from 'failed' with a now-healthy gateway → success.
  resetRzp("success");
  const ok = await admin("POST", `/admin/refunds/${refundId}/approve`);
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
  assert.equal(ok.json.refund.status, "refunded");
  assert.ok(ok.json.refund.razorpayRefundId);
  assert.equal(rzpCalls.length, 1, "retry hits the gateway exactly once");
  assert.equal((await refundRow(refundId)).status, "refunded");
  assert.equal(await orderStatus(orderId), "refunded");
});

// ---------------------------------------------------------------------------
// 5. reject declines with no gateway call
// ---------------------------------------------------------------------------
test("reject declines the request with no gateway call and leaves the order untouched", async () => {
  resetRzp("success");
  const orderId = await seedOrder({
    externalOrderId: ext("reject"),
    status: "preparing",
    razorpayPaymentId: "pay_RJ",
    chargePaise: 50000,
  });
  const refundId = await seedRefund({
    orderId,
    externalOrderId: ext("reject"),
    amountPaise: 50000,
    razorpayPaymentId: "pay_RJ",
  });

  const r = await admin("POST", `/admin/refunds/${refundId}/reject`, { note: "duplicate request" });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.refund.status, "rejected");
  assert.equal(rzpCalls.length, 0, "reject never touches the gateway");
  assert.equal((await refundRow(refundId)).status, "rejected");
  assert.equal(await orderStatus(orderId), "preparing", "rejected refund must not refund the order");
});

// ---------------------------------------------------------------------------
// 6. auth: no admin token → 403
// ---------------------------------------------------------------------------
test("ops gate: without finance role, list and approve return 403", async () => {
  resetRzp("success");
  
  // 1. x-admin-token alone (PROD-02 acceptance)
  const tokenOnly = await admin("GET", "/admin/refunds", undefined, { token: ADMIN_TOKEN, userId: null });
  assert.equal(tokenOnly.status, 403, "x-admin-token alone -> 403 for sensitive route");

  const orderId = await seedOrder({
    externalOrderId: ext("auth"),
    status: "preparing",
    razorpayPaymentId: "pay_AUTH",
    chargePaise: 50000,
  });
  const refundId = await seedRefund({
    orderId,
    externalOrderId: ext("auth"),
    amountPaise: 50000,
    razorpayPaymentId: "pay_AUTH",
  });

  const approveTokenOnly = await admin("POST", `/admin/refunds/${refundId}/approve`, {}, { token: ADMIN_TOKEN, userId: null });
  assert.equal(approveTokenOnly.status, 403, "x-admin-token alone -> 403 for sensitive approve");
  assert.equal(rzpCalls.length, 0, "an unauthorized approve must never reach the gateway");
  assert.equal((await refundRow(refundId)).status, "pending", "row must remain untouched");

  // 2. Non-finance user
  const nonFinanceUser = await makeUser("non-finance");
  const listNonFinance = await admin("GET", "/admin/refunds", undefined, { userId: nonFinanceUser.id });
  assert.equal(listNonFinance.status, 403, "non-finance user -> 403 for list");

  const approveNonFinance = await admin("POST", `/admin/refunds/${refundId}/approve`, {}, { userId: nonFinanceUser.id });
  assert.equal(approveNonFinance.status, 403, "non-finance user -> 403 for approve");
});

// ---------------------------------------------------------------------------
// 7. cancelling a PAID order raises a pending refund request (orders.ts bridge)
// ---------------------------------------------------------------------------
test("cancelling a PAID order raises a pending refund_requests row for that order", async () => {
  resetRzp("success");
  const owner = await makeUser("owner");
  const externalOrderId = ext("cancel");
  const orderId = await seedOrder({
    externalOrderId,
    status: "preparing",
    razorpayOrderId: `order_${RUN}`,
    razorpayPaymentId: "pay_Y",
    chargePaise: 40000,
    userId: owner.id,
  });

  const r = await asUser("POST", `/orders/${externalOrderId}/cancel`, { reason: "changed my mind" }, owner.id);
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.refundRequired, true);
  assert.equal(await orderStatus(orderId), "cancelled");

  const [rr] = await db
    .select()
    .from(refundRequestsTable)
    .where(eq(refundRequestsTable.orderId, orderId))
    .limit(1);
  assert.ok(rr, "cancel of a paid order must raise a refund request");
  assert.equal(rr!.status, "pending");
  assert.equal(rr!.amountPaise, 40000);
  assert.equal(rr!.razorpayPaymentId, "pay_Y");
});

// ---------------------------------------------------------------------------
// 8-12. The payout cap: approve may never send more than the order still owes.
//
// Before this guard, approve sent `refund_requests.amount_paise` to Razorpay
// having never read the order. That column is a snapshot the cancel path wrote
// and it nets off nothing already refunded — so an order the ops agent had
// already refunded still carried a full-value request here, and approve paid
// it in full.
// ---------------------------------------------------------------------------

test("cap: an amount exceeding the order's payable is refused — 409, no gateway call, row parked failed", async () => {
  resetRzp("success");
  const orderId = await seedOrder({
    externalOrderId: ext("capover"),
    status: "preparing",
    razorpayPaymentId: "pay_CAP",
    chargePaise: 40000,
  });
  // A request asking for more than the order was ever charged. However this
  // arises — a stale snapshot, a corrected charge, a hand-edited row — the
  // gateway call is the wrong place to find out.
  const refundId = await seedRefund({
    orderId,
    externalOrderId: ext("capover"),
    amountPaise: 50000,
    razorpayPaymentId: "pay_CAP",
  });

  const r = await admin("POST", `/admin/refunds/${refundId}/approve`);
  assert.equal(r.status, 409, JSON.stringify(r.json));
  assert.equal(r.json.remainingPaise, 40000, "the refusal must say how much IS refundable");
  assert.equal(r.json.requestedPaise, 50000);
  assert.equal(rzpCalls.length, 0, "an over-cap refund must never reach the gateway");
  assert.equal((await refundRow(refundId)).status, "failed");
  assert.equal(await orderStatus(orderId), "preparing", "order must NOT be marked refunded");
});

test("cap: refunds the ops agent already issued are netted off", async () => {
  resetRzp("success");
  const orderId = await seedOrder({
    externalOrderId: ext("capagent"),
    status: "preparing",
    razorpayPaymentId: "pay_AGENT",
    chargePaise: 50000,
  });
  // The agent tool refunded ₹200 of this order and recorded it under its own
  // event name. The cancel path then raised a full-value request, because it
  // reads no refund history either.
  await seedAgentRefundEvent(orderId, { amountPaise: 20000, reason: "late delivery" });
  const refundId = await seedRefund({
    orderId,
    externalOrderId: ext("capagent"),
    amountPaise: 50000,
    razorpayPaymentId: "pay_AGENT",
  });

  const r = await admin("POST", `/admin/refunds/${refundId}/approve`);
  assert.equal(r.status, 409, JSON.stringify(r.json));
  assert.equal(r.json.remainingPaise, 30000, "₹500 charged − ₹200 already refunded = ₹300 left");
  assert.equal(rzpCalls.length, 0, "the ₹700 total payout must never reach the gateway");
  assert.equal((await refundRow(refundId)).status, "failed");
});

test("cap: a request WITHIN the remaining headroom still goes through", async () => {
  // The counterpart to the test above — the cap nets, it does not simply block
  // every order with any refund history. A ₹300 request after a ₹200 agent
  // refund on a ₹500 order is exactly right and must pay out.
  resetRzp("success");
  const orderId = await seedOrder({
    externalOrderId: ext("capfits"),
    status: "preparing",
    razorpayPaymentId: "pay_FITS",
    chargePaise: 50000,
  });
  await seedAgentRefundEvent(orderId, { amountPaise: 20000, reason: "partial" });
  const refundId = await seedRefund({
    orderId,
    externalOrderId: ext("capfits"),
    amountPaise: 30000,
    razorpayPaymentId: "pay_FITS",
  });

  const r = await admin("POST", `/admin/refunds/${refundId}/approve`);
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.refund.status, "refunded");
  assert.equal(rzpCalls.length, 1);
  assert.equal(rzpCalls[0]!.body.amount, 30000);
});

test("cap: the ceiling is charge_paise, not total_paise — GST and delivery fee stay refundable", async () => {
  // The under-refund direction, and the reason the cap could not just be
  // `order.totalPaise`. total_paise is the meal subtotal; the customer paid
  // charge_paise. Capping at 40000 here would quietly keep ₹112 of their money.
  resetRzp("success");
  const orderId = await seedOrder({
    externalOrderId: ext("capgst"),
    status: "preparing",
    razorpayPaymentId: "pay_GST",
    chargePaise: 51200,
    totalPaise: 40000,
  });
  const refundId = await seedRefund({
    orderId,
    externalOrderId: ext("capgst"),
    amountPaise: 51200,
    razorpayPaymentId: "pay_GST",
  });

  const r = await admin("POST", `/admin/refunds/${refundId}/approve`);
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(rzpCalls.length, 1);
  assert.equal(rzpCalls[0]!.body.amount, 51200, "the full charged amount must be refundable");
  assert.equal(await orderStatus(orderId), "refunded");
});

test("cap: an unreadable refund history refuses rather than guessing", async () => {
  // A refund event carrying no readable amount means we cannot establish what
  // has already gone back. Treating that as zero would over-permit the very
  // number we are about to send to the gateway, so it must refuse — and the
  // note has to say why, because a human in the console is the fallback path.
  resetRzp("success");
  const orderId = await seedOrder({
    externalOrderId: ext("capunread"),
    status: "preparing",
    razorpayPaymentId: "pay_UNREAD",
    chargePaise: 50000,
  });
  await seedAgentRefundEvent(orderId, { reason: "goodwill" }); // no amountPaise
  const refundId = await seedRefund({
    orderId,
    externalOrderId: ext("capunread"),
    amountPaise: 10000,
    razorpayPaymentId: "pay_UNREAD",
  });

  const r = await admin("POST", `/admin/refunds/${refundId}/approve`);
  assert.equal(r.status, 409, JSON.stringify(r.json));
  assert.equal(rzpCalls.length, 0);
  const row = await refundRow(refundId);
  assert.equal(row.status, "failed");
  assert.match(String(row.note), /cap unknown/i);
});
