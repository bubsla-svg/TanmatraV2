/**
 * Integration tests for the premium-meal gate on POST /orders — added in the
 * same change that opened the ENTIRE catalog to à-la-carte purchase
 * (isAlaCarteEnabled → true, 2026-08-09).
 *
 * Why this gate did not exist before: premium dishes were structurally
 * unreachable through guest checkout — they were never in the curated
 * à-la-carte hero set, so no storefront surface ever rendered them an Add
 * button, and the only premium enforcement lived on POST /orders/finalize
 * (routes/loyalty.ts), a different route that is itself gated off. Opening
 * the catalog gives every dish an Add button, which makes POST /orders the
 * route that must enforce membership — otherwise the full-catalog decision
 * would silently also revoke premium monetization.
 *
 * Also pins the widening itself: a formerly browse-only, non-premium dish
 * (the charcoal smoothie — the canonical dead end from the PDP audit) is now
 * genuinely orderable end-to-end by a guest.
 *
 * Auth harness mirrors loyalty.checkout.test.ts (x-test-user-id registry);
 * the request-body shape mirrors checkout.consent.test.ts, with a
 * serviceable pincode so requests get past the pre-resolver gates.
 *
 * Needs DATABASE_URL (CI: money-integration job's Postgres service).
 *
 * Run with:
 *   node --test --import tsx ./src/routes/checkout.premiumGate.test.ts
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
import { inArray, like } from "drizzle-orm";
import { db, ordersTable, premiumMembershipsTable, usersTable } from "@workspace/db";
import { TEST_DISHES as DISHES } from "../test-fixtures/dishes.js";

import checkoutRouter from "./checkout";

const RUN = randomUUID().slice(0, 8);
const EXT_PREFIX = `prem-gate-${RUN}-`;

// A premium dish (must match routes/premium.ts's SEED_PREMIUM_SLUGS — the
// gate's slug set is seeded from there) and the canonical formerly-non-hero
// control dish the full-catalog decision made orderable.
const PREMIUM_DISH = DISHES.find((d) => d.slug === "alfredo-pasta-prawns");
const OPENED_DISH = DISHES.find((d) => d.slug === "activated-charcoal-smoothie");
assert.ok(PREMIUM_DISH, "premium fixture dish missing from catalog");
assert.ok(OPENED_DISH, "formerly-non-hero fixture dish missing from catalog");

interface TestUser {
  id: string;
}
const REGISTRY = new Map<string, TestUser>();
const CREATED_USER_IDS: string[] = [];

let server: http.Server;
let baseUrl = "";

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const r = req as unknown as {
      user?: TestUser;
      isAuthenticated: () => boolean;
      log: Record<string, (...a: unknown[]) => void>;
    };
    const headerId = req.header("x-test-user-id");
    const u = headerId ? REGISTRY.get(headerId) : undefined;
    if (u) r.user = u;
    r.isAuthenticated = () => r.user != null;
    r.log = {
      error: () => {}, info: () => {}, warn: () => {}, debug: () => {}, trace: () => {}, fatal: () => {},
    };
    next();
  });
  app.use(checkoutRouter);
  return app;
}

await new Promise<void>((resolve) => {
  server = makeApp().listen(0, () => {
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    resolve();
  });
});

after(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  // Guest orders have userId NULL, so sweep by this run's externalOrderId
  // prefix; member orders are additionally covered by the userId sweep.
  await db.delete(ordersTable).where(like(ordersTable.externalOrderId, `${EXT_PREFIX}%`));
  if (CREATED_USER_IDS.length > 0) {
    await db.delete(ordersTable).where(inArray(ordersTable.userId, CREATED_USER_IDS));
    await db
      .delete(premiumMembershipsTable)
      .where(inArray(premiumMembershipsTable.userId, CREATED_USER_IDS));
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
});

async function makeUser(): Promise<TestUser> {
  const id = randomUUID();
  await db.insert(usersTable).values({
    id,
    email: `prem-gate-${id}@example.test`,
    firstName: "Premium",
    lastName: "Gate",
  });
  CREATED_USER_IDS.push(id);
  const u = { id };
  REGISTRY.set(id, u);
  return u;
}

async function makePremium(userId: string): Promise<void> {
  await db.insert(premiumMembershipsTable).values({
    userId,
    status: "active",
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });
}

function orderBody(dishId: number, extra: Record<string, unknown> = {}) {
  return {
    externalOrderId: `${EXT_PREFIX}${randomUUID().slice(0, 12)}`,
    items: [{ dishId, qty: 1 }],
    phone: "9999999999",
    // Serviceable pincode (Noida core) so the request reaches the item loop —
    // checkout.consent.test.ts deliberately uses an unserviceable one to stop
    // early; this suite needs the opposite.
    address: { line1: "1 Test Rd", city: "Noida", pincode: "201301" },
    consent: { accepted: true, policyVersion: "dpdp-v1" },
    // A guest with no declared prefs must ack allergen risk when the cart
    // carries allergen-flagged dishes; passing it keeps every case focused on
    // the premium gate rather than the (separately tested) ack gate.
    allergenAck: true,
    ...extra,
  };
}

async function placeOrder(
  body: unknown,
  user?: TestUser,
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${baseUrl}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(user ? { "x-test-user-id": user.id } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

test("a GUEST cart containing a premium dish is refused with 403 premium_required", async () => {
  const res = await placeOrder(orderBody(PREMIUM_DISH!.id));
  assert.equal(res.status, 403, JSON.stringify(res.json));
  assert.equal(res.json.code, "premium_required");
});

test("an authenticated NON-premium member is refused the same way", async () => {
  const user = await makeUser();
  const res = await placeOrder(orderBody(PREMIUM_DISH!.id), user);
  assert.equal(res.status, 403, JSON.stringify(res.json));
  assert.equal(res.json.code, "premium_required");
});

test("an active premium member's premium cart passes the gate and creates the order", async () => {
  // The positive control — without it the two refusals above would also pass
  // if the gate simply 403'd every premium cart for everyone.
  const user = await makeUser();
  await makePremium(user.id);
  const res = await placeOrder(orderBody(PREMIUM_DISH!.id), user);
  assert.equal(res.status, 201, JSON.stringify(res.json));
  assert.equal(res.json.status, "placed");
  assert.ok(res.json.serverOrderId, "expected a created server order id");
});

test("full-catalog opening: a guest can order a formerly browse-only, non-premium dish", async () => {
  // THE acceptance test for the 2026-08-09 decision. Before it, this dish was
  // outside the curated hero set — browsable, never orderable (the charcoal-
  // smoothie dead end). It is not premium, so a guest order must sail through:
  // the premium gate exists to protect premium dishes, not to narrow the
  // opened catalog.
  const res = await placeOrder(orderBody(OPENED_DISH!.id));
  assert.equal(res.status, 201, JSON.stringify(res.json));
  assert.equal(res.json.status, "placed");
  assert.ok(res.json.totalPaise > 0, "server must price the order from the catalog");
});
