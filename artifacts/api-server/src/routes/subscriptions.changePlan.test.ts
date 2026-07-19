/**
 * Integration tests for POST /subscriptions/:id/change-plan and its
 * re-authorisation follow-ups (reauth-order, confirm):
 *
 *   1. A same-price plan change (different cadence+meals, equal total)
 *      persists as a pending change with no re-auth needed, and only takes
 *      effect at the next cycle boundary (generate-next) — never mid-cycle.
 *   2. A price-decrease change never requires re-auth, even with a live
 *      autopay mandate on file.
 *   3. A price-increase change against a live mandate is blocked pending
 *      re-authorisation: the pending change is NOT applied by generate-next
 *      until the customer completes reauth-order + confirm.
 *   4. A price-increase change with NO active mandate on file (nothing to
 *      protect) applies directly, same as a decrease.
 *   5. A client-supplied `clientQuotedPricePerDeliveryPaise` is accepted for
 *      logging only — the server always recomputes the real price and never
 *      trusts the client's number, however it's tampered.
 *   6. Guardrails: requesting the exact current plan, changing plan on a
 *      trial, and changing plan on a non-active subscription are all
 *      rejected.
 *
 * Run with:
 *   node --test --import tsx ./src/routes/subscriptions.changePlan.test.ts
 */
import assert from "node:assert/strict";
import { test, after } from "node:test";
import * as crypto from "node:crypto";
import { randomUUID } from "node:crypto";
import { type AddressInfo } from "node:net";
import http from "node:http";

import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  usersTable,
  subscriptionsTable,
  subscriptionMandatesTable,
} from "@workspace/db";

import subscriptionsRouter from "./subscriptions";
import paymentsRouter from "./payments";
import { computeDeliveryPricePaise } from "../lib/subscriptionPricing";

process.env["RAZORPAY_KEY_ID"] = process.env["RAZORPAY_KEY_ID"] ?? "rzp_test_changeplan";
process.env["RAZORPAY_KEY_SECRET"] = process.env["RAZORPAY_KEY_SECRET"] ?? "secret_test_changeplan";

// ---------------------------------------------------------------------------
// Razorpay fetch shim — intercept ONLY api.razorpay.com, delegate the rest to
// the real fetch (used by the test client to call the local test server).
// ---------------------------------------------------------------------------
const realFetch = globalThis.fetch;
let rzpOrderSeq = 0;

globalThis.fetch = (async (input: any, init?: any) => {
  const url =
    typeof input === "string" ? input : input instanceof URL ? input.href : (input?.url ?? String(input));

  if (url.includes("api.razorpay.com")) {
    if (url.includes("/v1/customers")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: "cust_test_changeplan" }),
        text: async () => "{}",
      } as unknown as Response;
    }
    if (url.endsWith("/v1/orders")) {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      const id = `order_test_${rzpOrderSeq++}`;
      return {
        ok: true,
        status: 200,
        json: async () => ({ id, amount: body.amount, currency: "INR" }),
        text: async () => "{}",
      } as unknown as Response;
    }
    const paymentMatch = url.match(/\/v1\/payments\/([^/]+)$/);
    if (paymentMatch) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: paymentMatch[1],
          customer_id: "cust_test_changeplan",
          token_id: "token_test_changeplan",
        }),
        text: async () => "{}",
      } as unknown as Response;
    }
  }

  return realFetch(input, init);
}) as typeof fetch;

/** Signs a (razorpayOrderId, razorpayPaymentId) pair exactly like the real gateway would. */
function signPayment(orderId: string, paymentId: string): string {
  const hmac = crypto.createHmac("sha256", process.env["RAZORPAY_KEY_SECRET"]!);
  hmac.update(`${orderId}|${paymentId}`);
  return hmac.digest("hex");
}

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

async function makeUser(): Promise<TestUser> {
  const id = randomUUID();
  await db.insert(usersTable).values({
    id,
    email: `sub-changeplan-${id}@example.test`,
    firstName: "Change",
    lastName: "Plan",
  });
  CREATED_USER_IDS.push(id);
  const u = { id };
  REGISTRY.set(id, u);
  return u;
}

