/**
 * Integration tests for the general credit-ledger redemption on plan checkout
 * (SF Wave-2 straggler: "post-trial credit needs an authed, ledger-aware
 * displayed total"). `creditLedgerTable` is the FIFO balance behind
 * GET /credit-ledger and loyaltyEngine.finalizeOrder's à-la-carte redemption —
 * referral awards, the 3-Day Taste Test's ₹399 paid-time creditback
 * (`trial_creditback`), birthday/winback/loyalty grants, all "redeemable
 * against any plan start" (02e §6). Before this change, POST /subscriptions
 * never touched this ledger at all — only the UNRELATED alacarte→trial
 * `mealCreditsTable` bridge credit (gated on planType==="trial") was consumed.
 *
 * This suite locks in:
 *   1. An available ledger balance is redeemed against a new (non-trial) plan
 *      subscription's first-cycle order, capped at the bill.
 *   2. A balance larger than the bill clamps to the bill exactly — the order
 *      is never charged negative, and the ledger is debited only what was
 *      actually applied (never the whole balance).
 *   3. On a trial purchase, the (unrelated) alacarte→trial bridge credit is
 *      applied FIRST; ledger credit then covers only what's left of the bill
 *      — it must never be computed against the pre-bridge price (which would
 *      silently over-redeem a customer's real ledger balance for a bill
 *      bridge credit already zeroed out).
 *   4. No ledger balance → creditAppliedPaise is 0 and the order is billed
 *      pricePerDeliveryPaise unchanged (the common-case regression guard).
 *
 * Mirrors subscriptions.order.test.ts's harness (tiny express app, stubbed
 * auth, real router, real Postgres). Run with a DATABASE_URL pointed at a
 * real Postgres:
 *   DATABASE_URL=postgres://postgres@localhost:55433/money_test NODE_ENV=test \
 *   GOOGLE_API_KEY=test CLINICAL_KMS_MASTER_KEY=<64 hex> \
 *   node --test --import tsx ./src/routes/subscriptions.creditLedger.test.ts
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
import { getCreditBalancePaise } from "../lib/loyaltyEngine";

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
    email: `credit-ledger-${id}@example.test`,
    firstName: "Ledger",
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
    mealsPerDelivery: 5,
    deliveryWindow: "12:00-14:00",
    startDate: tomorrowISO(),
    members: [{ name: "Primary", diet: "any", allergens: [], spiceLevel: "medium" }],
    defaultItems: [
      {
        slug: "aglio-olio-veg",
        name: "Aglio Olio - Veg",
        image: "/images/dishes/aglio-olio-veg.jpg",
        quantity: 5,
        unitPricePaise: 13000,
      },
    ],
    ...extra,
  };
}

async function seedLedgerCredit(userId: string, paise: number): Promise<void> {
  await db.insert(creditLedgerTable).values({
    userId,
    deltaPaise: paise,
    reason: "trial_creditback",
    note: "test seed",
  });
}

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
    // orders.user_id has no cascade (financial records must not silently
    // vanish on user delete) — clear it before the user row.
    await db.delete(ordersTable).where(inArray(ordersTable.userId, CREATED_USER_IDS));
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
});

test("an available ledger credit is redeemed against a new plan subscription's bill", async () => {
  const user = await makeUser();
  await seedLedgerCredit(user.id, 39900); // ₹399, e.g. a trial creditback lot

  const created = await api("POST", "/subscriptions", baseBody({ planType: "standard" }), user);
  assert.equal(created.status, 201, JSON.stringify(created.json));
  const sub = created.json.subscription;
  assert.equal(created.json.creditAppliedPaise, 39900);
  assert.equal(created.json.bridgeCreditPaise, 0, "no alacarte bridge credit was seeded");

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.externalOrderId, `sub-${sub.id}`));
  assert.ok(order);
  assert.equal(
    order!.chargePaise,
    sub.pricePerDeliveryPaise - 39900,
    "the linked order must be charged the plan price minus the redeemed credit",
  );
  // The subscription's own price is unaffected — only the ORDER's charge is
  // discounted, exactly mirroring how the bridge credit already behaves.
  assert.ok(sub.pricePerDeliveryPaise > 39900, "sanity: test plan costs more than the seeded credit");

  const remaining = await getCreditBalancePaise(user.id);
  assert.equal(remaining, 0, "the full seeded lot was consumed");
});

test("a credit balance larger than the bill clamps to the bill — never a negative charge, never an over-debit", async () => {
  const user = await makeUser();
  const created = await api(
    "POST",
    "/subscriptions",
    baseBody({ planType: "standard", cadence: "weekly", mealsPerDelivery: 1 }),
    user,
  );
  assert.equal(created.status, 201, JSON.stringify(created.json));
  const sub = created.json.subscription;

  // Seed a balance strictly larger than this (already-billed) plan's price —
  // seeded AFTER create so it applies cleanly to a SECOND subscription below,
  // isolating the assertion from the first create's (zero) redemption.
  const bigCredit = sub.pricePerDeliveryPaise + 500_00;
  await seedLedgerCredit(user.id, bigCredit);

  const created2 = await api(
    "POST",
    "/subscriptions",
    baseBody({ planType: "standard", cadence: "weekly", mealsPerDelivery: 1 }),
    user,
  );
  assert.equal(created2.status, 201, JSON.stringify(created2.json));
  const sub2 = created2.json.subscription;
  assert.equal(
    created2.json.creditAppliedPaise,
    sub2.pricePerDeliveryPaise,
    "redemption must clamp to exactly the bill, not the full balance",
  );

  const [order2] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.externalOrderId, `sub-${sub2.id}`));
  assert.equal(order2!.chargePaise, 0, "a fully-covered bill charges exactly zero, never negative");

  const remaining = await getCreditBalancePaise(user.id);
  assert.equal(
    remaining,
    bigCredit - sub2.pricePerDeliveryPaise,
    "only the amount actually applied is debited — the leftover balance survives for a future bill",
  );
});

test("trial purchase: the alacarte bridge credit applies first; ledger credit covers only what's left", async () => {
  const user = await makeUser();
  await db.insert(mealCreditsTable).values({
    userId: user.id,
    amount: 1,
    reason: "alacarte_bridge",
  });
  const ledgerSeed = 5_000; // ₹50 — deliberately smaller than the remainder after bridge credit
  await seedLedgerCredit(user.id, ledgerSeed);

  const created = await api(
    "POST",
    "/subscriptions",
    baseBody({ planType: "trial", mealsPerDelivery: 6 }),
    user,
  );
  assert.equal(created.status, 201, JSON.stringify(created.json));
  const sub = created.json.subscription;

  const expectedBridge = bridgeCreditDiscountPaise(1, 6, sub.pricePerDeliveryPaise);
  assert.equal(created.json.bridgeCreditPaise, expectedBridge);
  assert.equal(
    created.json.creditAppliedPaise,
    ledgerSeed,
    "the whole ledger lot fits inside what's left after the bridge credit",
  );

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.externalOrderId, `sub-${sub.id}`));
  assert.ok(order);
  const expectedCharge = Math.max(0, sub.pricePerDeliveryPaise - expectedBridge - ledgerSeed);
  assert.equal(
    order!.chargePaise,
    expectedCharge,
    "the order must be charged net of BOTH the bridge credit and the ledger credit",
  );
});

test("no ledger balance → creditAppliedPaise is 0 and the bill is unaffected (common case)", async () => {
  const user = await makeUser();
  const created = await api("POST", "/subscriptions", baseBody({ planType: "standard" }), user);
  assert.equal(created.status, 201, JSON.stringify(created.json));
  const sub = created.json.subscription;
  assert.equal(created.json.creditAppliedPaise, 0);

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.externalOrderId, `sub-${sub.id}`));
  assert.equal(order!.chargePaise, sub.pricePerDeliveryPaise);
});
