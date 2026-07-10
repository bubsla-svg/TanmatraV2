/**
 * Integration tests for the skip-delivery wallet credit:
 *
 *   1. Skipping ONE delivery of a day-first (dayPlan) subscription credits
 *      only that day's meals (sum of the delivery's item quantities) — NOT
 *      the subscription's mealsPerDelivery, which for day-first plans is
 *      the entire cycle's meal count (7 days × 2 meals = 14).
 *   2. Legacy fallback: a delivery with no items credits mealsPerDelivery.
 *
 * Credits are denominated in meal counts (meal_credits.amount is an
 * integer number of meals), so a 2-meal day must credit exactly 2.
 *
 * Run with:
 *   node --test --import tsx ./src/routes/subscriptions.skip.test.ts
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
import { db, usersTable, subscriptionsTable, mealCreditsTable } from "@workspace/db";

import subscriptionsRouter from "./subscriptions";

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
    email: `sub-skip-${id}@example.test`,
    firstName: "Skip",
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
    mealsPerDelivery: 14,
    deliveryWindow: "12:00-14:00",
    startDate: futureISO(2),
    planType: "standard",
    members: [{ name: "Primary", diet: "any", allergens: [], spiceLevel: "medium" }],
    defaultItems: [],
    ...extra,
  };
}

test("setup: start server", async () => {
  const app = makeApp();
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test("skipping one day of a day-first weekly plan credits that day's meals, not the cycle's", async () => {
  const user = await makeUser();
  const created = await api(
    "POST",
    "/subscriptions",
    baseBody({ dayPlan: weekDayPlan([0, 1, 2, 3, 4, 5, 6]) }),
    user,
  );
  assert.equal(created.status, 201, JSON.stringify(created.json));
  const { subscription, deliveries } = created.json;
  // Sanity: for a day-first plan mealsPerDelivery is the WHOLE cycle's
  // meal count (7 days × 2 meals) — exactly the value that must NOT be
  // credited for a single skipped day.
  assert.equal(subscription.mealsPerDelivery, 14);
  assert.equal(deliveries.length, 28); // 4 weekly cycles × 7 days

  const target = deliveries[0];
  const skipRes = await api(
    "POST",
    `/subscription-deliveries/${target.id}/skip`,
    {},
    user,
  );
  assert.equal(skipRes.status, 200, JSON.stringify(skipRes.json));
  assert.equal(skipRes.json.delivery.status, "skipped");

  const creditsRes = await api("GET", "/meal-credits", null, user);
  assert.equal(creditsRes.status, 200);
  const credits = creditsRes.json.credits.filter(
    (c: { deliveryId: number }) => c.deliveryId === target.id,
  );
  assert.equal(credits.length, 1);
  // Credits are meal counts: one skipped day = 2 meals (LUNCH + DINNER
  // quantities), never the full cycle's 14.
  assert.equal(credits[0].amount, 2);
  assert.equal(credits[0].reason, "skipped_delivery");
  assert.equal(creditsRes.json.balance, 2);
});

test("legacy delivery with no items falls back to mealsPerDelivery", async () => {
  const user = await makeUser();
  // Classic (non-dayPlan) subscription with empty defaultItems: the
  // generated deliveries carry no items, so the credit must fall back to
  // the subscription's mealsPerDelivery.
  const created = await api(
    "POST",
    "/subscriptions",
    baseBody({ mealsPerDelivery: 5, defaultItems: [] }),
    user,
  );
  assert.equal(created.status, 201, JSON.stringify(created.json));
  const { subscription, deliveries } = created.json;
  assert.equal(subscription.mealsPerDelivery, 5);
  const target = deliveries[0];
  assert.equal((target.items ?? []).length, 0);

  const skipRes = await api(
    "POST",
    `/subscription-deliveries/${target.id}/skip`,
    {},
    user,
  );
  assert.equal(skipRes.status, 200, JSON.stringify(skipRes.json));

  const creditsRes = await api("GET", "/meal-credits", null, user);
  assert.equal(creditsRes.status, 200);
  const credits = creditsRes.json.credits.filter(
    (c: { deliveryId: number }) => c.deliveryId === target.id,
  );
  assert.equal(credits.length, 1);
  assert.equal(credits[0].amount, 5);
});

after(async () => {
  if (server) await new Promise<void>((r) => server.close(() => r()));
  if (CREATED_USER_IDS.length > 0) {
    await db
      .delete(mealCreditsTable)
      .where(inArray(mealCreditsTable.userId, CREATED_USER_IDS));
    await db
      .delete(subscriptionsTable)
      .where(inArray(subscriptionsTable.userId, CREATED_USER_IDS));
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
});
