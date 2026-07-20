/**
 * Integration tests for POST /subscription-deliveries/:id/unskip — the
 * inverse of the skip route. The money-safety invariant under test: a
 * delivery is NEVER flipped back to upcoming unless its unconsumed skip
 * credit is deleted in the same transaction. Every assertion is DB-backed:
 * seed a real skipped delivery + credit, call the real route, assert on
 * the resulting DB rows.
 *
 *   1. happy path: skipped + unconsumed credit -> 200, delivery upcoming,
 *      credit row gone.
 *   2. consumed credit -> 409 credit_consumed, delivery stays skipped,
 *      credit row untouched.
 *   3. no credit row at all -> 409 credit_consumed, delivery stays skipped.
 *   4. non-skipped delivery -> 400.
 *   5. cross-user -> 404, state untouched.
 *   6. requires auth (401).
 *   7. past cutoff (scheduledFor within 24h) -> 409 past_cutoff, delivery
 *      stays skipped, credit untouched.
 *
 * Run with:
 *   node --test --import tsx ./src/routes/subscriptions.unskip.test.ts
 */
import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";
import { type AddressInfo } from "node:net";
import http from "node:http";

import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  usersTable,
  subscriptionsTable,
  subscriptionDeliveriesTable,
  mealCreditsTable,
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
  await db.insert(usersTable).values({ id, email: `sub-unskip-${id}@example.test`, firstName: "Unskip", lastName: "Tester" });
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

/** Seed a subscription with one delivery in the given status, directly in
 * the DB. scheduledFor defaults to 3 days out so the 24h skip cutoff never
 * interferes with the happy paths. */
async function seedDelivery(
  user: TestUser,
  opts: { status?: string; scheduledFor?: Date } = {},
): Promise<{ subId: number; deliveryId: number }> {
  const scheduledFor = opts.scheduledFor ?? new Date(Date.now() + 3 * 24 * 3600 * 1000);
  const [sub] = await db
    .insert(subscriptionsTable)
    .values({
      userId: user.id,
      cadence: "weekly",
      mealsPerDelivery: 5,
      deliveryWindow: "12:00-14:00",
      status: "active",
      startDate: new Date(Date.now() - 7 * 24 * 3600 * 1000),
      nextDeliveryAt: scheduledFor,
      pricePerDeliveryPaise: 38000,
    })
    .returning();
  CREATED_SUB_IDS.push(sub!.id);

  const [delivery] = await db
    .insert(subscriptionDeliveriesTable)
    .values({
      subscriptionId: sub!.id,
      scheduledFor,
      deliveryWindow: "12:00-14:00",
      status: (opts.status ?? "skipped") as "upcoming",
      items: [],
    })
    .returning();

  return { subId: sub!.id, deliveryId: delivery!.id };
}

async function seedCredit(
  user: TestUser,
  subId: number,
  deliveryId: number,
  opts: { consumedAt?: Date } = {},
): Promise<number> {
  const expiresAt = new Date(Date.now() + 60 * 24 * 3600 * 1000);
  const [credit] = await db
    .insert(mealCreditsTable)
    .values({
      userId: user.id,
      subscriptionId: subId,
      deliveryId,
      amount: 5,
      reason: "skipped_delivery",
      expiresAt,
      consumedAt: opts.consumedAt ?? null,
    })
    .returning();
  return credit!.id;
}

async function getDelivery(deliveryId: number) {
  const [row] = await db.select().from(subscriptionDeliveriesTable).where(eq(subscriptionDeliveriesTable.id, deliveryId));
  return row!;
}

async function getCredits(deliveryId: number) {
  return db
    .select()
    .from(mealCreditsTable)
    .where(and(eq(mealCreditsTable.deliveryId, deliveryId), eq(mealCreditsTable.reason, "skipped_delivery")));
}

