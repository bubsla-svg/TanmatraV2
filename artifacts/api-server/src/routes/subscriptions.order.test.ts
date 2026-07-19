/**
 * Integration tests for the subscription-order money-path fix:
 *
 *   POST /subscriptions previously created only subscriptionsTable +
 *   subscriptionDeliveriesTable rows, never an ordersTable row — so a
 *   brand-new subscription's first-cycle payment attempt
 *   (payWithRazorpay({ orderId: "sub-<id>" }) → POST /payments/razorpay/order)
 *   always 404'd, because that route resolves the charge by looking up
 *   `ordersTable.externalOrderId`.
 *
 * This suite locks in the fix:
 *
 *   1. POST /subscriptions now also creates a linked ordersTable row
 *      (externalOrderId = "sub-<id>") priced from the server-computed
 *      pricePerDeliveryPaise (flat per-meal rate), and links it to the
 *      earliest "upcoming" subscriptionDeliveriesTable row via `orderId` —
 *      the same linkage loyaltyEngine.finalizeOrder() establishes for
 *      à-la-carte checkout.
 *   2. A trial subscription's linked order is priced at
 *      pricePerDeliveryPaise MINUS the server-computed bridge credit, never
 *      the full trial price and never a client-supplied amount.
 *   3. POST /payments/razorpay/order for orderId:"sub-<id>" no longer 404s,
 *      and bills the authoritative server amount even when the client sends
 *      a tampered amountPaise.
 *   4. POST /payments/razorpay/verify finds the subscription via the
 *      delivery→order link and captures the payment (order flips to
 *      "preparing") regardless of mandate outcome. As of this commit,
 *      registerAutopayMandate does NOT actually register a mandate in
 *      production: it needs a Razorpay `token_id`/`customer_id` on the
 *      payment, and Razorpay only attaches those when the gateway order was
 *      created with `subscriptionId` (payments.ts's `isRecurring` branch) —
 *      which nothing on the subscribe path sends yet (payWithRazorpay /
 *      razorpayClient.ts has no subscriptionId parameter). Test 4 pins this
 *      current (broken) behaviour as a regression guard; see the NOTE above
 *      that test for what must change once the subscriptionId-wiring
 *      follow-up lands.
 *
 * The Razorpay HTTP calls (order create, payment fetch) are stubbed via
 * globalThis.fetch — no real network / credentials involved. This mirrors
 * payments.integrity.test.ts's harness for the rest of the payment flow.
 *
 * Run with:
 *   node --test --import tsx ./src/routes/subscriptions.order.test.ts
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
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  usersTable,
  ordersTable,
  subscriptionsTable,
  subscriptionDeliveriesTable,
  subscriptionMandatesTable,
  mealCreditsTable,
} from "@workspace/db";

import subscriptionsRouter from "./subscriptions";
import paymentsRouter from "./payments";
import { bridgeCreditDiscountPaise } from "../lib/bridgeCredit";

const KEY_ID = "rzp_test_sub_order";
const KEY_SECRET = "secret_test_sub_order";
process.env["RAZORPAY_KEY_ID"] = KEY_ID;
process.env["RAZORPAY_KEY_SECRET"] = KEY_SECRET;

interface TestUser {
  id: string;
}

let server: http.Server;
let baseUrl = "";
const CREATED_USER_IDS: string[] = [];
const REGISTRY = new Map<string, TestUser>();

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const r = req as unknown as {
      user?: { id: string };
      isAuthenticated: () => boolean;
      log: Record<string, (...a: unknown[]) => void>;
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

async function makeUser(): Promise<TestUser> {
  const id = randomUUID();
  await db.insert(usersTable).values({
    id,
    email: `sub-order-${id}@example.test`,
    firstName: "Order",
    lastName: "Tester",
  });
  CREATED_USER_IDS.push(id);
  const u = { id };
  REGISTRY.set(id, u);
  return u;
}

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
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

function tomorrowISO(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 2);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function baseBody(extra: Record<string, unknown>) {
  return {
    cadence: "weekly",
    mealsPerDelivery: 5,
    deliveryWindow: "12:00-14:00",
    startDate: tomorrowISO(),
    members: [{ name: "Primary", diet: "any", allergens: [], spiceLevel: "medium" }],
    defaultItems: [
      {
        slug: "aglio-olio-veg",
        name: "Aglio Olio - Veg",
        image: "/images/dishes/aglio-olio-veg.jpg",
        quantity: 5,
        unitPricePaise: 13000,
      },
    ],
    ...extra,
  };
}

/** Razorpay's client-side signature: HMAC-SHA256("<orderId>|<paymentId>", key_secret). */
function verifySignature(razorpayOrderId: string, razorpayPaymentId: string): string {
  return createHmac("sha256", KEY_SECRET).update(`${razorpayOrderId}|${razorpayPaymentId}`).digest("hex");
}