async function api(method: string, path: string, body: unknown, user?: TestUser) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(user ? { "x-test-user-id": user.id } : {}) },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

function futureISO(daysAhead: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Creates a weekly, active, standard (non-trial) subscription at the given meal count. */
async function seedActiveSubscription(user: TestUser, mealsPerDelivery: number): Promise<number> {
  const created = await api(
    "POST",
    "/subscriptions",
    {
      cadence: "weekly",
      mealsPerDelivery,
      deliveryWindow: "12:00-14:00",
      startDate: futureISO(2),
      planType: "standard",
      members: [{ name: "Primary", diet: "any", allergens: [], spiceLevel: "medium" }],
      defaultItems: [],
    },
    user,
  );
  assert.equal(created.status, 201, JSON.stringify(created.json));
  const subId = created.json.subscription.id as number;
  await db.update(subscriptionsTable).set({ status: "active" }).where(eq(subscriptionsTable.id, subId));
  return subId;
}

async function seedActiveMandate(subId: number) {
  await db.insert(subscriptionMandatesTable).values({
    subscriptionId: subId,
    razorpayCustomerId: "cust_seed",
    razorpayTokenId: "tok_seed",
    status: "active",
    nextChargeAt: new Date(Date.now() + 24 * 3600 * 1000),
  });
}

test("setup: start server", async () => {
  server = http.createServer(makeApp());
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test("same-price change: no reauth, persists as pending, does not apply mid-cycle", async () => {
  const user = await makeUser();
  const subId = await seedActiveSubscription(user, 18); // weekly/18 == fortnightly/19 (see header)
  await seedActiveMandate(subId);

  const currentPrice = computeDeliveryPricePaise("weekly", 18);
  const samePrice = computeDeliveryPricePaise("fortnightly", 19);
  assert.equal(currentPrice, samePrice, "test fixture assumption: weekly/18 == fortnightly/19");

  const res = await api(
    "POST",
    `/subscriptions/${subId}/change-plan`,
    { cadence: "fortnightly", mealsPerDelivery: 19 },
    user,
  );
  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.equal(res.json.requiresReauth, false);
  assert.equal(res.json.newPricePerDeliveryPaise, samePrice);

  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, subId));
  // Never applied mid-cycle — the live plan is untouched, only pending* is set.
  assert.equal(sub!.cadence, "weekly");
  assert.equal(sub!.mealsPerDelivery, 18);
  assert.equal(sub!.pendingCadence, "fortnightly");
  assert.equal(sub!.pendingMealsPerDelivery, 19);
  assert.equal(sub!.pendingPricePerDeliveryPaise, samePrice);
  assert.equal(sub!.pendingChangeReauthRequired, false);

  // Cycle rollover — this IS where it takes effect.
  const gen = await api("POST", `/subscriptions/${subId}/generate-next`, {}, user);
  assert.equal(gen.status, 200, JSON.stringify(gen.json));
  assert.equal(gen.json.planChangeApplied, true);

  const [after1] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, subId));
  assert.equal(after1!.cadence, "fortnightly");
  assert.equal(after1!.mealsPerDelivery, 19);
  assert.equal(after1!.pricePerDeliveryPaise, samePrice);
  assert.equal(after1!.pendingCadence, null, "pending fields must be cleared once applied");
});

test("price-decrease change: no reauth even with a live mandate on file", async () => {
  const user = await makeUser();
  const subId = await seedActiveSubscription(user, 18); // weekly/18
  await seedActiveMandate(subId);

  const lowerPrice = computeDeliveryPricePaise("weekly", 10);
  const currentPrice = computeDeliveryPricePaise("weekly", 18);
  assert.ok(lowerPrice < currentPrice, "test fixture assumption: 10 meals is cheaper than 18");

  const res = await api(
    "POST",
    `/subscriptions/${subId}/change-plan`,
    { mealsPerDelivery: 10 },
    user,
  );
  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.equal(res.json.requiresReauth, false, "a price decrease never needs re-auth");
  assert.equal(res.json.newPricePerDeliveryPaise, lowerPrice);

  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, subId));
  assert.equal(sub!.pendingChangeReauthRequired, false);
  assert.equal(sub!.pendingMealsPerDelivery, 10);

  // Mandate must be untouched — a decrease is safe against the SAME token.
  const [mandate] = await db
    .select()
    .from(subscriptionMandatesTable)
    .where(eq(subscriptionMandatesTable.subscriptionId, subId));
  assert.equal(mandate!.razorpayTokenId, "tok_seed");
});

