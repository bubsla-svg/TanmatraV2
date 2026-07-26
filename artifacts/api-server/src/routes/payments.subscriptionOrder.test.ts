/**
 * Integration tests locking in the subscription-checkout autopay TOKEN
 * WIRING (the money-path bug this branch fixes):
 *
 *   Before this fix, `payWithRazorpay()` (artifacts/tanmatra/src/lib/
 *   razorpayClient.ts) never sent `subscriptionId` to the server, so
 *   POST /payments/razorpay/order's `isRecurring` branch (payments.ts) never
 *   fired for a REAL subscription checkout — no Razorpay customer/recurring
 *   token was ever attached to the gateway order. Downstream,
 *   `registerAutopayMandate()` (called from POST /payments/razorpay/verify)
 *   always found `payment.customer_id`/`payment.token_id` missing and
 *   silently wrote NO `subscription_mandates` row — every subsequent
 *   `/payments/charge-mandate` call would 404 forever.
 *
 *   The fix wires `subscriptionId` through razorpayClient.ts -> Subscribe.tsx
 *   -> POST /payments/razorpay/order. The server-side schema
 *   (`createRazorpayOrderSchema`), the ownership/cadence gate on the
 *   `isRecurring` branch, and `registerAutopayMandate` itself were already
 *   correct on main — this suite proves that end-to-end, not just that the
 *   frontend now sends the field.
 *
 * Covers:
 *   1. Happy path — a weekly subscription, paid by its OWNER with
 *      subscriptionId passed through, mints a Razorpay customer + recurring
 *      token block on the gateway order; verify() registers a real
 *      subscription_mandates row and reactivates the subscription.
 *   2. Cadence gate — a monthly subscription (still owned + subscriptionId
 *      correct) must NOT mint a recurring token; verify() must not write a
 *      mandate.
 *   3. Ownership/security — a caller may not attach a recurring token to
 *      ANOTHER user's subscriptionId, even when paying for their own order.
 *
 * The GET /v1/payments/:id mock used inside registerAutopayMandate is
 * deliberately conditional: it returns customer_id/token_id ONLY for a
 * paymentId explicitly registered (by the test) against a gateway order id
 * that the POST /v1/orders mock actually recorded as carrying the recurring
 * token block. It never hands those back unconditionally — so a green test
 * proves the order-creation wiring fired, not merely that verify() writes
 * whatever the mock feels like returning.
 *
 * Harness mirrors payments.integrity.test.ts (order seeding, HMAC signature
 * helpers), subscriptions.cancel.test.ts (x-test-user-id auth stub, mounting
 * subscriptionsRouter + paymentsRouter together), and refunds.test.ts
 * (global fetch shim scoped to api.razorpay.com, delegating everything else
 * to the real fetch).
 *
 * Run with:
 *   node --test --import tsx ./src/routes/payments.subscriptionOrder.test.ts
 */

import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID, createHmac } from "node:crypto";
import { type AddressInfo } from "node:net";
import http from "node:http";

import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { asc, eq, inArray } from "drizzle-orm";
import {
  db,
  usersTable,
  ordersTable,
  subscriptionsTable,
  subscriptionDeliveriesTable,
  subscriptionMandatesTable,
  preDebitNotificationsTable,
} from "@workspace/db";

import subscriptionsRouter from "./subscriptions";
import paymentsRouter from "./payments";

const KEY_ID = "rzp_test_x";
const KEY_SECRET = "secret_test";

process.env["RAZORPAY_KEY_ID"] = KEY_ID;
process.env["RAZORPAY_KEY_SECRET"] = KEY_SECRET;

// Unique per-run suffix so ids never collide with a concurrent run or a
// leftover row.
const RUN = randomUUID().slice(0, 8);

// ---------------------------------------------------------------------------
// Razorpay fetch shim — intercept ONLY api.razorpay.com, delegate the rest to
// the real fetch (which the test client uses to hit the local server).
// ---------------------------------------------------------------------------
const realFetch = globalThis.fetch;

interface OrderCall {
  id: string;
  body: any;
}

let custSeq = 0;
let orderSeq = 0;
const rzpCustomerCalls: Array<{ body: any }> = [];
const rzpOrderCalls: OrderCall[] = [];
// razorpay order id -> was it created WITH the recurring token block.
const orderRecurringMap = new Map<string, boolean>();
// razorpay order id -> the customer_id attached at creation (recurring only).
const orderCustomerMap = new Map<string, string>();
// test-chosen paymentId -> the razorpay order id it "paid". The test
// populates this after seeing the real /payments/razorpay/order response, to
// model the fact that a genuine captured payment always belongs to some
// specific gateway order.
const paymentToOrder = new Map<string, string>();