// ---------------------------------------------------------------------------
// Razorpay fetch stub — intercepts the two HTTP calls payments.ts makes
// (order create, payment fetch) so the suite runs with no real network.
// ---------------------------------------------------------------------------

type FetchArgs = Parameters<typeof fetch>;
const originalFetch = globalThis.fetch;
let capturedOrderPayload: any = null;
let stubbedPaymentDetails: { customer_id: string; token_id: string } | null = null;

function installRazorpayFetchStub() {
  globalThis.fetch = (async (input: FetchArgs[0], init?: FetchArgs[1]) => {
    const url = typeof input === "string" ? input : (input as URL).toString();

    if (url === "https://api.razorpay.com/v1/orders" && init?.method === "POST") {
      capturedOrderPayload = JSON.parse(String(init.body));
      return new Response(
        JSON.stringify({
          id: `order_stub_${randomUUID().slice(0, 8)}`,
          amount: capturedOrderPayload.amount,
          currency: "INR",
        }),
        { status: 200 },
      );
    }

    if (url.startsWith("https://api.razorpay.com/v1/payments/") && (!init?.method || init.method === "GET")) {
      // Mirror real Razorpay: a payment only carries customer_id/token_id
      // when the underlying gateway order was created with a token request
      // (i.e. POST /payments/razorpay/order was called with
      // `subscriptionId`, which flips payments.ts's `isRecurring` branch and
      // adds `customer_id` + `token` to the order-create payload). Without
      // that, Razorpay never issues a token, so the payment-fetch response
      // has no customer_id/token_id — regardless of what `stubbedPaymentDetails`
      // the test would like it to return. This keeps the stub honest about
      // what production Razorpay would actually hand back.
      const orderRequestedToken = Boolean(
        capturedOrderPayload?.customer_id && capturedOrderPayload?.token,
      );
      const details = orderRequestedToken ? stubbedPaymentDetails : null;
      return new Response(JSON.stringify(details ?? {}), { status: 200 });
    }

    // Anything else (including the test's own calls into the local test
    // server via the `api()` helper) passes through to the real fetch.
    return originalFetch(input as any, init);
  }) as typeof fetch;
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

await new Promise<void>((resolve) => {
  server = makeApp().listen(0, () => {
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    resolve();
  });
});

after(async () => {
  restoreFetch();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  if (CREATED_USER_IDS.length > 0) {
    // orders.user_id has no cascade (financial records must not silently
    // vanish on user delete) — clear it before the user row.
    await db.delete(ordersTable).where(inArray(ordersTable.userId, CREATED_USER_IDS));
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
});

// ---------------------------------------------------------------------------
// 1. POST /subscriptions creates the linked first-cycle order
// ---------------------------------------------------------------------------

test("POST /subscriptions creates a linked ordersTable row priced from pricePerDeliveryPaise", async () => {
  const user = await makeUser();
  const created = await api("POST", "/subscriptions", baseBody({ planType: "standard" }), user);
  assert.equal(created.status, 201, JSON.stringify(created.json));
  const sub = created.json.subscription;

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.externalOrderId, `sub-${sub.id}`));
  assert.ok(order, "expected an ordersTable row linked to the new subscription");
  assert.equal(order!.userId, user.id);
  assert.equal(order!.chargePaise, sub.pricePerDeliveryPaise);
  assert.equal(order!.totalPaise, sub.pricePerDeliveryPaise);
  assert.equal(order!.status, "placed");
  assert.equal(order!.addressLine, sub.addressLine ?? null);

  const [firstDelivery] = await db
    .select()
    .from(subscriptionDeliveriesTable)
    .where(eq(subscriptionDeliveriesTable.subscriptionId, sub.id))
    .orderBy(subscriptionDeliveriesTable.scheduledFor);
  assert.equal(
    firstDelivery!.orderId,
    order!.id,
    "the earliest upcoming delivery must be linked to the new order",
  );
});

