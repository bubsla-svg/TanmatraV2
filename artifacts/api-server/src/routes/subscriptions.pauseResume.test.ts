/**
 * Integration tests for POST /subscriptions/:id/pause and
 * POST /subscriptions/:id/resume — the customer-initiated pause/resume
 * lifecycle transitions (the manual equivalents of the Razorpay
 * subscription.paused / subscription.resumed events).
 *
 * These two routes had ZERO automated coverage before this file, despite
 * being wired to the frontend and part of the subscription state machine.
 * Every assertion here is DB-backed: seed a real subscription + upcoming
 * delivery, call the real route, assert on the resulting DB rows.
 *
 *   pause:
 *     1. active subscription -> paused: flips status, stamps pausedAt, and
 *        moves upcoming deliveries to "paused".
 *     2. refused (409) when the subscription is not active (e.g. already
 *        paused) — no double-pause.
 *     3. refused (404) when the subscription belongs to another user, state
 *        untouched.
 *     4. requires auth (401).
 *   resume:
 *     5. paused subscription -> active: flips status, clears pausedAt, and
 *        moves paused deliveries back to "upcoming".
 *     6. refused (409) when the subscription is not paused.
 *     7. refused (404) when it belongs to another user, state untouched.
 *     8. requires auth (401).
 *   round-trip:
 *     9. pause then resume returns the subscription AND its deliveries to
 *        exactly their starting state — proving the two transitions compose
 *        as true inverses through the real routes, not just in isolation.
 *
 * Run with:
 *   node --test --import tsx ./src/routes/subscriptions.pauseResume.test.ts
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
  await db.insert(usersTable).values({ id, email: `sub-pauseresume-${id}@example.test`, firstName: "PauseResume", lastName: "Tester" });
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

/** Seed an active subscription with one upcoming delivery, directly in the
 * DB — these tests only exercise the pause/resume state machine, not the
 * create-quote flow. */
async function seedActiveSubscription(
  user: TestUser,
): Promise<{ subId: number; deliveryId: number }> {
  const [sub] = await db
    .insert(subscriptionsTable)
    .values({
      userId: user.id,
      cadence: "weekly",
      mealsPerDelivery: 5,
      deliveryWindow: "12:00-14:00",
      status: "active",
      startDate: new Date(Date.now() - 7 * 24 * 3600 * 1000),
      nextDeliveryAt: new Date(Date.now() + 2 * 24 * 3600 * 1000),
      pricePerDeliveryPaise: 38000,
    })
    .returning();
  CREATED_SUB_IDS.push(sub!.id);

  const [delivery] = await db
    .insert(subscriptionDeliveriesTable)
    .values({
      subscriptionId: sub!.id,
      scheduledFor: new Date(Date.now() + 2 * 24 * 3600 * 1000),
      deliveryWindow: "12:00-14:00",
      status: "upcoming",
      items: [],
    })
    .returning();

  return { subId: sub!.id, deliveryId: delivery!.id };
}

test("setup: start server", async () => {
  server = http.createServer(makeApp());
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

// ── pause ──────────────────────────────────────────────────────────────

test("pause on an active subscription: flips status to paused, stamps pausedAt, pauses upcoming deliveries", async () => {
  const user = await makeUser();
  const before = new Date();
  const { subId, deliveryId } = await seedActiveSubscription(user);

  const res = await api("POST", `/subscriptions/${subId}/pause`, {}, user);
  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.equal(res.json.subscription.status, "paused");

  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, subId));
  assert.equal(sub!.status, "paused");
  assert.ok(sub!.pausedAt, "pausedAt must be stamped");
  assert.ok(sub!.pausedAt!.getTime() >= before.getTime(), "pausedAt must be ~now");

  const [delivery] = await db.select().from(subscriptionDeliveriesTable).where(eq(subscriptionDeliveriesTable.id, deliveryId));
  assert.equal(delivery!.status, "paused", "the upcoming delivery must move to paused");
});

test("pause refuses when the subscription is not active (409) — no double-pause", async () => {
  const user = await makeUser();
  const { subId } = await seedActiveSubscription(user);
  await db.update(subscriptionsTable).set({ status: "paused" }).where(eq(subscriptionsTable.id, subId));

  const res = await api("POST", `/subscriptions/${subId}/pause`, {}, user);
  assert.equal(res.status, 409, JSON.stringify(res.json));
});