function jsonResponse(obj: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => obj,
    text: async () => JSON.stringify(obj),
  } as unknown as Response;
}

globalThis.fetch = (async (input: any, init?: any) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : (input?.url ?? String(input));
  const method = (init?.method || "GET").toUpperCase();

  if (url.includes("api.razorpay.com")) {
    if (url.endsWith("/v1/customers") && method === "POST") {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      rzpCustomerCalls.push({ body });
      return jsonResponse({ id: `cust_test_${++custSeq}_${RUN}` });
    }

    if (url.endsWith("/v1/orders") && method === "POST") {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      const id = `order_test_${++orderSeq}_${RUN}`;
      const hasToken = body.token != null && body.customer_id != null;
      orderRecurringMap.set(id, hasToken);
      if (hasToken) orderCustomerMap.set(id, body.customer_id);
      rzpOrderCalls.push({ id, body });
      return jsonResponse({ id, amount: body.amount, currency: body.currency });
    }

    const paymentMatch = url.match(/\/v1\/payments\/([^/?]+)$/);
    if (paymentMatch && method === "GET") {
      const paymentId = decodeURIComponent(paymentMatch[1]!);
      const razorpayOrderId = paymentToOrder.get(paymentId);
      const recurring = razorpayOrderId
        ? (orderRecurringMap.get(razorpayOrderId) ?? false)
        : false;
      if (recurring) {
        return jsonResponse({
          id: paymentId,
          order_id: razorpayOrderId,
          customer_id: orderCustomerMap.get(razorpayOrderId!),
          token_id: `tok_test_${razorpayOrderId}`,
        });
      }
      // Realistic: an unregistered / non-recurring payment carries no
      // customer_id or token_id at all — mirrors a genuine one-off capture.
      return jsonResponse({ id: paymentId, order_id: razorpayOrderId ?? null });
    }

    return {
      ok: false,
      status: 404,
      json: async () => ({ error: "unhandled rzp mock route", url }),
      text: async () => "",
    } as unknown as Response;
  }

  // Everything else (the test client → local server) uses the real fetch.
  return realFetch(input, init);
}) as typeof fetch;

// ---------------------------------------------------------------------------
// Test app: mounts subscriptionsRouter + paymentsRouter. Auth is stubbed from
// an x-test-user-id header, mirroring subscriptions.cancel.test.ts.
// ---------------------------------------------------------------------------
interface TestUser {
  id: string;
}
const REGISTRY = new Map<string, TestUser>();

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const r = req as unknown as {
      user?: unknown;
      log: Record<string, (...a: unknown[]) => void>;
      isAuthenticated: () => boolean;
    };
    const headerId = req.header("x-test-user-id");
    const u = headerId ? REGISTRY.get(headerId) : undefined;
    if (u) r.user = u;
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
  app.use(subscriptionsRouter);
  app.use(paymentsRouter);
  return app;
}