test("price-increase change with a live mandate: blocked pending reauth, applies only after confirm", async () => {
  const user = await makeUser();
  const subId = await seedActiveSubscription(user, 10); // weekly/10, cheap
  await seedActiveMandate(subId);

  const higherPrice = computeDeliveryPricePaise("weekly", 19);
  const currentPrice = computeDeliveryPricePaise("weekly", 10);
  assert.ok(higherPrice > currentPrice, "test fixture assumption: 19 meals costs more than 10");

  const changeRes = await api(
    "POST",
    `/subscriptions/${subId}/change-plan`,
    { mealsPerDelivery: 19 },
    user,
  );
  assert.equal(changeRes.status, 200, JSON.stringify(changeRes.json));
  assert.equal(changeRes.json.requiresReauth, true, "a price increase against a live mandate needs reauth");
  assert.equal(changeRes.json.newPricePerDeliveryPaise, higherPrice);

  // generate-next must NOT apply a change still awaiting reauth.
  const genBeforeConfirm = await api("POST", `/subscriptions/${subId}/generate-next`, {}, user);
  assert.equal(genBeforeConfirm.status, 200, JSON.stringify(genBeforeConfirm.json));
  assert.equal(genBeforeConfirm.json.planChangeApplied, false);
  const [stillPending] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, subId));
  assert.equal(stillPending!.mealsPerDelivery, 10, "live plan must be untouched while reauth is outstanding");
  assert.equal(stillPending!.pendingMealsPerDelivery, 19, "the pending request itself must survive a cycle rollover");

  // reauth-order — mirrors POST /payments/razorpay/order's isRecurring branch.
  const orderRes = await api("POST", `/subscriptions/${subId}/change-plan/reauth-order`, {}, user);
  assert.equal(orderRes.status, 200, JSON.stringify(orderRes.json));
  assert.ok(orderRes.json.razorpayOrderId);
  assert.equal(orderRes.json.amount, higherPrice);

  const [withOrder] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, subId));
  assert.equal(withOrder!.pendingChangeRazorpayOrderId, orderRes.json.razorpayOrderId);

  // Tampering: a signature/order that doesn't match must be refused.
  const badConfirm = await api(
    "POST",
    `/subscriptions/${subId}/change-plan/confirm`,
    {
      razorpayOrderId: "order_not_the_real_one",
      razorpayPaymentId: "pay_fake",
      razorpaySignature: "deadbeef",
    },
    user,
  );
  assert.equal(badConfirm.status, 400);

  // confirm — mirrors POST /payments/razorpay/verify's signature check + mandate registration.
  const paymentId = "pay_test_changeplan_1";
  const signature = signPayment(orderRes.json.razorpayOrderId, paymentId);
  const confirmRes = await api(
    "POST",
    `/subscriptions/${subId}/change-plan/confirm`,
    { razorpayOrderId: orderRes.json.razorpayOrderId, razorpayPaymentId: paymentId, razorpaySignature: signature },
    user,
  );
  assert.equal(confirmRes.status, 200, JSON.stringify(confirmRes.json));
  assert.equal(confirmRes.json.requiresReauth, false);

  const [reauthed] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, subId));
  assert.equal(reauthed!.pendingChangeReauthRequired, false);
  assert.equal(reauthed!.pendingMealsPerDelivery, 19, "still pending — only eligible now, not yet applied");
  assert.equal(reauthed!.mealsPerDelivery, 10, "still not applied mid-cycle even after reauth succeeds");

  // The mandate must now be the NEW one from the reauth payment.
  const [mandate] = await db
    .select()
    .from(subscriptionMandatesTable)
    .where(eq(subscriptionMandatesTable.subscriptionId, subId));
  assert.equal(mandate!.razorpayTokenId, "token_test_changeplan");
  assert.equal(mandate!.razorpayCustomerId, "cust_test_changeplan");

  // Cycle rollover — NOW it applies.
  const genAfterConfirm = await api("POST", `/subscriptions/${subId}/generate-next`, {}, user);
  assert.equal(genAfterConfirm.status, 200, JSON.stringify(genAfterConfirm.json));
  assert.equal(genAfterConfirm.json.planChangeApplied, true);

  const [applied] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, subId));
  assert.equal(applied!.mealsPerDelivery, 19);
  assert.equal(applied!.pricePerDeliveryPaise, higherPrice);
  assert.equal(applied!.pendingCadence, null);
});

