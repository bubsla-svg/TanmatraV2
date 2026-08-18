/**
 * DEFECT-CHANGE-PLAN-PRICING-001 containment — POST /subscriptions/:id/change-plan
 * and its two re-authorisation follow-ups must be unconditionally disabled.
 *
 * Why: change-plan reprices with computeDeliveryPricePaise, a retired
 * per-meal helper that diverges wildly from the plan catalog a plan-v2
 * subscription is actually billed against (measured on a same-cadence/
 * same-meals no-op: legacy 448875 vs catalog 119900 — a 3.7x divergence). See
 * docs/DEFECT-CHANGE-PLAN-PRICING-001.md and
 * docs/audit/P0-2-PLAN-CHANGE-CONTRACT-TRACE.md for the full trace.
 *
 * This file previously asserted the change-plan/reauth contract's correct
 * behaviour and failed, precisely because the underlying pricing was wrong —
 * see the previous revision in git history. Its purpose now is the opposite:
 * verify all three endpoints stay blocked, server-side, regardless of who
 * calls them or what they send, so a future change to this route can't
 * silently resurrect the overcharge risk without a red test.
 *
 * Run with:
 *   node --test --import tsx ./src/routes/subscriptions.changePlan.test.ts
 */
import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";
import { type AddressInfo } from "node:net";
import http from "node:http";

import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { eq, inArray } from "drizzle-orm";
import { db, usersTable, ordersTable, subscriptionsTable } from "@workspace/db";

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
    headers: {
      "Content-Type": "application/json",
      "idempotency-key": randomUUID(),
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

/** Creates a weekly, active, standard (non-trial) subscription. */
async function seedActiveSubscription(user: TestUser): Promise<number> {
  const created = await api(
    "POST",
    "/subscriptions",
    {
      cadence: "weekly",
      mealsPerDelivery: 18,
      deliveryWindow: "12:00-14:00",
      startDate: futureISO(2),
      planType: "standard",
      planId: "desk_fuel",
      track: "veg",
      members: [{ name: "Primary", diet: "any", allergens: [], spiceLevel: "medium" }],
      defaultItems: [],
    },
    user,
  );
  assert.equal(created.status, 201, JSON.stringify(created.json));
  return created.json.subscription.id as number;
}

test("setup: start server", async () => {
  server = http.createServer(makeApp());
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test("change-plan: always 503 change_plan_temporarily_disabled, regardless of payload", async () => {
  const user = await makeUser();
  const subId = await seedActiveSubscription(user);

  // Snapshot the live plan as the server actually stored it, before any
  // change-plan attempt touches it.
  const [before] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.id, subId));
  assert.ok(before, "seeded subscription should be readable");
  assert.equal(before!.cadence, "weekly");

  const attempts = [
    { cadence: "fortnightly" },
    { mealsPerDelivery: 25 },
    { cadence: "monthly", mealsPerDelivery: 1, clientQuotedPricePerDeliveryPaise: 1 },
  ];
  for (const body of attempts) {
    const res = await api("POST", `/subscriptions/${subId}/change-plan`, body, user);
    assert.equal(res.status, 503, JSON.stringify(res.json));
    assert.equal(res.json.code, "change_plan_temporarily_disabled");
  }

  // The live plan must be completely untouched — no pending fields set either.
  //
  // Compared against the snapshot taken BEFORE the attempts rather than
  // against literals. mealsPerDelivery is server-derived: create ignores the
  // client's requested count and takes computePlanQuote()'s mealsPerCycle
  // (a weekly desk_fuel prorates the 22-meal monthly cycle to 6), which is
  // the money-path rule — the server owns every amount — working as intended.
  // Asserting the literal 18 the request sent pinned the client's number and
  // broke the moment derivation landed; asserting a literal 6 would instead
  // re-break on any plan-catalog reprice. What this case is actually about is
  // that a refused change-plan mutates NOTHING, so diff the row against
  // itself.
  const [row] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.id, subId));
  assert.equal(row!.cadence, before!.cadence);
  assert.equal(row!.mealsPerDelivery, before!.mealsPerDelivery);
  assert.equal(row!.pricePerDeliveryPaise, before!.pricePerDeliveryPaise);
  assert.equal(row!.pendingCadence, null);
  assert.equal(row!.pendingPricePerDeliveryPaise, null);
});

test("change-plan/reauth-order: 503 disabled, auth still required first", async () => {
  const user = await makeUser();
  const subId = await seedActiveSubscription(user);

  const unauthed = await api("POST", `/subscriptions/${subId}/change-plan/reauth-order`, {});
  assert.equal(unauthed.status, 401, JSON.stringify(unauthed.json));

  const res = await api("POST", `/subscriptions/${subId}/change-plan/reauth-order`, {}, user);
  assert.equal(res.status, 503, JSON.stringify(res.json));
  assert.equal(res.json.code, "change_plan_temporarily_disabled");
});

test("change-plan/confirm: 503 disabled, auth still required first", async () => {
  const user = await makeUser();
  const subId = await seedActiveSubscription(user);

  const unauthed = await api("POST", `/subscriptions/${subId}/change-plan/confirm`, {});
  assert.equal(unauthed.status, 401, JSON.stringify(unauthed.json));

  const res = await api(
    "POST",
    `/subscriptions/${subId}/change-plan/confirm`,
    { razorpayOrderId: "order_x", razorpayPaymentId: "pay_x", razorpaySignature: "deadbeef" },
    user,
  );
  assert.equal(res.status, 503, JSON.stringify(res.json));
  assert.equal(res.json.code, "change_plan_temporarily_disabled");
});

after(async () => {
  if (server) await new Promise<void>((r) => server.close(() => r()));
  if (CREATED_USER_IDS.length > 0) {
    await db.delete(ordersTable).where(inArray(ordersTable.userId, CREATED_USER_IDS));
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
});