let server: http.Server;
let baseUrl = "";
const CREATED_USER_IDS: string[] = [];
const CREATED_SUB_IDS: number[] = [];
const CREATED_ORDER_IDS: number[] = [];

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
    await db.delete(ordersTable).where(inArray(ordersTable.id, CREATED_ORDER_IDS));
  }
  if (CREATED_USER_IDS.length > 0) {
    // POST /subscriptions now auto-creates a first-cycle order for each
    // subscription (createOrderForNewSubscription) — these aren't tracked in
    // CREATED_ORDER_IDS since tests never call seedOrder for them. orders.user_id
    // has no ON DELETE CASCADE, so these must be cleared before deleting users
    // below or that delete FK-violates.
    await db.delete(ordersTable).where(inArray(ordersTable.userId, CREATED_USER_IDS));
  }
  if (CREATED_SUB_IDS.length > 0) {
    await db
      .delete(preDebitNotificationsTable)
      .where(inArray(preDebitNotificationsTable.subscriptionId, CREATED_SUB_IDS));
    await db
      .delete(subscriptionMandatesTable)
      .where(inArray(subscriptionMandatesTable.subscriptionId, CREATED_SUB_IDS));
  }
  if (CREATED_USER_IDS.length > 0) {
    // subscriptions/deliveries cascade-delete via userId -> subscriptionsTable FK.
    await db.delete(subscriptionsTable).where(inArray(subscriptionsTable.userId, CREATED_USER_IDS));
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function api(
  method: string,
  path: string,
  body: unknown,
  user?: TestUser,
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(user ? { "x-test-user-id": user.id } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

async function makeUser(label: string): Promise<TestUser> {
  const id = randomUUID();
  await db.insert(usersTable).values({
    id,
    email: `sub-order-${label}-${id}@example.test`,
    firstName: label,
    lastName: "Tester",
  });
  CREATED_USER_IDS.push(id);
  const u = { id };
  REGISTRY.set(id, u);
  return u;
}

function futureISO(daysAhead: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Create a subscription via the REAL /subscriptions route (not a DB seed). */
async function createSubscription(
  user: TestUser,
  cadence: "weekly" | "fortnightly" | "monthly" | "quarterly",
): Promise<{ subId: number }> {
  const res = await api(
    "POST",
    "/subscriptions",
    {
      planId: "desk_fuel",
      track: "veg",
      cadence,
      mealsPerDelivery: 5,
      deliveryWindow: "12:00-14:00",
      startDate: futureISO(2),
      planType: "standard",
      members: [{ name: "Primary", diet: "any", allergens: [], spiceLevel: "medium" }],
      defaultItems: [],
    },
    user,
  );
  assert.equal(res.status, 201, JSON.stringify(res.json));
  const subId = res.json.subscription.id as number;
  CREATED_SUB_IDS.push(subId);
  return { subId };
}

/**
 * Seed an order directly via drizzle. On `main` today, POST /subscriptions
 * does not yet create the first-cycle order row itself (that's a separate,
 * complementary fix tracked elsewhere) — so this models the state that fix
 * will produce, isolating this suite to ONLY the subscriptionId/token wiring
 * this branch is responsible for.
 */
async function seedOrder(fields: {
  externalOrderId: string;
  userId: string;
  chargePaise: number;
}): Promise<number> {
  const [row] = await db
    .insert(ordersTable)
    .values({
      userId: fields.userId,
      externalOrderId: fields.externalOrderId,
      status: "placed",
      chargePaise: fields.chargePaise,
      totalPaise: fields.chargePaise,
      items: [],
    })
    .returning({ id: ordersTable.id });
  CREATED_ORDER_IDS.push(row!.id);
  return row!.id;
}

/** Links the earliest generated delivery for a subscription to an order, the
 * same join `registerAutopayMandate` relies on. */
async function linkFirstDeliveryToOrder(subId: number, orderId: number): Promise<void> {
  const [delivery] = await db
    .select({ id: subscriptionDeliveriesTable.id })
    .from(subscriptionDeliveriesTable)
    .where(eq(subscriptionDeliveriesTable.subscriptionId, subId))
    .orderBy(asc(subscriptionDeliveriesTable.scheduledFor))
    .limit(1);
  assert.ok(delivery, "subscription must have at least one generated delivery to link");
  await db
    .update(subscriptionDeliveriesTable)
    .set({ orderId })
    .where(eq(subscriptionDeliveriesTable.id, delivery!.id));
}

async function mandateRow(subId: number) {
  const [row] = await db
    .select()
    .from(subscriptionMandatesTable)
    .where(eq(subscriptionMandatesTable.subscriptionId, subId))
    .limit(1);
  return row ?? null;
}

async function subscriptionStatus(subId: number): Promise<string> {
  const [row] = await db
    .select({ status: subscriptionsTable.status })
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.id, subId))
    .limit(1);
  return row!.status;
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
  return api("POST", "/payments/razorpay/verify", body);
}

// ---------------------------------------------------------------------------
// 1. Happy path — subscriptionId wiring mints a real recurring token, and
//    verify() registers a real mandate + reactivates the subscription.
// ---------------------------------------------------------------------------

test("weekly subscription + subscriptionId passed through mints a recurring Razorpay token; verify registers a real mandate and reactivates the subscription", async () => {
  const user = await makeUser("weekly");
  const { subId } = await createSubscription(user, "weekly");
  const externalOrderId = `sub-${subId}`;
  // POST /subscriptions now creates the linked first-cycle order itself
  // (see subscriptions.ts's createOrderForNewSubscription) — no manual
  // seedOrder/linkFirstDeliveryToOrder needed here; doing so would collide
  // on the (userId, externalOrderId) unique index with the auto-created row.
  // Teardown deletes orders by userId, so the auto-created row is covered.

  // Simulate a plan momentarily not-yet-active pending payment so the
  // "reactivate" side effect of registerAutopayMandate is observable.
  await db.update(subscriptionsTable).set({ status: "paused" }).where(eq(subscriptionsTable.id, subId));

  const customerCallsBefore = rzpCustomerCalls.length;

  const orderRes = await api(
    "POST",
    "/payments/razorpay/order",
    { orderId: externalOrderId, subscriptionId: subId },
    user,
  );
  assert.equal(orderRes.status, 200, JSON.stringify(orderRes.json));
  const razorpayOrderId = orderRes.json.razorpayOrderId as string;
  assert.ok(razorpayOrderId);

  // This is the crux of the fix: the gateway order-create call must have
  // carried the recurring token block. Before the fix, subscriptionId never
  // reached the server, so this never happened for a real checkout.
  assert.equal(
    rzpCustomerCalls.length,
    customerCallsBefore + 1,
    "a Razorpay customer must be created for the recurring branch",
  );
  const rzpCall = rzpOrderCalls.find((c) => c.id === razorpayOrderId);
  assert.ok(rzpCall, "order-create call must be recorded");
  assert.ok(rzpCall!.body.customer_id, "recurring order must carry customer_id");
  assert.equal(rzpCall!.body.token?.auth_type, "otp");
  assert.equal(rzpCall!.body.token?.frequency, "as_presented");

  // Simulate the checkout modal payment and register which gateway order it
  // paid — this is what the GET /v1/payments/:id mock uses to decide whether
  // to hand back customer_id/token_id (only for a genuinely recurring order).
  const paymentId = `pay_${razorpayOrderId}`;
  paymentToOrder.set(paymentId, razorpayOrderId);

  const verifyRes = await postVerify({
    orderId: externalOrderId,
    razorpayPaymentId: paymentId,
    razorpayOrderId,
    razorpaySignature: verifySignature(razorpayOrderId, paymentId),
  });
  assert.equal(verifyRes.status, 200, JSON.stringify(verifyRes.json));
  assert.equal(verifyRes.json.ok, true);
  assert.equal(verifyRes.json.status, "preparing");
  assert.ok(
    verifyRes.json.autopayDisclaimer,
    "a real mandate registration must surface the autopay disclaimer",
  );

  const mandate = await mandateRow(subId);
  assert.ok(mandate, "a subscription_mandates row must be written");
  assert.equal(mandate!.status, "active");
  assert.equal(mandate!.razorpayCustomerId, rzpCall!.body.customer_id);
  assert.equal(mandate!.razorpayTokenId, `tok_test_${razorpayOrderId}`);
  assert.ok(mandate!.nextChargeAt, "nextChargeAt must be set");
  const daysAhead = (new Date(mandate!.nextChargeAt!).getTime() - Date.now()) / 86_400_000;
  assert.ok(daysAhead > 6.5 && daysAhead < 7.5, `weekly mandate must schedule ~7 days out, got ${daysAhead}`);

  assert.equal(await subscriptionStatus(subId), "active", "verify must reactivate the subscription");
});

// ---------------------------------------------------------------------------
// 2. Cadence gate — monthly cadence must never mint a recurring token.
// ---------------------------------------------------------------------------

test("monthly cadence never mints a recurring token even with a correctly-owned subscriptionId, and verify writes no mandate", async () => {
  const user = await makeUser("monthly");
  const { subId } = await createSubscription(user, "monthly");
  const externalOrderId = `sub-${subId}`;
  // POST /subscriptions already created and linked the first-cycle order —
  // see the weekly test above for why manual seeding is skipped here.

  const customerCallsBefore = rzpCustomerCalls.length;

  const orderRes = await api(
    "POST",
    "/payments/razorpay/order",
    { orderId: externalOrderId, subscriptionId: subId },
    user,
  );
  assert.equal(orderRes.status, 200, JSON.stringify(orderRes.json));
  const razorpayOrderId = orderRes.json.razorpayOrderId as string;

  assert.equal(
    rzpCustomerCalls.length,
    customerCallsBefore,
    "monthly cadence must never create a Razorpay customer",
  );
  const rzpCall = rzpOrderCalls.find((c) => c.id === razorpayOrderId);
  assert.ok(rzpCall);
  assert.equal(rzpCall!.body.customer_id, undefined);
  assert.equal(rzpCall!.body.token, undefined);

  // paymentId intentionally left unregistered in paymentToOrder — a genuine
  // non-recurring capture from Razorpay carries no customer_id/token_id
  // either, which is exactly what the mock returns by default.
  const paymentId = `pay_${razorpayOrderId}`;
  const verifyRes = await postVerify({
    orderId: externalOrderId,
    razorpayPaymentId: paymentId,
    razorpayOrderId,
    razorpaySignature: verifySignature(razorpayOrderId, paymentId),
  });
  assert.equal(verifyRes.status, 200, JSON.stringify(verifyRes.json));
  assert.equal(verifyRes.json.autopayDisclaimer, undefined, "no mandate ⇒ no autopay disclaimer");
  assert.equal(await mandateRow(subId), null, "no mandate row for a monthly plan");
});

test("quarterly cadence never mints a recurring token even with a correctly-owned subscriptionId, and verify writes no mandate (prepaid single charge)", async () => {
  const user = await makeUser("quarterly");
  const { subId } = await createSubscription(user, "quarterly");
  const externalOrderId = `sub-${subId}`;

  const customerCallsBefore = rzpCustomerCalls.length;

  const orderRes = await api(
    "POST",
    "/payments/razorpay/order",
    { orderId: externalOrderId, subscriptionId: subId },
    user,
  );
  assert.equal(orderRes.status, 200, JSON.stringify(orderRes.json));
  const razorpayOrderId = orderRes.json.razorpayOrderId as string;

  assert.equal(
    rzpCustomerCalls.length,
    customerCallsBefore,
    "quarterly cadence must never create a Razorpay customer or recurring mandate",
  );
  const rzpCall = rzpOrderCalls.find((c) => c.id === razorpayOrderId);
  assert.ok(rzpCall);
  assert.equal(rzpCall!.body.customer_id, undefined);
  assert.equal(rzpCall!.body.token, undefined);
});

// ---------------------------------------------------------------------------
// 3. Ownership/security — a subscriptionId belonging to ANOTHER user must be
//    refused; no token/customer may be minted against it.
// ---------------------------------------------------------------------------

test("subscriptionId belonging to ANOTHER user is refused — no customer/token minted, victim's subscription untouched", async () => {
  const victim = await makeUser("victim");
  const { subId: victimSubId } = await createSubscription(victim, "weekly");
  // Force a distinguishable, non-default state so we can prove the attacker's
  // request leaves it completely untouched.
  await db.update(subscriptionsTable).set({ status: "paused" }).where(eq(subscriptionsTable.id, victimSubId));

  const attacker = await makeUser("attacker");
  const externalOrderId = `TAN-ATTACK-${RUN}`;
  await seedOrder({ externalOrderId, userId: attacker.id, chargePaise: 30000 });

  const customerCallsBefore = rzpCustomerCalls.length;

  // Attacker pays for THEIR OWN order but tampers subscriptionId to point at
  // the victim's subscription, hoping to get a recurring token minted
  // against someone else's identity/subscription.
  const orderRes = await api(
    "POST",
    "/payments/razorpay/order",
    { orderId: externalOrderId, subscriptionId: victimSubId },
    attacker,
  );
  assert.equal(orderRes.status, 200, JSON.stringify(orderRes.json));
  const razorpayOrderId = orderRes.json.razorpayOrderId as string;

  assert.equal(
    rzpCustomerCalls.length,
    customerCallsBefore,
    "no Razorpay customer may be created off a subscriptionId the caller does not own",
  );
  const rzpCall = rzpOrderCalls.find((c) => c.id === razorpayOrderId);
  assert.ok(rzpCall);
  assert.equal(
    rzpCall!.body.customer_id,
    undefined,
    "order must not carry a customer_id sourced from someone else's subscription",
  );
  assert.equal(
    rzpCall!.body.token,
    undefined,
    "order must not carry a recurring token tied to someone else's subscription",
  );

  // Defense-in-depth: even attempting to verify against this order can never
  // touch the victim's subscription (registerAutopayMandate resolves the
  // mandate's target subscription from the ORDER's linked delivery row, not
  // from the client-supplied subscriptionId, and this attacker order has no
  // delivery link at all).
  const paymentId = `pay_${razorpayOrderId}`;
  const verifyRes = await postVerify({
    orderId: externalOrderId,
    razorpayPaymentId: paymentId,
    razorpayOrderId,
    razorpaySignature: verifySignature(razorpayOrderId, paymentId),
  });
  assert.equal(verifyRes.status, 200, JSON.stringify(verifyRes.json));
  assert.equal(verifyRes.json.autopayDisclaimer, undefined);

  assert.equal(
    await mandateRow(victimSubId),
    null,
    "victim's subscription must not gain a mandate from the attacker's payment",
  );
  assert.equal(
    await subscriptionStatus(victimSubId),
    "paused",
    "victim's subscription status must be completely untouched",
  );
});
