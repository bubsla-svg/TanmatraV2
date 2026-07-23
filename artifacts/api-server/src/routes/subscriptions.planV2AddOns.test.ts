/**
 * Integration tests for the plan-v2 add-on money path on the subscriptions
 * router — the two gaps closed here:
 *
 *   Gap 2 (create): a plan-review add-on (rd_bump, +₹499/mo) accepted at create
 *     is BILLED into the first-cycle order and PERSISTED to subscription_addons.
 *     A post_purchase add-on (evening_add) passed at create is persisted active
 *     but does NOT inflate the first bill. A disallowed add-on is a 422.
 *
 *   Gap 1 (post-purchase): POST/GET/DELETE /subscriptions/:id/add-ons attach,
 *     list, and soft-detach an add-on — allow-list enforced, idempotent, and
 *     scoped to the owner and to plan-v2 subscriptions.
 *
 * Mirrors subscriptions.planV2Trial.test.ts (tiny express app, stubbed auth,
 * real router, real Postgres). Run:
 *   DATABASE_URL=postgres://postgres@127.0.0.1:55433/money_test NODE_ENV=test \
 *   GOOGLE_API_KEY=test CLINICAL_KMS_MASTER_KEY=<64 hex> \
 *   node --test --import tsx ./src/routes/subscriptions.planV2AddOns.test.ts
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
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  usersTable,
  ordersTable,
  subscriptionsTable,
  subscriptionAddonsTable,
} from "@workspace/db";
import { ADD_ONS, computePlanQuote } from "@workspace/subscription-rules";

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
    email: `pv2-addon-${id}@example.test`,
    firstName: "PlanV2",
    lastName: "AddOn",
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
    cadence: "monthly",
    mealsPerDelivery: 3,
    deliveryWindow: "12:00-14:00",
    startDate: tomorrowISO(),
    members: [{ name: "Primary", diet: "any", allergens: [], spiceLevel: "medium" }],
    defaultItems: [],
    ...extra,
  };
}

async function orderChargeFor(subId: number, userId: string): Promise<number | null> {
  const [order] = await db
    .select({ chargePaise: ordersTable.chargePaise, totalPaise: ordersTable.totalPaise })
    .from(ordersTable)
    .where(and(eq(ordersTable.externalOrderId, `sub-${subId}`), eq(ordersTable.userId, userId)))
    .limit(1);
  return order ? order.chargePaise ?? order.totalPaise : null;
}

await new Promise<void>((resolve) => {
  server = makeApp().listen(0, () => {
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    resolve();
  });
});

after(async () => {
  process.env["FLAG_PLAN_V2"] = "";
  if (CREATED_USER_IDS.length > 0) {
    const subs = await db
      .select({ id: subscriptionsTable.id })
      .from(subscriptionsTable)
      .where(inArray(subscriptionsTable.userId, CREATED_USER_IDS));
    const subIds = subs.map((s) => s.id);
    if (subIds.length > 0) {
      await db
        .delete(subscriptionAddonsTable)
        .where(inArray(subscriptionAddonsTable.subscriptionId, subIds));
    }
    await db.delete(ordersTable).where(inArray(ordersTable.userId, CREATED_USER_IDS));
    await db.delete(subscriptionsTable).where(inArray(subscriptionsTable.userId, CREATED_USER_IDS));
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test("create: RD bump is billed into the first order and persisted active", async () => {
  process.env["FLAG_PLAN_V2"] = "true";
  const user = await makeUser();
  const r = await api(
    "POST",
    "/subscriptions",
    baseBody({ planId: "desk_fuel", track: "veg", addOns: ["rd_bump"] }),
    user,
  );
  assert.equal(r.status, 201, JSON.stringify(r.json));
  const expected = computePlanQuote("desk_fuel").cycleTotalPaise + ADD_ONS.rd_bump.pricePaise;
  assert.equal(r.json.subscription.pricePerDeliveryPaise, expected, "plan + ₹499 bump");

  const subId = r.json.subscription.id as number;
  assert.equal(await orderChargeFor(subId, user.id), expected, "the order charges plan + bump");

  const rows = await db
    .select()
    .from(subscriptionAddonsTable)
    .where(eq(subscriptionAddonsTable.subscriptionId, subId));
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.addonId, "rd_bump");
  assert.equal(rows[0]?.pricePaise, ADD_ONS.rd_bump.pricePaise);
  assert.equal(rows[0]?.cadence, "monthly");
  assert.equal(rows[0]?.active, true);
});

test("create: a post-purchase add-on (evening_add) is persisted but NOT billed now", async () => {
  process.env["FLAG_PLAN_V2"] = "true";
  const user = await makeUser();
  const r = await api(
    "POST",
    "/subscriptions",
    baseBody({ planId: "desk_fuel", track: "veg", addOns: ["evening_add"] }),
    user,
  );
  assert.equal(r.status, 201, JSON.stringify(r.json));
  const base = computePlanQuote("desk_fuel").cycleTotalPaise;
  assert.equal(r.json.subscription.pricePerDeliveryPaise, base, "evening_add never inflates the first bill");

  const subId = r.json.subscription.id as number;
  assert.equal(await orderChargeFor(subId, user.id), base, "the first order is the plan price only");

  const rows = await db
    .select()
    .from(subscriptionAddonsTable)
    .where(eq(subscriptionAddonsTable.subscriptionId, subId));
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.addonId, "evening_add");
  assert.equal(rows[0]?.cadence, "weekly");
});

test("create: an add-on the plan does not allow is a 422", async () => {
  process.env["FLAG_PLAN_V2"] = "true";
  const user = await makeUser();
  // protein_build allows only evening_add.
  const r = await api(
    "POST",
    "/subscriptions",
    baseBody({ planId: "protein_build", track: "veg", addOns: ["rd_bump"] }),
    user,
  );
  assert.equal(r.status, 422, JSON.stringify(r.json));
  assert.equal(r.json.code, "addon_not_allowed");
  assert.deepEqual(r.json.rejected, ["rd_bump"]);
});

test("post-purchase: attach evening_add, then list it", async () => {
  process.env["FLAG_PLAN_V2"] = "true";
  const user = await makeUser();
  const created = await api(
    "POST",
    "/subscriptions",
    baseBody({ planId: "desk_fuel", track: "veg" }),
    user,
  );
  const subId = created.json.subscription.id as number;

  const attach = await api("POST", `/subscriptions/${subId}/add-ons`, { addOnId: "evening_add" }, user);
  assert.equal(attach.status, 201, JSON.stringify(attach.json));
  assert.equal(attach.json.addOn.addonId, "evening_add");
  assert.equal(attach.json.addOn.pricePaise, ADD_ONS.evening_add.pricePaise);
  assert.equal(attach.json.addOn.cadence, "weekly");

  const list = await api("GET", `/subscriptions/${subId}/add-ons`, null, user);
  assert.equal(list.status, 200);
  assert.equal(list.json.addOns.filter((a: any) => a.active).length, 1);
});

test("post-purchase: attach is idempotent — a re-tap does not duplicate", async () => {
  process.env["FLAG_PLAN_V2"] = "true";
  const user = await makeUser();
  const created = await api("POST", "/subscriptions", baseBody({ planId: "desk_fuel", track: "veg" }), user);
  const subId = created.json.subscription.id as number;

  const first = await api("POST", `/subscriptions/${subId}/add-ons`, { addOnId: "evening_add" }, user);
  assert.equal(first.status, 201);
  const second = await api("POST", `/subscriptions/${subId}/add-ons`, { addOnId: "evening_add" }, user);
  assert.equal(second.status, 200, JSON.stringify(second.json));
  assert.equal(second.json.alreadyActive, true);

  const active = await db
    .select()
    .from(subscriptionAddonsTable)
    .where(
      and(
        eq(subscriptionAddonsTable.subscriptionId, subId),
        eq(subscriptionAddonsTable.addonId, "evening_add"),
        eq(subscriptionAddonsTable.active, true),
      ),
    );
  assert.equal(active.length, 1, "exactly one active row despite two attaches");
});

test("post-purchase: attaching an add-on the plan does not allow is a 422", async () => {
  process.env["FLAG_PLAN_V2"] = "true";
  const user = await makeUser();
  // protein_build permits only evening_add — rd_bump must be refused.
  const created = await api("POST", "/subscriptions", baseBody({ planId: "protein_build", track: "veg" }), user);
  const subId = created.json.subscription.id as number;

  const attach = await api("POST", `/subscriptions/${subId}/add-ons`, { addOnId: "rd_bump" }, user);
  assert.equal(attach.status, 422, JSON.stringify(attach.json));
  assert.equal(attach.json.code, "addon_not_allowed");
});

test("post-purchase: detach soft-deactivates the add-on", async () => {
  process.env["FLAG_PLAN_V2"] = "true";
  const user = await makeUser();
  const created = await api("POST", "/subscriptions", baseBody({ planId: "desk_fuel", track: "veg" }), user);
  const subId = created.json.subscription.id as number;
  await api("POST", `/subscriptions/${subId}/add-ons`, { addOnId: "evening_add" }, user);

  const del = await api("DELETE", `/subscriptions/${subId}/add-ons/evening_add`, null, user);
  assert.equal(del.status, 200, JSON.stringify(del.json));
  assert.equal(del.json.detached, "evening_add");

  const rows = await db
    .select()
    .from(subscriptionAddonsTable)
    .where(eq(subscriptionAddonsTable.subscriptionId, subId));
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.active, false, "row is soft-detached, audit trail preserved");
});

test("post-purchase: a non-plan-v2 subscription cannot attach add-ons (409)", async () => {
  // Flag OFF → planId ignored → no plan_v2 tag in notes.
  process.env["FLAG_PLAN_V2"] = "";
  const user = await makeUser();
  const created = await api("POST", "/subscriptions", baseBody({ planId: "desk_fuel", track: "veg" }), user);
  const subId = created.json.subscription.id as number;

  process.env["FLAG_PLAN_V2"] = "true";
  const attach = await api("POST", `/subscriptions/${subId}/add-ons`, { addOnId: "rd_bump" }, user);
  assert.equal(attach.status, 409, JSON.stringify(attach.json));
  assert.equal(attach.json.code, "not_plan_v2");
});

test("post-purchase: cannot attach to another user's subscription (404)", async () => {
  process.env["FLAG_PLAN_V2"] = "true";
  const owner = await makeUser();
  const stranger = await makeUser();
  const created = await api("POST", "/subscriptions", baseBody({ planId: "desk_fuel", track: "veg" }), owner);
  const subId = created.json.subscription.id as number;

  const attach = await api("POST", `/subscriptions/${subId}/add-ons`, { addOnId: "evening_add" }, stranger);
  assert.equal(attach.status, 404, JSON.stringify(attach.json));
});
