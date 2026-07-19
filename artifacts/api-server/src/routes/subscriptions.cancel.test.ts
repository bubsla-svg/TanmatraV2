/**
 * Integration tests for B3b — cancel stops billing.
 *
 *   1. Cancelling a subscription revokes its Razorpay autopay mandate
 *      (status→cancelled, nextChargeAt→null) and purges scheduled/sent
 *      pre-debit notices — so /payments/charge-mandate can no longer bill it.
 *   2. After cancel, /payments/charge-mandate refuses (404 — no active mandate).
 *   3. Defense-in-depth: a cancelled subscription whose mandate row is somehow
 *      still active is refused by the sub-status guard (409 subscription_inactive).
 *
 * Run with:
 *   node --test --import tsx ./src/routes/subscriptions.cancel.test.ts
 */
import assert from "node:assert/strict";
import { test, after } from "node:test";
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
  preDebitNotificationsTable,
  ordersTable,
} from "@workspace/db";

import subscriptionsRouter from "./subscriptions";
import paymentsRouter from "./payments";

// /payments/charge-mandate is ops-gated (see routes/payments.ts) — set the
// same shared secret the route reads so the suite is self-contained.
const ADMIN_TOKEN = "test_admin_tok_cancel";
process.env["RD_ADMIN_TOKEN"] = ADMIN_TOKEN;

interface TestUser { id: string }
let server: http.Server;
let baseUrl = "";
const CREATED_USER_IDS: string[] = [];
const CREATED_SUB_IDS: number[] = [];
const REGISTRY = new Map<string, TestUser>();

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const r = req as unknown as { user?: unknown; log: Record<string, (...a: unknown[]) => void>; isAuthenticated: () => boolean };
    const headerId = req.header("x-test-user-id");
    const u = headerId ? REGISTRY.get(headerId) : undefined;
    if (u) r.user = u;
    r.isAuthenticated = () => r.user != null;
    r.log = { error: () => {}, info: () => {}, warn: () => {}, debug: () => {}, trace: () => {}, fatal: () => {} };
    next();
  });
  app.use(subscriptionsRouter);
  app.use(paymentsRouter);
  return app;
}

async function makeUser(): Promise<TestUser> {
  const id = randomUUID();
  await db.insert(usersTable).values({ id, email: `sub-cancel-${id}@example.test`, firstName: "Cancel", lastName: "Tester" });
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
  extraHeaders?: Record<string, string>,
) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(user ? { "x-test-user-id": user.id } : {}),
      ...extraHeaders,
    },
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

/** Create a subscription via the real API, then force it active for billing. */
async function seedActiveSubscription(user: TestUser): Promise<number> {
  const created = await api("POST", "/subscriptions", {
    cadence: "weekly",
    mealsPerDelivery: 5,
    deliveryWindow: "12:00-14:00",
    startDate: futureISO(2),
    planType: "standard",
    members: [{ name: "Primary", diet: "any", allergens: [], spiceLevel: "medium" }],
    defaultItems: [],
  }, user);
  assert.equal(created.status, 201, JSON.stringify(created.json));
  const subId = created.json.subscription.id as number;
  CREATED_SUB_IDS.push(subId);
  await db.update(subscriptionsTable).set({ status: "active" }).where(eq(subscriptionsTable.id, subId));
  return subId;
}

async function seedMandate(subId: number, status: "active" | "cancelled") {
  await db.insert(subscriptionMandatesTable).values({
    subscriptionId: subId,
    razorpayCustomerId: "cust_test",
    razorpayTokenId: "tok_test",
    status,
    nextChargeAt: status === "active" ? new Date(Date.now() + 24 * 3600 * 1000) : null,
  });
}

test("setup: start server", async () => {
  server = http.createServer(makeApp());
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test("cancel revokes the autopay mandate and purges pre-debit notices (B3b)", async () => {
  // No RAZORPAY creds set → the best-effort gateway DELETE is skipped (no network).
  const user = await makeUser();
  const subId = await seedActiveSubscription(user);
  await seedMandate(subId, "active");
  await db.insert(preDebitNotificationsTable).values({
    subscriptionId: subId,
    scheduledChargeAt: new Date(Date.now() + 24 * 3600 * 1000),
    status: "sent",
  });

  const cancelRes = await api("POST", `/subscriptions/${subId}/cancel`, {}, user);
  assert.equal(cancelRes.status, 200, JSON.stringify(cancelRes.json));

  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, subId));
  assert.equal(sub!.status, "cancelled");

  const [mandate] = await db.select().from(subscriptionMandatesTable).where(eq(subscriptionMandatesTable.subscriptionId, subId));
  assert.equal(mandate!.status, "cancelled", "mandate must be revoked");
  assert.equal(mandate!.nextChargeAt, null, "nextChargeAt must be cleared");

  const notices = await db.select().from(preDebitNotificationsTable).where(eq(preDebitNotificationsTable.subscriptionId, subId));
  assert.equal(notices.length, 0, "scheduled charge notices must be purged");
});