test("setup: start server", async () => {
  server = http.createServer(makeApp());
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test("unskip happy path: 200, delivery back to upcoming, credit row gone", async () => {
  const user = await makeUser();
  const { subId, deliveryId } = await seedDelivery(user);
  await seedCredit(user, subId, deliveryId);

  const res = await api("POST", `/subscription-deliveries/${deliveryId}/unskip`, {}, user);
  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.equal(res.json.delivery.status, "upcoming");

  const delivery = await getDelivery(deliveryId);
  assert.equal(delivery.status, "upcoming", "delivery must be back to upcoming");
  const credits = await getCredits(deliveryId);
  assert.equal(credits.length, 0, "the skip credit must be clawed back (deleted)");
});

test("unskip with a consumed credit: 409 credit_consumed, delivery stays skipped, credit untouched", async () => {
  const user = await makeUser();
  const { subId, deliveryId } = await seedDelivery(user);
  const creditId = await seedCredit(user, subId, deliveryId, { consumedAt: new Date() });

  const res = await api("POST", `/subscription-deliveries/${deliveryId}/unskip`, {}, user);
  assert.equal(res.status, 409, JSON.stringify(res.json));
  assert.equal(res.json.code, "credit_consumed");

  const delivery = await getDelivery(deliveryId);
  assert.equal(delivery.status, "skipped", "delivery must NOT flip when the credit was already spent");
  const credits = await getCredits(deliveryId);
  assert.equal(credits.length, 1, "the consumed credit row must be untouched");
  assert.equal(credits[0]!.id, creditId);
  assert.ok(credits[0]!.consumedAt, "consumedAt must remain set");
});

test("unskip with no credit row at all: 409 credit_consumed, delivery stays skipped", async () => {
  const user = await makeUser();
  const { deliveryId } = await seedDelivery(user);

  const res = await api("POST", `/subscription-deliveries/${deliveryId}/unskip`, {}, user);
  assert.equal(res.status, 409, JSON.stringify(res.json));
  assert.equal(res.json.code, "credit_consumed");

  const delivery = await getDelivery(deliveryId);
  assert.equal(delivery.status, "skipped");
});

test("unskip on a non-skipped delivery: 400", async () => {
  const user = await makeUser();
  const { deliveryId } = await seedDelivery(user, { status: "upcoming" });

  const res = await api("POST", `/subscription-deliveries/${deliveryId}/unskip`, {}, user);
  assert.equal(res.status, 400, JSON.stringify(res.json));

  const delivery = await getDelivery(deliveryId);
  assert.equal(delivery.status, "upcoming");
});

test("unskip a delivery belonging to another user: 404, state untouched", async () => {
  const owner = await makeUser();
  const intruder = await makeUser();
  const { subId, deliveryId } = await seedDelivery(owner);
  await seedCredit(owner, subId, deliveryId);

  const res = await api("POST", `/subscription-deliveries/${deliveryId}/unskip`, {}, intruder);
  assert.equal(res.status, 404, JSON.stringify(res.json));

  const delivery = await getDelivery(deliveryId);
  assert.equal(delivery.status, "skipped", "state must be untouched by the refused call");
  const credits = await getCredits(deliveryId);
  assert.equal(credits.length, 1, "credit must remain");
});

test("unskip requires auth (401)", async () => {
  const user = await makeUser();
  const { deliveryId } = await seedDelivery(user);

  const res = await api("POST", `/subscription-deliveries/${deliveryId}/unskip`, {}, undefined);
  assert.equal(res.status, 401, JSON.stringify(res.json));
});

test("unskip past the cutoff (within 24h): 409 past_cutoff, delivery stays skipped, credit untouched", async () => {
  const user = await makeUser();
  const { subId, deliveryId } = await seedDelivery(user, {
    scheduledFor: new Date(Date.now() + 6 * 3600 * 1000),
  });
  await seedCredit(user, subId, deliveryId);

  const res = await api("POST", `/subscription-deliveries/${deliveryId}/unskip`, {}, user);
  assert.equal(res.status, 409, JSON.stringify(res.json));
  assert.equal(res.json.code, "past_cutoff");

  const delivery = await getDelivery(deliveryId);
  assert.equal(delivery.status, "skipped");
  const credits = await getCredits(deliveryId);
  assert.equal(credits.length, 1, "credit must remain when the unskip is refused");
});

after(async () => {
  if (server) await new Promise<void>((r) => server.close(() => r()));
  if (CREATED_SUB_IDS.length > 0) {
    await db.delete(mealCreditsTable).where(inArray(mealCreditsTable.subscriptionId, CREATED_SUB_IDS));
    await db.delete(subscriptionDeliveriesTable).where(inArray(subscriptionDeliveriesTable.subscriptionId, CREATED_SUB_IDS));
  }
  if (CREATED_USER_IDS.length > 0) {
    await db.delete(subscriptionsTable).where(inArray(subscriptionsTable.userId, CREATED_USER_IDS));
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
});
