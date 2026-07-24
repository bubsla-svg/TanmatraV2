/**
 * Integration tests for the SIGNED-IN credit preview on POST /subscriptions/quote
 * (plan-v2 branch). The bug this locks: the checkout total shown before paying
 * must equal what POST /subscriptions actually charges — including the
 * à-la-carte→trial bridge credit, which is applied server-side FIRST on a trial
 * and which a client-side `min(balance, total)` estimate silently misses.
 *
 * The quote now computes the SAME credits the create route redeems, in the same
 * order (bridge first for a trial, then the ledger balance against what's left),
 * using the same inputs the storefront sends (mealsPerDelivery = the quote's own
 * mealsPerCycle). So the strongest assertion here is end-to-end:
 * quote.payableTotalPaise === the created order's chargePaise.
 *
 * FLAG_PLAN_V2 is enabled for this file only — Node's test runner isolates each
 * file in its own process, so it can't leak into the legacy-path suites. Mirrors
 * subscriptions.creditLedger.test.ts's harness (tiny express app, stubbed auth,
 * real router, real Postgres). Run with a DATABASE_URL pointed at Postgres:
 *   DATABASE_URL=... NODE_ENV=test GOOGLE_API_KEY=test CLINICAL_KMS_MASTER_KEY=<64 hex> \
 *   node --test --import tsx ./src/routes/subscriptions.quoteCreditPreview.test.ts
 */

process.env["FLAG_PLAN_V2"] = "true";

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
import { eq, inArray } from "drizzle-orm";
import {
  db,
  usersTable,
  ordersTable,
  creditLedgerTable,
  mealCreditsTable,
} from "@workspace/db";

import subscriptionsRouter from "./subscriptions";
import { bridgeCreditDiscountPaise } from "../lib/bridgeCredit";

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
      user?: { id: string };
      isAuthenticated: () => boolean;
      log: Record<string, (...a: unknown[]) => void>;
    };
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
  await db.insert(usersTable).values({ id, email: `quote-credit-${id}@example.test`, firstName: "Quote" });
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

function tomorrowISO(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 2);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

// The storefront sends mealsPerDelivery = the quote's mealsPerCycle (3 for the
// trial); pass the same so create's bridge math matches the quote's exactly.
const TRIAL_MEALS = 3;

function createBody(extra: Record<string, unknown>) {
  return {
    planId: "trial_3day",
    track: "veg",
    cadence: "monthly",
    mealsPerDelivery: TRIAL_MEALS,
    deliveryWindow: "12:00-14:00",
    startDate: tomorrowISO(),
    members: [{ name: "Primary", diet: "any", allergens: [], spiceLevel: "medium" }],
    ...extra,
  };
}

const quoteBody = (planId: string, extra: Record<string, unknown> = {}) => ({
  cadence: "monthly",
  planId,
  track: "veg",
  addOns: [],
  ...extra,
});

await new Promise<void>((resolve) => {
  server = makeApp().listen(0, () => {
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    resolve();
  });
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  if (CREATED_USER_IDS.length > 0) {
    await db.delete(creditLedgerTable).where(inArray(creditLedgerTable.userId, CREATED_USER_IDS));
    await db.delete(mealCreditsTable).where(inArray(mealCreditsTable.userId, CREATED_USER_IDS));
    await db.delete(ordersTable).where(inArray(ordersTable.userId, CREATED_USER_IDS));
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
});

test("anonymous quote carries no credit preview (gross total only)", async () => {
  const q = await api("POST", "/subscriptions/quote", quoteBody("trial_3day"));
  assert.equal(q.status, 200);
  assert.equal(q.json.creditAppliedPaise ?? 0, 0);
  assert.equal(q.json.bridgeCreditPaise ?? 0, 0);
  // No credit → payable, when present, equals the gross total.
  assert.equal(q.json.payableTotalPaise ?? q.json.totalPaise, q.json.totalPaise);
});

test("signed-in non-trial: ledger credit applies against the total, no bridge", async () => {
  const user = await makeUser();
  await db.insert(creditLedgerTable).values({ userId: user.id, deltaPaise: 5_000, reason: "trial_creditback", note: "seed" });
  const q = await api("POST", "/subscriptions/quote", quoteBody("desk_fuel"), user);
  assert.equal(q.status, 200, JSON.stringify(q.json));
  assert.equal(q.json.bridgeCreditPaise, 0, "no bridge credit off a trial context");
  assert.equal(q.json.creditAppliedPaise, Math.min(5_000, q.json.totalPaise));
  assert.equal(q.json.payableTotalPaise, q.json.totalPaise - q.json.creditAppliedPaise);
});

test("THE BUG: trial quote's payable equals what create charges (bridge FIRST, then ledger)", async () => {
  const user = await makeUser();
  await db.insert(mealCreditsTable).values({ userId: user.id, amount: 1, reason: "alacarte_bridge" });
  const ledgerSeed = 5_000; // ₹50 — smaller than the post-bridge remainder
  await db.insert(creditLedgerTable).values({ userId: user.id, deltaPaise: ledgerSeed, reason: "trial_creditback", note: "seed" });

  // 1) The pre-pay quote the checkout screen shows (READ-ONLY — consumes nothing).
  const q = await api("POST", "/subscriptions/quote", quoteBody("trial_3day"), user);
  assert.equal(q.status, 200, JSON.stringify(q.json));
  const expectedBridge = bridgeCreditDiscountPaise(1, TRIAL_MEALS, q.json.totalPaise);
  assert.equal(q.json.bridgeCreditPaise, expectedBridge, "bridge computed on the trial total");
  assert.equal(q.json.creditAppliedPaise, ledgerSeed, "ledger applied against total − bridge");
  assert.equal(q.json.payableTotalPaise, q.json.totalPaise - expectedBridge - ledgerSeed);

  // 2) The actual create — credits still unconsumed, so it redeems the same.
  const created = await api("POST", "/subscriptions", createBody({}), user);
  assert.equal(created.status, 201, JSON.stringify(created.json));
  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.externalOrderId, `sub-${created.json.subscription.id}`));
  assert.ok(order, "first-cycle order exists");

  // The whole point: the number shown before paying == the number charged.
  assert.equal(
    q.json.payableTotalPaise,
    order!.chargePaise,
    "checkout's displayed payable must equal the order's actual charge",
  );
});
