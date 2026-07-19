/**
 * Integration tests for the first-class 3-day trial on the subscriptions
 * router:
 *
 *   1. planType:"trial" prices the delivery at 25% off list (no cadence
 *      discount stacked) and generates exactly one delivery.
 *   2. planType:"standard" prices by cadence and generates the recurring
 *      set (unchanged behaviour).
 *   3. A trial subscription cannot be extended via generate-next.
 *   4. The legacy RD-plan trial marker in `notes` is still honoured as a
 *      trial (backward compatibility).
 *
 * Run with:
 *   node --test --import tsx ./src/routes/subscriptions.trial.test.ts
 *
 * Stands up a tiny express app mounting the real subscriptions router with
 * a stubbed auth middleware, like loyalty.checkout.test.ts.
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
import { db, usersTable, ordersTable } from "@workspace/db";

import subscriptionsRouter from "./subscriptions";
// Price expectations come from the canonical pricing module — the same pure
// functions the route bills through (Checklist v1.2: ₹750/meal base, cadence
// discounts, 5% GST). Deriving them here asserts the route's wiring (trial vs
// cadence pricing) without going stale on a price change.
import {
  computeDeliveryPricePaise,
  computeTrialPricePaise,
} from "../lib/subscriptionPricing";

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
    email: `sub-trial-${id}@example.test`,
    firstName: "Trial",
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
    mealsPerDelivery: 9,
    deliveryWindow: "12:00-14:00",
    startDate: tomorrowISO(),
    members: [{ name: "Primary", diet: "any", allergens: [], spiceLevel: "medium" }],
    defaultItems: [],
    ...extra,
  };
}

await new Promise<void>((resolve) => {
  server = makeApp().listen(0, () => {
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    resolve();
  });
});

after(async () => {
  if (CREATED_USER_IDS.length > 0) {
    // subscriptions + members + deliveries cascade on user delete (FK), but
    // orders.user_id does not (financial records must not silently vanish on
    // user delete) — POST /subscriptions now creates a linked first-cycle
    // order, so it must be cleared before the user row.
    await db.delete(ordersTable).where(inArray(ordersTable.userId, CREATED_USER_IDS));
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test("planType:trial prices 25% off list and generates one delivery", async () => {
  const user = await makeUser();
  const r = await api("POST", "/subscriptions", baseBody({ planType: "trial" }), user);
  assert.equal(r.status, 201, JSON.stringify(r.json));
  const expected = computeTrialPricePaise(9);
  assert.equal(
    r.json.subscription.pricePerDeliveryPaise,
    expected,
    "trial must be 25% off list, no cadence discount",
  );
  assert.equal(r.json.deliveries.length, 1, "trial generates exactly one delivery");
});

test("planType:standard prices by cadence and generates the recurring set", async () => {
  const user = await makeUser();
  const r = await api("POST", "/subscriptions", baseBody({ planType: "standard" }), user);
  assert.equal(r.status, 201, JSON.stringify(r.json));
  const expected = computeDeliveryPricePaise("weekly", 9);
  assert.equal(r.json.subscription.pricePerDeliveryPaise, expected);
  assert.ok(r.json.deliveries.length > 1, "standard generates a recurring set");
});

test("a trial subscription cannot be extended via generate-next", async () => {
  const user = await makeUser();
  const created = await api("POST", "/subscriptions", baseBody({ planType: "trial" }), user);
  const subId = created.json.subscription.id;
  const gen = await api("POST", `/subscriptions/${subId}/generate-next`, {}, user);
  assert.equal(gen.status, 400);
  assert.match(String(gen.json.error), /trial/i);
});

test("legacy RD-plan trial marker in notes is still treated as a trial", async () => {
  const user = await makeUser();
  const r = await api(
    "POST",
    "/subscriptions",
    baseBody({ notes: "RD Plan: 3-Day Trial Pack" }),
    user,
  );
  assert.equal(r.status, 201, JSON.stringify(r.json));
  const expected = computeTrialPricePaise(9);
  assert.equal(r.json.subscription.pricePerDeliveryPaise, expected);
  assert.equal(r.json.deliveries.length, 1);
});

test("default planType is standard when omitted", async () => {
  const user = await makeUser();
  const r = await api("POST", "/subscriptions", baseBody({}), user);
  assert.equal(r.status, 201, JSON.stringify(r.json));
  const expected = computeDeliveryPricePaise("weekly", 9);
  assert.equal(r.json.subscription.pricePerDeliveryPaise, expected);
});