test("charge-mandate refuses after the mandate is revoked (404) — billing stopped", async () => {
  process.env["RAZORPAY_KEY_ID"] = "rzp_test_key";
  process.env["RAZORPAY_KEY_SECRET"] = "rzp_test_secret";
  const user = await makeUser();
  const subId = await seedActiveSubscription(user);
  await seedMandate(subId, "cancelled"); // post-cancel state

  const res = await api("POST", "/payments/charge-mandate", {
    subscriptionId: subId,
    amountPaise: 380000,
    scheduledChargeDate: futureISO(1),
  }, undefined, { "x-admin-token": ADMIN_TOKEN });
  assert.equal(res.status, 404, JSON.stringify(res.json));
});

test("charge-mandate refuses a cancelled subscription even if a mandate row lingers active (409)", async () => {
  process.env["RAZORPAY_KEY_ID"] = "rzp_test_key";
  process.env["RAZORPAY_KEY_SECRET"] = "rzp_test_secret";
  const user = await makeUser();
  const subId = await seedActiveSubscription(user);
  await seedMandate(subId, "active");
  // Simulate the race: subscription cancelled but a stale active mandate remains.
  await db.update(subscriptionsTable).set({ status: "cancelled" }).where(eq(subscriptionsTable.id, subId));

  const res = await api("POST", "/payments/charge-mandate", {
    subscriptionId: subId,
    amountPaise: 380000,
    scheduledChargeDate: futureISO(1),
  }, undefined, { "x-admin-token": ADMIN_TOKEN });
  assert.equal(res.status, 409, JSON.stringify(res.json));
  assert.equal(res.json.code, "subscription_inactive");
});

test("charge-mandate: request without the x-admin-token credential is rejected (403), never reaches business logic", async () => {
  const user = await makeUser();
  const subId = await seedActiveSubscription(user);
  await seedMandate(subId, "active");

  const body = {
    subscriptionId: subId,
    amountPaise: 380000,
    scheduledChargeDate: futureISO(1),
  };

  // No credential — a plain customer session must not be able to trigger a
  // mandate charge, even for their own subscription.
  const noToken = await api("POST", "/payments/charge-mandate", body, user);
  assert.equal(noToken.status, 403, JSON.stringify(noToken.json));

  // Wrong token — must not be accepted.
  const wrongToken = await api("POST", "/payments/charge-mandate", body, user, {
    "x-admin-token": "not-the-real-token",
  });
  assert.equal(wrongToken.status, 403, JSON.stringify(wrongToken.json));

  // The mandate must be untouched — no gateway charge occurred.
  const [mandate] = await db
    .select()
    .from(subscriptionMandatesTable)
    .where(eq(subscriptionMandatesTable.subscriptionId, subId));
  assert.equal(mandate!.status, "active");
});

after(async () => {
  if (server) await new Promise<void>((r) => server.close(() => r()));
  if (CREATED_SUB_IDS.length > 0) {
    await db.delete(preDebitNotificationsTable).where(inArray(preDebitNotificationsTable.subscriptionId, CREATED_SUB_IDS));
    await db.delete(subscriptionMandatesTable).where(inArray(subscriptionMandatesTable.subscriptionId, CREATED_SUB_IDS));
  }
  if (CREATED_USER_IDS.length > 0) {
    // orders.user_id has no cascade (financial records must not silently
    // vanish on user delete) — POST /subscriptions now creates a linked
    // first-cycle order, so it must be cleared before the user row.
    await db.delete(ordersTable).where(inArray(ordersTable.userId, CREATED_USER_IDS));
    await db.delete(subscriptionsTable).where(inArray(subscriptionsTable.userId, CREATED_USER_IDS));
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
});