test("pause refuses a subscription belonging to another user (404), state untouched", async () => {
  const owner = await makeUser();
  const intruder = await makeUser();
  const { subId, deliveryId } = await seedActiveSubscription(owner);

  const res = await api("POST", `/subscriptions/${subId}/pause`, {}, intruder);
  assert.equal(res.status, 404, JSON.stringify(res.json));

  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, subId));
  assert.equal(sub!.status, "active", "state must be untouched by the refused call");
  const [delivery] = await db.select().from(subscriptionDeliveriesTable).where(eq(subscriptionDeliveriesTable.id, deliveryId));
  assert.equal(delivery!.status, "upcoming");
});

test("pause requires auth (401)", async () => {
  const user = await makeUser();
  const { subId } = await seedActiveSubscription(user);

  const res = await api("POST", `/subscriptions/${subId}/pause`, {}, undefined);
  assert.equal(res.status, 401, JSON.stringify(res.json));
});

// ── resume ─────────────────────────────────────────────────────────────

test("resume on a paused subscription: flips status to active, clears pausedAt, resumes paused deliveries", async () => {
  const user = await makeUser();
  const { subId, deliveryId } = await seedActiveSubscription(user);
  // Put it into the paused state the way the pause route would.
  await db.update(subscriptionsTable).set({ status: "paused", pausedAt: new Date() }).where(eq(subscriptionsTable.id, subId));
  await db.update(subscriptionDeliveriesTable).set({ status: "paused" }).where(eq(subscriptionDeliveriesTable.id, deliveryId));

  const res = await api("POST", `/subscriptions/${subId}/resume`, {}, user);
  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.equal(res.json.subscription.status, "active");

  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, subId));
  assert.equal(sub!.status, "active");
  assert.equal(sub!.pausedAt, null, "pausedAt must be cleared on resume");

  const [delivery] = await db.select().from(subscriptionDeliveriesTable).where(eq(subscriptionDeliveriesTable.id, deliveryId));
  assert.equal(delivery!.status, "upcoming", "the paused delivery must return to upcoming");
});

test("resume refuses when the subscription is not paused (409)", async () => {
  const user = await makeUser();
  const { subId } = await seedActiveSubscription(user); // still active

  const res = await api("POST", `/subscriptions/${subId}/resume`, {}, user);
  assert.equal(res.status, 409, JSON.stringify(res.json));

  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, subId));
  assert.equal(sub!.status, "active", "state must be unchanged by the refused call");
});

test("resume refuses a subscription belonging to another user (404), state untouched", async () => {
  const owner = await makeUser();
  const intruder = await makeUser();
  const { subId } = await seedActiveSubscription(owner);
  await db.update(subscriptionsTable).set({ status: "paused", pausedAt: new Date() }).where(eq(subscriptionsTable.id, subId));

  const res = await api("POST", `/subscriptions/${subId}/resume`, {}, intruder);
  assert.equal(res.status, 404, JSON.stringify(res.json));

  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, subId));
  assert.equal(sub!.status, "paused", "state must be untouched by the refused call");
});

test("resume requires auth (401)", async () => {
  const user = await makeUser();
  const { subId } = await seedActiveSubscription(user);
  await db.update(subscriptionsTable).set({ status: "paused", pausedAt: new Date() }).where(eq(subscriptionsTable.id, subId));

  const res = await api("POST", `/subscriptions/${subId}/resume`, {}, undefined);
  assert.equal(res.status, 401, JSON.stringify(res.json));
});

// ── round-trip: the two transitions are true inverses through the real routes ──

test("pause then resume returns the subscription and its deliveries to their starting state", async () => {
  const user = await makeUser();
  const { subId, deliveryId } = await seedActiveSubscription(user);

  const pauseRes = await api("POST", `/subscriptions/${subId}/pause`, {}, user);
  assert.equal(pauseRes.status, 200, JSON.stringify(pauseRes.json));

  const resumeRes = await api("POST", `/subscriptions/${subId}/resume`, {}, user);
  assert.equal(resumeRes.status, 200, JSON.stringify(resumeRes.json));

  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, subId));
  assert.equal(sub!.status, "active");
  assert.equal(sub!.pausedAt, null);

  const [delivery] = await db.select().from(subscriptionDeliveriesTable).where(eq(subscriptionDeliveriesTable.id, deliveryId));
  assert.equal(delivery!.status, "upcoming", "delivery must be back to upcoming after the round trip");
});

after(async () => {
  if (server) await new Promise<void>((r) => server.close(() => r()));
  if (CREATED_SUB_IDS.length > 0) {
    await db.delete(subscriptionDeliveriesTable).where(inArray(subscriptionDeliveriesTable.subscriptionId, CREATED_SUB_IDS));
  }
  if (CREATED_USER_IDS.length > 0) {
    await db.delete(subscriptionsTable).where(inArray(subscriptionsTable.userId, CREATED_USER_IDS));
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
});
