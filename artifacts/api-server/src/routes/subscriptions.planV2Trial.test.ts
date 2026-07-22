/**
 * Integration tests for the plan-v2 3-Day Taste Test create path (S5b) on the
 * subscriptions router:
 *
 *   1. FLAG_PLAN_V2 on + planId:"trial_3day" → priced from the plan spine
 *      (₹399 flat), one delivery, and trialState "trial_purchased" so the
 *      paid-time creditback seam can fire.
 *   2. A phone that already redeemed a paid trial (a trial_redemptions row
 *      exists) is refused at create with 409 trial_already_redeemed — the
 *      friendly early rejection ahead of the durable UNIQUE.
 *   3. FLAG_PLAN_V2 off → the whole plan-v2 branch (and its gate) is dark: the
 *      same already-redeemed phone creates a normal subscription.
 *
 * Mirrors subscriptions.trial.test.ts (tiny express app, stubbed auth, real
 * router, real Postgres). Run with a DATABASE_URL pointed at a real Postgres:
 *   DATABASE_URL=postgres://postgres@localhost:55433/money_test NODE_ENV=test \
 *   GOOGLE_API_KEY=test CLINICAL_KMS_MASTER_KEY=<64 hex> \
 *   node --test --import tsx ./src/routes/subscriptions.planV2Trial.test.ts
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
import {
  db,
  usersTable,
  ordersTable,
  trialRedemptionsTable,
} from "@workspace/db";
import { computePlanQuote } from "@workspace/subscription-rules";

import subscriptionsRouter from "./subscriptions";
import { hashTrialPhone } from "../lib/trialEligibility";

interface TestUser {
  id: string;
}

let server: http.Server;
let baseUrl = "";
const CREATED_USER_IDS: string[] = [];
const SEEDED_PHONE_HASHES: string[] = [];
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
    email: `pv2-trial-${id}@example.test`,
    firstName: "PlanV2",
    lastName: "Tester",
  });
  CREATED_USER_IDS.push(id);
  const u = { id };
  REGISTRY.set(id, u);
  return u;
}

let phoneSeq = 0;
function freshPhone(): string {
  phoneSeq += 1;
  return `9955${String(100000 + phoneSeq).slice(-6)}`;
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
    mealsPerDelivery: 3,
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
  process.env["FLAG_PLAN_V2"] = "";
  if (SEEDED_PHONE_HASHES.length > 0) {
    await db
      .delete(trialRedemptionsTable)
      .where(inArray(trialRedemptionsTable.phoneHash, SEEDED_PHONE_HASHES));
  }
  if (CREATED_USER_IDS.length > 0) {
    await db.delete(ordersTable).where(inArray(ordersTable.userId, CREATED_USER_IDS));
    // trial_redemptions.user_id is set null on user delete, so also clear by
    // the user ids we own (belt and suspenders with the phone-hash sweep).
    await db
      .delete(trialRedemptionsTable)
      .where(inArray(trialRedemptionsTable.userId, CREATED_USER_IDS));
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test("plan-v2 trial_3day prices from the spine and persists trialState", async () => {
  process.env["FLAG_PLAN_V2"] = "true";
  const user = await makeUser();
  const phone = freshPhone();
  const r = await api(
    "POST",
    "/subscriptions",
    baseBody({ planId: "trial_3day", track: "veg", phone }),
    user,
  );
  assert.equal(r.status, 201, JSON.stringify(r.json));
  assert.equal(
    r.json.subscription.pricePerDeliveryPaise,
    computePlanQuote("trial_3day").cycleTotalPaise,
    "trial is priced by the plan spine (₹399 flat)",
  );
  assert.equal(r.json.subscription.trialState, "trial_purchased");
  assert.match(String(r.json.subscription.notes), /plan_v2:trial_3day/);
  assert.equal(r.json.deliveries.length, 1, "trial generates exactly one delivery");
});

test("a phone that already redeemed a trial is refused at create with 409", async () => {
  process.env["FLAG_PLAN_V2"] = "true";
  const user = await makeUser();
  const phone = freshPhone();
  const phoneHash = hashTrialPhone(phone);
  SEEDED_PHONE_HASHES.push(phoneHash);

  // Simulate a prior PAID trial for this phone (the durable ledger row).
  await db.insert(trialRedemptionsTable).values({ phoneHash, userId: user.id });

  const r = await api(
    "POST",
    "/subscriptions",
    baseBody({ planId: "trial_3day", track: "veg", phone }),
    user,
  );
  assert.equal(r.status, 409, JSON.stringify(r.json));
  assert.equal(r.json.code, "trial_already_redeemed");
});

test("flag OFF: the gate is dark — an already-redeemed phone still creates", async () => {
  process.env["FLAG_PLAN_V2"] = "";
  const user = await makeUser();
  const phone = freshPhone();
  const phoneHash = hashTrialPhone(phone);
  SEEDED_PHONE_HASHES.push(phoneHash);
  await db.insert(trialRedemptionsTable).values({ phoneHash, userId: user.id });

  // With the flag off, planId is ignored entirely — this is a normal
  // (standard) subscription create, unaffected by the trial ledger.
  const r = await api(
    "POST",
    "/subscriptions",
    baseBody({ planId: "trial_3day", track: "veg", phone }),
    user,
  );
  assert.equal(r.status, 201, JSON.stringify(r.json));
  assert.notEqual(r.json.subscription.trialState, "trial_purchased");
});