// ---------------------------------------------------------------------------
// 2. Trial + bridge credit: order is priced net of the server-computed credit
// ---------------------------------------------------------------------------

test("a trial subscription's linked order is priced net of the server-computed bridge credit", async () => {
  const user = await makeUser();
  await db.insert(mealCreditsTable).values({
    userId: user.id,
    amount: 1,
    reason: "alacarte_bridge",
  });

  const created = await api("POST", "/subscriptions", baseBody({ planType: "trial", mealsPerDelivery: 6 }), user);
  assert.equal(created.status, 201, JSON.stringify(created.json));
  const sub = created.json.subscription;
  assert.ok(created.json.bridgeCreditPaise > 0, "bridge credit must be redeemed for a trial");

  const expectedDiscount = bridgeCreditDiscountPaise(1, 6, sub.pricePerDeliveryPaise);
  assert.equal(created.json.bridgeCreditPaise, expectedDiscount);

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.externalOrderId, `sub-${sub.id}`));
  assert.ok(order);
  const expectedCharge = Math.max(0, sub.pricePerDeliveryPaise - expectedDiscount);
  assert.equal(
    order!.chargePaise,
    expectedCharge,
    "order must be charged pricePerDeliveryPaise minus the bridge credit, not the full trial price",
  );
  assert.ok(expectedCharge < sub.pricePerDeliveryPaise, "sanity: the credit must actually discount something");
});

// ---------------------------------------------------------------------------
// 3. POST /payments/razorpay/order no longer 404s and bills the server amount
// ---------------------------------------------------------------------------

test("POST /payments/razorpay/order succeeds for a new subscription and ignores a tampered client amount", async () => {
  const user = await makeUser();
  const created = await api("POST", "/subscriptions", baseBody({ planType: "standard" }), user);
  const sub = created.json.subscription;
  const externalOrderId = `sub-${sub.id}`;

  capturedOrderPayload = null;
  installRazorpayFetchStub();
  try {
    const res = await api(
      "POST",
      "/payments/razorpay/order",
      // Tampered client amount — must be ignored in favour of the server's
      // stored charge_paise.
      { orderId: externalOrderId, amountPaise: 100 },
      user,
    );
    assert.equal(res.status, 200, JSON.stringify(res.json));
    assert.ok(res.json.razorpayOrderId, "expected a razorpayOrderId in the response");
    assert.ok(capturedOrderPayload, "expected the stub to have captured the Razorpay order payload");
    assert.equal(
      capturedOrderPayload.amount,
      sub.pricePerDeliveryPaise,
      "the amount sent to Razorpay must be the server-authoritative charge, not the tampered client amount",
    );
  } finally {
    restoreFetch();
  }
});

// ---------------------------------------------------------------------------
// 4. POST /payments/razorpay/verify — payment capture succeeds via the
//    delivery → order link, but autopay mandate registration does NOT fire.
//
//    NOTE — this documents the current gap: see follow-up fix wiring
//    subscriptionId through the subscribe flow. Nothing on the subscribe
//    path (Subscribe.tsx → payWithRazorpay in razorpayClient.ts →
//    POST /payments/razorpay/order) sends `subscriptionId` today, so
//    payments.ts's `isRecurring` branch (~line 275-320) never fires, the
//    gateway order is created WITHOUT a token request, and a real Razorpay
//    payment for it carries no customer_id/token_id. registerAutopayMandate
//    then has nothing to register. Once the subscriptionId-wiring follow-up
//    lands, this test must be updated to assert the mandate DOES register
//    (restore the assertions from the version of this test in the parent
//    commit, gated on the order-create call now passing subscriptionId).
// ---------------------------------------------------------------------------

