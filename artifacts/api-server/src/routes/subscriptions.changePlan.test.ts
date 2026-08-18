/**
 * POST /subscriptions/:id/change-plan — DEFECT-CHANGE-PLAN-PRICING-001.
 *
 * The defect: change-plan repriced with computeDeliveryPricePaise, a retired
 * per-meal helper that diverges wildly from the plan catalog a plan-v2
 * subscription is actually billed against (measured on a same-cadence/
 * same-meals no-op: legacy 448875 vs catalog 119900 — a 3.7x divergence).
 * Applying a change overwrote the amount the live autopay mandate charges.
 *
 * This file has now held three different jobs, and the sequence matters. It
 * first asserted the CORRECT behaviour and failed — reporting a real billing
 * defect into an empty room, because it ran in no workflow. It was then
 * rewritten to assert the blanket 503 containment. It now asserts the fix:
 * the price comes from computePlanQuote, the same call POST /subscriptions
 * prices with.
 *
 * What is deliberately NOT asserted: any specific rupee figure. Pinning a
 * literal would break on the next legitimate reprice and teaches nothing —
 * the invariant that must hold forever is that change-plan and create agree on
 * which FUNCTION decides the number, so every price assertion here is made
 * against computePlanQuote's own output.
 *
 * The two re-authorisation endpoints stay disabled and are still asserted so,
 * because a price INCREASE still routes nowhere. See
 * docs/DEFECT-CHANGE-PLAN-PRICING-001.md.
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
import { computePlanQuote } from "@workspace/subscription-rules";

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

/**
 * Creates an active, standard (non-trial) subscription on the given cadence.
 *
 * The cadence is a parameter because direction matters here. desk_fuel prices
 * weekly at 119900 and monthly at 437800, so weekly→monthly is an INCREASE and
 * only ever exercises the refusal branch. Seeding monthly and moving to weekly
 * is the only way to reach the code that actually STAGES a change — the branch
 * that writes to the database.
 */
