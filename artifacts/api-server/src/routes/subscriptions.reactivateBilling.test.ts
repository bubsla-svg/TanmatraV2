/**
 * Integration tests for POST /subscriptions/:id/reactivate-billing — the
 * recovery path for a subscription whose billing was halted after
 * MAX_CONSECUTIVE_CHARGE_FAILURES consecutive failed debits (see
 * chargeMandate.ts's failCharge and chargeMandate.halt.test.ts).
 *
 *   1. Reactivating a halted subscription flips both subscriptionsTable and
 *      subscriptionMandatesTable back to "active", resets chargeFailureCount
 *      to 0, sets a near-future nextChargeAt (landing inside the pre-debit
 *      sweep's [now+24h, now+26h) lookahead window), and resumes paused
 *      upcoming deliveries.
 *   2. Refused (404) when the subscription belongs to another user.
 *   3. Refused (409) when the subscription is not currently halted.
 *
 * Run with:
 *   node --test --import tsx ./src/routes/subscriptions.reactivateBilling.test.ts
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
  subscriptionDeliveriesTable,
} from "@workspace/db";

import subscriptionsRouter from "./subscriptions";

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
  return app;
}

async function makeUser(): Promise<TestUser> {
  const id = randomUUID();
  await db.insert(usersTable).values({ id, email: `sub-reactivate-${id}@example.test`, firstName: "Reactivate", lastName: "Tester" });
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

/** Seed a subscription directly in the DB (bypassing the create-quote flow —
 * these tests only care about the reactivate-billing state machine, not
 * subscription creation), with a mandate that looks like it was halted by
 * MAX_CONSECUTIVE_CHARGE_FAILURES consecutive failures. */
async function seedHaltedSubscription(user: TestUser): Promise<{ subId: number; mandateId: number; deliveryId: number }> {
  const [sub] = await db
    .insert(subscriptionsTable)
    .values({
      userId: user.id,
      cadence: "weekly",
      mealsPerDelivery: 5,
      deliveryWindow: "12:00-14:00",
      status: "halted",
      startDate: new Date(Date.now() - 30 * 24 * 3600 * 1000),
      nextDeliveryAt: new Date(Date.now() + 2 * 24 * 3600 * 1000),
      pricePerDeliveryPaise: 38000,
    })
    .returning();
  CREATED_SUB_IDS.push(sub!.id);

  const [mandate] = await db
    .insert(subscriptionMandatesTable)
    .values({
      subscriptionId: sub!.id,
      razorpayCustomerId: "cust_reactivate_test",
      razorpayTokenId: "tok_reactivate_test",
      status: "halted",
      nextChargeAt: new Date(Date.now() - 24 * 3600 * 1000),
      chargeFailureCount: 3,
      lastChargeStatus: "failed",
      lastChargeError: "card declined",
    })
    .returning();

  const [delivery] = await db
    .insert(subscriptionDeliveriesTable)
    .values({
      subscriptionId: sub!.id,
      scheduledFor: new Date(Date.now() + 2 * 24 * 3600 * 1000),
      deliveryWindow: "12:00-14:00",
      status: "paused", // paused by the halt path (pauseUpcomingDeliveries)
      items: [],
    })
    .returning();

  return { subId: sub!.id, mandateId: mandate!.id, deliveryId: delivery!.id };
}

test("setup: start server", async () => {
  server = http.createServer(makeApp());
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test("reactivate-billing on a halted subscription: resets mandate + subscription state and resumes deliveries", async () => {
  const user = await makeUser();
  const before = new Date();
  const { subId, deliveryId } = await seedHaltedSubscription(user);

  const res = await api("POST", `/subscriptions/${subId}/reactivate-billing`, {}, user);
  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.equal(res.json.subscription.status, "active");
  assert.equal(res.json.mandate.status, "active");
  assert.equal(res.json.mandate.chargeFailureCount, 0);

  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, subId));
  assert.equal(sub!.status, "active");

  const [mandate] = await db.select().from(subscriptionMandatesTable).where(eq(subscriptionMandatesTable.subscriptionId, subId));
  assert.equal(mandate!.status, "active");
  assert.equal(mandate!.chargeFailureCount, 0);
  assert.ok(mandate!.nextChargeAt, "nextChargeAt must be set");
  // Sensible near-future value: inside the pre-debit sweep's
  // [now+24h, now+26h) lookahead window, not instant and not far out.
  const hoursOut = (mandate!.nextChargeAt!.getTime() - before.getTime()) / 3600000;
  assert.ok(hoursOut >= 24 && hoursOut <= 26, `expected nextChargeAt ~25h out, got ${hoursOut}h`);

  const [delivery] = await db.select().from(subscriptionDeliveriesTable).where(eq(subscriptionDeliveriesTable.id, deliveryId));
  assert.equal(delivery!.status, "upcoming", "the paused delivery must resume to upcoming");
});

test("reactivate-billing refuses a subscription belonging to another user (404)", async () => {
  const owner = await makeUser();
  const intruder = await makeUser();
  const { subId } = await seedHaltedSubscription(owner);

  const res = await api("POST", `/subscriptions/${subId}/reactivate-billing`, {}, intruder);
  assert.equal(res.status, 404, JSON.stringify(res.json));

  // State must be untouched.
  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, subId));
  assert.equal(sub!.status, "halted");
});

test("reactivate-billing refuses when the subscription is not halted (409)", async () => {
  const user = await makeUser();
  const { subId } = await seedHaltedSubscription(user);
  await db.update(subscriptionsTable).set({ status: "active" }).where(eq(subscriptionsTable.id, subId));

  const res = await api("POST", `/subscriptions/${subId}/reactivate-billing`, {}, user);
  assert.equal(res.status, 409, JSON.stringify(res.json));

  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, subId));
  assert.equal(sub!.status, "active", "state must be unchanged by the refused call");
});

test("reactivate-billing requires auth (401)", async () => {
  const user = await makeUser();
  const { subId } = await seedHaltedSubscription(user);

  const res = await api("POST", `/subscriptions/${subId}/reactivate-billing`, {}, undefined);
  assert.equal(res.status, 401, JSON.stringify(res.json));
});

after(async () => {
  if (server) await new Promise<void>((r) => server.close(() => r()));
  if (CREATED_SUB_IDS.length > 0) {
    await db.delete(subscriptionDeliveriesTable).where(inArray(subscriptionDeliveriesTable.subscriptionId, CREATED_SUB_IDS));
    await db.delete(subscriptionMandatesTable).where(inArray(subscriptionMandatesTable.subscriptionId, CREATED_SUB_IDS));
  }
  if (CREATED_USER_IDS.length > 0) {
    await db.delete(subscriptionsTable).where(inArray(subscriptionsTable.userId, CREATED_USER_IDS));
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
});