test("POST /payments/razorpay/verify captures payment but does NOT register an autopay mandate when the order was created without subscriptionId (current gap)", async () => {
  const user = await makeUser();
  const created = await api(
    "POST",
    "/subscriptions",
    baseBody({ planType: "standard", cadence: "weekly" }),
    user,
  );
  const sub = created.json.subscription;
  const externalOrderId = `sub-${sub.id}`;
  const statusBeforeVerify = sub.status;

  installRazorpayFetchStub();
  try {
    // Step 1: create the Razorpay order exactly as payWithRazorpay() does
    // today — no `subscriptionId` in the request body.
    const orderRes = await api(
      "POST",
      "/payments/razorpay/order",
      { orderId: externalOrderId },
      user,
    );
    assert.equal(orderRes.status, 200, JSON.stringify(orderRes.json));
    const razorpayOrderId = orderRes.json.razorpayOrderId as string;
    // Sanity: without subscriptionId, payments.ts never enters isRecurring,
    // so no customer_id/token was requested from Razorpay for this order.
    assert.equal(capturedOrderPayload.customer_id, undefined);
    assert.equal(capturedOrderPayload.token, undefined);

    // Step 2: verify. `stubbedPaymentDetails` is what the test would like
    // the payment to carry, but installRazorpayFetchStub only hands it back
    // when the order was actually created with a token request — mirroring
    // real Razorpay. Since step 1 didn't request one, the (stubbed) payment
    // fetch returns {} here, same as production would.
    stubbedPaymentDetails = { customer_id: "cust_stub_1", token_id: "token_stub_1" };
    const paymentId = "pay_stub_1";
    const verifyRes = await api("POST", "/payments/razorpay/verify", {
      orderId: externalOrderId,
      razorpayPaymentId: paymentId,
      razorpayOrderId,
      razorpaySignature: verifySignature(razorpayOrderId, paymentId),
    });
    assert.equal(verifyRes.status, 200, JSON.stringify(verifyRes.json));
    assert.equal(verifyRes.json.ok, true);
    assert.equal(verifyRes.json.status, "preparing");
    assert.equal(
      verifyRes.json.autopayDisclaimer,
      undefined,
      "no mandate registered, so there is nothing to disclaim",
    );

    // The payment itself still succeeds — order flips to preparing and
    // records the payment id — independent of mandate registration.
    const [order] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.externalOrderId, externalOrderId));
    assert.equal(order!.status, "preparing");
    assert.equal(order!.razorpayPaymentId, paymentId);

    // Core assertion of the current gap: no mandate row is created, because
    // the (stubbed, but production-accurate) payment fetch returned no
    // token for registerAutopayMandate to persist.
    const [mandate] = await db
      .select()
      .from(subscriptionMandatesTable)
      .where(eq(subscriptionMandatesTable.subscriptionId, sub.id));
    assert.equal(
      mandate,
      undefined,
      "no autopay mandate should register — the order was never created with subscriptionId, so Razorpay never issued a token",
    );

    // Subscription status is unaffected by verify. (POST /subscriptions
    // already sets status "active" unconditionally at creation time,
    // independent of payment — see subscriptions.ts — and
    // registerAutopayMandate's own status write never runs here since
    // mandateResult is null.)
    const [updatedSub] = await db
      .select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.id, sub.id));
    assert.equal(
      updatedSub!.status,
      statusBeforeVerify,
      "subscription status must be unaffected by verify when no mandate registers",
    );
  } finally {
    restoreFetch();
  }
});