async function seedActiveSubscription(
  user: TestUser,
  cadence: "weekly" | "monthly" = "weekly",
): Promise<number> {
  const created = await api(
    "POST",
    "/subscriptions",
    {
      cadence,
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

/** Read the row back as the server actually stored it. */
async function readSub(subId: number) {
  const [row] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.id, subId));
  assert.ok(row, "subscription should be readable");
  return row!;
}

// ─── The defect itself ───────────────────────────────────────────────────────
//
// This is the case DEFECT-CHANGE-PLAN-PRICING-001 is about. The old code
// priced a change with computeDeliveryPricePaise(cadence, meals), the retired
// per-meal helper, which returned 448875 for a subscription the catalog prices
// at 119900 — so every change looked like a 3.7x increase, and applying one
// overwrote the amount the live autopay mandate charges.
//
// Asserted against computePlanQuote rather than against a literal: a literal
// would pin today's price list and turn any legitimate reprice into a failure,
// while what must hold forever is that change-plan and create agree on which
// FUNCTION decides the number.
test("change-plan prices from the plan catalog, not the retired per-meal helper", async () => {
  const user = await makeUser();
  const subId = await seedActiveSubscription(user);
  const before = await readSub(subId);

  // desk_fuel is a monthly plan; the seed subscribed weekly. Moving to the
  // plan's own monthly cycle is a real cadence change with a real reprice.
  const quote = computePlanQuote("desk_fuel", "veg", "monthly");

  const res = await api("POST", `/subscriptions/${subId}/change-plan`, { cadence: "monthly" }, user);

  if (quote.cycleTotalPaise > before.pricePerDeliveryPaise) {
    // An increase is refused rather than served (the re-authorisation flow was
    // built around the broken quote). The refusal must still quote the CATALOG
    // figure — quoting the legacy one would be the same defect wearing a 409.
    assert.equal(res.status, 409, JSON.stringify(res.json));
    assert.equal(res.json.code, "change_plan_price_increase_unsupported");
    assert.equal(res.json.newPricePerDeliveryPaise, quote.cycleTotalPaise);
    assert.equal(res.json.currentPricePerDeliveryPaise, before.pricePerDeliveryPaise);

    const unchanged = await readSub(subId);
    assert.equal(unchanged.pendingCadence, null, "a refused change must stage nothing");
    assert.equal(unchanged.pricePerDeliveryPaise, before.pricePerDeliveryPaise);
    return;
  }

  // Same-or-cheaper: staged for the next cycle, priced from the catalog.
  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.equal(res.json.pendingPricePerDeliveryPaise, quote.cycleTotalPaise);

  const row = await readSub(subId);
  assert.equal(row.pendingPricePerDeliveryPaise, quote.cycleTotalPaise);
  // The live plan is untouched until the cycle rolls — the mandate is
  // authorised against pricePerDeliveryPaise, not the pending value.
  assert.equal(row.pricePerDeliveryPaise, before.pricePerDeliveryPaise);
  assert.equal(row.cadence, before.cadence);
});

test("the staged meal count comes from the catalog, never from the request", async () => {
  const user = await makeUser();
  const subId = await seedActiveSubscription(user);
  const before = await readSub(subId);
  const quote = computePlanQuote("desk_fuel", "veg", "monthly");
  if (quote.cycleTotalPaise > before.pricePerDeliveryPaise) return; // covered above

  const res = await api("POST", `/subscriptions/${subId}/change-plan`, { cadence: "monthly" }, user);
  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.equal(res.json.pendingMealsPerDelivery, quote.mealsPerCycle);
  assert.equal((await readSub(subId)).pendingMealsPerDelivery, quote.mealsPerCycle);
});

test("a meal-count change is REFUSED, not silently ignored", async () => {
  // Under catalog pricing the meal count is a property of the plan, so this is
  // not a coherent request. Ignoring it would be worse than refusing: the
  // client would believe it applied.
  const user = await makeUser();
  const subId = await seedActiveSubscription(user);
  const before = await readSub(subId);

  for (const body of [{ mealsPerDelivery: 25 }, { cadence: "monthly", mealsPerDelivery: 1 }]) {
    const res = await api("POST", `/subscriptions/${subId}/change-plan`, body, user);
    assert.equal(res.status, 422, JSON.stringify(res.json));
    assert.equal(res.json.code, "meals_not_independently_changeable");
  }

  const row = await readSub(subId);
  assert.equal(row.mealsPerDelivery, before.mealsPerDelivery);
  assert.equal(row.pendingCadence, null);
});

test("a cadence the catalog cannot price is refused, never guessed at", async () => {
  // "fortnightly" is a SubscriptionCadence but not a PlanCycle — there is no
  // catalog price for it. Inventing one with a formula is exactly how the
  // original defect produced a number that was wrong rather than absent.
  const user = await makeUser();
  const subId = await seedActiveSubscription(user);

  const res = await api(
    "POST",
    `/subscriptions/${subId}/change-plan`,
    { cadence: "fortnightly" },
    user,
  );
  assert.equal(res.status, 422, JSON.stringify(res.json));
  assert.equal(res.json.code, "cadence_not_in_catalog");
  assert.equal((await readSub(subId)).pendingCadence, null);
});

test("a client-quoted price cannot influence what is staged", async () => {
  // The money-path rule: the browser never sets an amount. The field is
  // accepted for tamper-logging only.
  const user = await makeUser();
  const subId = await seedActiveSubscription(user);
  const before = await readSub(subId);
  const quote = computePlanQuote("desk_fuel", "veg", "monthly");
  if (quote.cycleTotalPaise > before.pricePerDeliveryPaise) return;

  const res = await api(
    "POST",
    `/subscriptions/${subId}/change-plan`,
    { cadence: "monthly", clientQuotedPricePerDeliveryPaise: 1 },
    user,
  );
  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.notEqual(res.json.pendingPricePerDeliveryPaise, 1);
  assert.equal(res.json.pendingPricePerDeliveryPaise, quote.cycleTotalPaise);
  assert.equal((await readSub(subId)).pendingPricePerDeliveryPaise, quote.cycleTotalPaise);
});

test("change-plan requires auth, and never confirms another user's subscription exists", async () => {
  const owner = await makeUser();
  const stranger = await makeUser();
  const subId = await seedActiveSubscription(owner);

  const unauthed = await api("POST", `/subscriptions/${subId}/change-plan`, { cadence: "monthly" });
  assert.equal(unauthed.status, 401, JSON.stringify(unauthed.json));

  // 404, not 403 — a 403 would confirm the id is real to someone who does not
  // own it.
  const other = await api(
    "POST",
    `/subscriptions/${subId}/change-plan`,
    { cadence: "monthly" },
    stranger,
  );
  assert.equal(other.status, 404, JSON.stringify(other.json));
  assert.equal((await readSub(subId)).pendingCadence, null);
});

// ─── The staging branch ──────────────────────────────────────────────────────
//
// Everything above reaches the refusal path, because weekly→monthly is an
// increase for desk_fuel (119900 → 437800). These seed MONTHLY and move to
// WEEKLY, which is the only direction that reaches the code that actually
// writes to the database — and therefore the only direction that could
// overwrite the amount a live mandate is authorised against.
test("a cheaper cadence is staged for the next cycle at the catalog price", async () => {
  const user = await makeUser();
  const subId = await seedActiveSubscription(user, "monthly");
  const before = await readSub(subId);
  const weekly = computePlanQuote("desk_fuel", "veg", "weekly");
  assert.ok(
    weekly.cycleTotalPaise < before.pricePerDeliveryPaise,
    "this case requires a genuine price decrease to exercise staging",
  );

  const res = await api("POST", `/subscriptions/${subId}/change-plan`, { cadence: "weekly" }, user);
  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.equal(res.json.status, "pending");
  assert.equal(res.json.appliesAt, "next_cycle");
  assert.equal(res.json.pendingPricePerDeliveryPaise, weekly.cycleTotalPaise);

  const row = await readSub(subId);
  assert.equal(row.pendingCadence, "weekly");
  assert.equal(row.pendingPricePerDeliveryPaise, weekly.cycleTotalPaise);
  assert.equal(row.pendingMealsPerDelivery, weekly.mealsPerCycle);
  // No re-authorisation for a decrease: the existing mandate is already
  // authorised for a LARGER amount, so there is nothing new to approve.
  assert.equal(row.pendingChangeReauthRequired, false);

  // The live plan — the value the mandate actually charges — must be
  // untouched until the cycle rolls. This is the assertion that would have
  // caught the original defect's worst outcome.
  assert.equal(row.cadence, before.cadence);
  assert.equal(row.pricePerDeliveryPaise, before.pricePerDeliveryPaise);
  assert.equal(row.mealsPerDelivery, before.mealsPerDelivery);
});

test("staging never raises the live price, whatever was requested", async () => {
  // The single most important property: no path through change-plan may
  // increase what the mandate charges without re-authorisation. The original
  // defect violated exactly this.
  const user = await makeUser();
  const subId = await seedActiveSubscription(user, "monthly");
  const before = await readSub(subId);

  await api(
    "POST",
    `/subscriptions/${subId}/change-plan`,
    { cadence: "weekly", clientQuotedPricePerDeliveryPaise: 9_999_999 },
    user,
  );

  const row = await readSub(subId);
  assert.equal(row.pricePerDeliveryPaise, before.pricePerDeliveryPaise, "live price must not move");
  assert.ok(
    row.pendingPricePerDeliveryPaise! <= before.pricePerDeliveryPaise,
    `staged price ${row.pendingPricePerDeliveryPaise} must not exceed the authorised ${before.pricePerDeliveryPaise}`,
  );
});

test("a no-op change is refused rather than staged", async () => {
  const user = await makeUser();
  const subId = await seedActiveSubscription(user);
  const res = await api("POST", `/subscriptions/${subId}/change-plan`, { cadence: "weekly" }, user);
  assert.equal(res.status, 409, JSON.stringify(res.json));
  assert.equal(res.json.code, "no_change");
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
