/**
 * Integration tests for day-first subscription plans (dayPlan):
 *
 *   1. A weekly dayPlan creates one dated delivery per planned day across
 *      4 cycles, prices from the server-side meal count (client value
 *      ignored), and each delivery carries its own day's items.
 *   2. A plan whose first day sits after the cycle start (weekdays plan
 *      starting Saturday) aligns nextDeliveryAt with the first real
 *      delivery, not the cycle start.
 *   3. A fortnightly dayPlan expands across the 14-day cycle and is priced
 *      on the full cycle's meals at the fortnightly discount.
 *   4. dayOffset outside the billing cycle is rejected.
 *   5. generate-next extends a dayPlan subscription with the same per-day
 *      pattern anchored to the next cycle boundary.
 *
 * Run with:
 *   node --test --import tsx ./src/routes/subscriptions.dayplan.test.ts
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
import { inArray } from "drizzle-orm";
import { db, usersTable, subscriptionsTable, ordersTable } from "@workspace/db";

import subscriptionsRouter from "./subscriptions";
// Price expectations come from the canonical pricing module — the same pure
// functions the route bills through (Checklist v1.2: ₹750/meal base, cadence
// discounts, 5% GST). Deriving them here asserts the route's wiring and
// server-side meal-count math without going stale on a price change.
import { computeDeliveryPricePaise } from "../lib/subscriptionPricing";

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
  return app;
}

async function makeUser(): Promise<TestUser> {
  const id = randomUUID();
  await db.insert(usersTable).values({
    id,
    email: `sub-dayplan-${id}@example.test`,
    firstName: "DayPlan",
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

function futureISO(daysAhead: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

const LUNCH = {
  slug: "signature-quinoa-salad",
  name: "Signature Quinoa Salad",
  image: "",
  quantity: 1,
  unitPricePaise: 9000,
};
const DINNER = {
  slug: "quinoa-khichdi",
  name: "Quinoa Khichdi",
  image: "",
  quantity: 1,
  unitPricePaise: 12000,
};

function weekDayPlan(offsets: number[]) {
  return offsets.map((dayOffset) => ({ dayOffset, items: [LUNCH, DINNER] }));
}

function baseBody(extra: Record<string, unknown>) {
  return {
    cadence: "weekly",
    // Deliberately wrong: the server must count meals from dayPlan itself.
    mealsPerDelivery: 50,
    deliveryWindow: "12:00-14:00",
    startDate: futureISO(2),
    planType: "standard",
    members: [{ name: "Primary", diet: "any", allergens: [], spiceLevel: "medium" }],
    defaultItems: [],
    ...extra,
  };
}

function daysBetween(a: string | Date, b: string | Date): number {
  return Math.round(
    (new Date(b).getTime() - new Date(a).getTime()) / 86400000,
  );
}

test("setup: start server", async () => {
  const app = makeApp();
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test("weekly dayPlan: dated delivery per day, server-priced meal count", async () => {
  const user = await makeUser();
  const start = futureISO(2);
  const res = await api(
    "POST",
    "/subscriptions",
    baseBody({ startDate: start, dayPlan: weekDayPlan([0, 1, 2, 3, 4, 5, 6]) }),
    user,
  );
  assert.equal(res.status, 201, JSON.stringify(res.json));
  const { subscription, deliveries } = res.json;
  // 7 days × 2 meals = 14 — the bogus mealsPerDelivery:50 must be ignored.
  assert.equal(subscription.mealsPerDelivery, 14);
  assert.equal(
    subscription.pricePerDeliveryPaise,
    computeDeliveryPricePaise("weekly", 14),
  );
  // 4 weekly cycles × 7 days.
  assert.equal(deliveries.length, 28);
  // Every delivery carries its own day's items, quantities intact.
  for (const d of deliveries) {
    assert.equal(d.items.length, 2);
  }
  // Consecutive dated days across cycles: offsets 0..27 from start.
  const offsets = deliveries
    .map((d: { scheduledFor: string }) => daysBetween(start, d.scheduledFor))
    .sort((a: number, b: number) => a - b);
  assert.deepEqual(offsets, Array.from({ length: 28 }, (_, i) => i));
});

test("first delivery after cycle start aligns nextDeliveryAt", async () => {
  const user = await makeUser();
  const start = futureISO(3);
  // Weekdays-style pattern that skips the first two days of the cycle.
  const res = await api(
    "POST",
    "/subscriptions",
    baseBody({ startDate: start, dayPlan: weekDayPlan([2, 3, 4, 5, 6]) }),
    user,
  );
  assert.equal(res.status, 201, JSON.stringify(res.json));
  assert.equal(daysBetween(start, res.json.subscription.nextDeliveryAt), 2);
});

test("fortnightly dayPlan: full-cycle meals at 10% off, 2 cycles ahead", async () => {
  const user = await makeUser();
  const res = await api(
    "POST",
    "/subscriptions",
    baseBody({
      cadence: "fortnightly",
      dayPlan: weekDayPlan([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]),
    }),
    user,
  );
  assert.equal(res.status, 201, JSON.stringify(res.json));
  const { subscription, deliveries } = res.json;
  assert.equal(subscription.mealsPerDelivery, 28);
  assert.equal(
    subscription.pricePerDeliveryPaise,
    computeDeliveryPricePaise("fortnightly", 28),
  );
  assert.equal(deliveries.length, 28); // 2 cycles × 14 days
});

test("dayOffset outside the billing cycle is rejected", async () => {
  const user = await makeUser();
  const res = await api(
    "POST",
    "/subscriptions",
    baseBody({ cadence: "weekly", dayPlan: weekDayPlan([0, 7]) }),
    user,
  );
  assert.equal(res.status, 400);
  assert.match(res.json.error, /dayPlan offsets/);
});

test("generate-next extends the per-day pattern from the next cycle", async () => {
  const user = await makeUser();
  const start = futureISO(2);
  const created = await api(
    "POST",
    "/subscriptions",
    baseBody({ startDate: start, dayPlan: weekDayPlan([0, 1, 2]) }),
    user,
  );
  assert.equal(created.status, 201, JSON.stringify(created.json));
  const subId = created.json.subscription.id;
  // 4 cycles × 3 days generated; last delivery at offset 21+2=23.
  assert.equal(created.json.deliveries.length, 12);

  const next = await api("POST", `/subscriptions/${subId}/generate-next`, {}, user);
  assert.equal(next.status, 200, JSON.stringify(next.json));
  // 4 more weekly cycles × 3 days, anchored at the next cycle boundary (+28).
  assert.equal(next.json.deliveries.length, 12);
  const newOffsets = next.json.deliveries
    .map((d: { scheduledFor: string }) => daysBetween(start, d.scheduledFor))
    .sort((a: number, b: number) => a - b);
  assert.deepEqual(
    newOffsets,
    [28, 29, 30, 35, 36, 37, 42, 43, 44, 49, 50, 51],
  );
});

after(async () => {
  if (server) await new Promise<void>((r) => server.close(() => r()));
  if (CREATED_USER_IDS.length > 0) {
    // orders.user_id has no cascade (financial records must not silently
    // vanish on user delete) — POST /subscriptions now creates a linked
    // first-cycle order, so it must be cleared before the user row.
    await db.delete(ordersTable).where(inArray(ordersTable.userId, CREATED_USER_IDS));
    await db
      .delete(subscriptionsTable)
      .where(inArray(subscriptionsTable.userId, CREATED_USER_IDS));
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
});
