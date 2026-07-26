/**
 * Integration tests for P-1: subscriptions-quote-via-catalog.
 * Verifies that:
 * (a) quote for each live plan×cycle equals the II.1 total exactly;
 * (b) a legacy-model subscription still renews at its grandfathered price;
 * (c) a new-signup request that names no catalog plan is 400/409, never a ₹750-derived quote.
 *
 * Run with:
 *   DATABASE_URL=... NODE_ENV=test GOOGLE_API_KEY=test CLINICAL_KMS_MASTER_KEY=<64 hex> \
 *   node --test --test-force-exit --import tsx ./src/routes/subscriptions.catalogQuote.test.ts
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
  subscriptionsTable,
} from "@workspace/db";

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
  await db.insert(usersTable).values({ id, email: `cat-quote-${id}@example.test`, firstName: "CatQuote" });
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

function futureISO(daysAhead: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

async function boot(): Promise<string> {
  if (baseUrl) return baseUrl;
  return new Promise<string>((resolve) => {
    const app = makeApp();
    server = app.listen(0, "127.0.0.1", () => {
      const port = (server.address() as AddressInfo).port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve(baseUrl);
    });
  });
}

after(async () => {
  if (server) await new Promise<void>((r) => server.close(() => r()));
  if (CREATED_USER_IDS.length > 0) {
    await db.delete(ordersTable).where(inArray(ordersTable.userId, CREATED_USER_IDS));
    await db.delete(subscriptionsTable).where(inArray(subscriptionsTable.userId, CREATED_USER_IDS));
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
});

test("(a) quote for each live plan×cycle equals the II.1 total exactly", async () => {
  await boot();
  const user = await makeUser();

  // desk_fuel (monthly 22 meals): ₹199 * 22 = ₹4,378 (437800 paise)
  const qFuel = await api("POST", "/subscriptions/quote", { planId: "desk_fuel", track: "veg", cadence: "monthly" }, user);
  assert.equal(qFuel.status, 200, JSON.stringify(qFuel.json));
  assert.equal(qFuel.json.totalPaise, 437800, "desk_fuel monthly quote must equal 437800 paise");

  // protein_build (monthly 22 meals): ₹249 * 22 = ₹5,478 (547800 paise)
  const qProtein = await api("POST", "/subscriptions/quote", { planId: "protein_build", track: "veg", cadence: "monthly" }, user);
  assert.equal(qProtein.status, 200, JSON.stringify(qProtein.json));
  assert.equal(qProtein.json.totalPaise, 547800, "protein_build monthly quote must equal 547800 paise");

  // trial_3day (one-off 3 meals): flat ₹399 (39900 paise)
  const qTrial = await api("POST", "/subscriptions/quote", { planId: "trial_3day", track: "veg", cadence: "monthly" }, user);
  assert.equal(qTrial.status, 200, JSON.stringify(qTrial.json));
  assert.equal(qTrial.json.totalPaise, 39900, "trial_3day quote must equal 39900 paise");

  // Creation of these live plans must also lock to these exact amounts
  const createdFuel = await api("POST", "/subscriptions", {
    planId: "desk_fuel",
    track: "veg",
    cadence: "monthly",
    mealsPerDelivery: 22,
    deliveryWindow: "12:00-14:00",
    startDate: futureISO(1),
    phone: "9876543210",
    members: [{ name: "Primary", diet: "any", allergens: [], spiceLevel: "medium" }],
  }, user);
  assert.equal(createdFuel.status, 201, JSON.stringify(createdFuel.json));
  assert.equal(createdFuel.json.subscription.pricePerDeliveryPaise, 437800, "created desk_fuel pricePerDeliveryPaise must equal 437800");
});

test("(b) a legacy-model subscription still renews at its grandfathered price", async () => {
  await boot();
  const user = await makeUser();

  // Grandfathered monthly 30 meals legacy price from pricing.ts: ₹21,660 (2166000 paise)
  const [legacySub] = await db
    .insert(subscriptionsTable)
    .values({
      userId: user.id,
      status: "active",
      cadence: "monthly",
      mealsPerDelivery: 30,
      deliveryWindow: "12:00-14:00",
      pricePerDeliveryPaise: 2166000,
      startDate: new Date(),
      nextDeliveryAt: new Date(),
    })
    .returning();

  const gen = await api("POST", `/subscriptions/${legacySub!.id}/generate-next`, {}, user);
  assert.equal(gen.status, 200, JSON.stringify(gen.json));

  const [afterGen] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, legacySub!.id));
  assert.equal(afterGen!.pricePerDeliveryPaise, 2166000, "Grandfathered legacy price must remain intact upon renewal rollover");
});

test("(c) a new-signup request that names no catalog plan is 400/409, never a ₹750-derived quote", async () => {
  await boot();
  const user = await makeUser();

  // Quote without planId must fail with 400
  const qLegacy = await api("POST", "/subscriptions/quote", { mealsPerDelivery: 30, cadence: "monthly" }, user);
  assert.equal(qLegacy.status, 400, "Must reject quote request without planId");
  assert.equal(qLegacy.json?.code, "legacy_pricing_disabled");
  assert.notEqual(qLegacy.json?.totalPaise, 2166000, "Must never return legacy ₹750-derived quotes");

  // Create without planId must fail with 400
  const createLegacy = await api("POST", "/subscriptions", {
    cadence: "monthly",
    mealsPerDelivery: 30,
    deliveryWindow: "12:00-14:00",
    startDate: futureISO(1),
    phone: "9876543210",
    members: [{ name: "Primary", diet: "any", allergens: [], spiceLevel: "medium" }],
  }, user);
  assert.equal(createLegacy.status, 400, "Must reject signup request without planId");
  assert.equal(createLegacy.json?.code, "legacy_pricing_disabled");
});