test("price-increase change with NO active mandate: applies directly, nothing to protect", async () => {
  const user = await makeUser();
  const subId = await seedActiveSubscription(user, 10); // weekly/10, no mandate seeded

  const higherPrice = computeDeliveryPricePaise("weekly", 19);
  const res = await api(
    "POST",
    `/subscriptions/${subId}/change-plan`,
    { mealsPerDelivery: 19 },
    user,
  );
  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.equal(res.json.requiresReauth, false, "no live mandate means nothing to protect");
  assert.equal(res.json.newPricePerDeliveryPaise, higherPrice);

  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, subId));
  assert.equal(sub!.pendingChangeReauthRequired, false);
});

test("a tampered client-quoted price is ignored — server always recomputes", async () => {
  const user = await makeUser();
  const subId = await seedActiveSubscription(user, 10);
  await seedActiveMandate(subId);

  const realPrice = computeDeliveryPricePaise("weekly", 19);
  const res = await api(
    "POST",
    `/subscriptions/${subId}/change-plan`,
    { mealsPerDelivery: 19, clientQuotedPricePerDeliveryPaise: 1 },
    user,
  );
  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.equal(res.json.newPricePerDeliveryPaise, realPrice, "server must ignore the tampered client price");
  assert.equal(res.json.requiresReauth, true, "still correctly detected as an increase against the REAL price");

  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, subId));
  assert.equal(sub!.pendingPricePerDeliveryPaise, realPrice);
});

test("guardrails: matching current plan, trial subscription, and non-active subscription are all rejected", async () => {
  const user = await makeUser();
  const subId = await seedActiveSubscription(user, 10);

  const noop = await api("POST", `/subscriptions/${subId}/change-plan`, { mealsPerDelivery: 10 }, user);
  assert.equal(noop.status, 400);

  await db.update(subscriptionsTable).set({ status: "paused" }).where(eq(subscriptionsTable.id, subId));
  const whilePaused = await api(
    "POST",
    `/subscriptions/${subId}/change-plan`,
    { mealsPerDelivery: 19 },
    user,
  );
  assert.equal(whilePaused.status, 409);
  await db.update(subscriptionsTable).set({ status: "active" }).where(eq(subscriptionsTable.id, subId));

  const trialCreated = await api(
    "POST",
    "/subscriptions",
    {
      cadence: "weekly",
      mealsPerDelivery: 3,
      deliveryWindow: "12:00-14:00",
      startDate: futureISO(2),
      planType: "trial",
      members: [{ name: "Primary", diet: "any", allergens: [], spiceLevel: "medium" }],
      defaultItems: [],
    },
    user,
  );
  assert.equal(trialCreated.status, 201, JSON.stringify(trialCreated.json));
  const trialId = trialCreated.json.subscription.id as number;
  const onTrial = await api("POST", `/subscriptions/${trialId}/change-plan`, { mealsPerDelivery: 5 }, user);
  assert.equal(onTrial.status, 400);
});

after(async () => {
  if (server) await new Promise<void>((r) => server.close(() => r()));
  globalThis.fetch = realFetch;
  if (CREATED_USER_IDS.length > 0) {
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
});
