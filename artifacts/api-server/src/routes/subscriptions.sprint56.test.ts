import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";
import { type AddressInfo } from "node:net";
import http from "node:http";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { db, usersTable, subscriptionsTable, subscriptionDeliveriesTable, preDebitNotificationsTable, subscriptionMandatesTable, ordersTable } from "@workspace/db";

import subscriptionsRouter from "./subscriptions";
import paymentsRouter from "./payments";

process.env["RAZORPAY_KEY_ID"] = "rzp_test_sprint56";
process.env["RAZORPAY_KEY_SECRET"] = "secret_test_sprint56";

// /payments/charge-mandate is ops-gated (see routes/payments.ts) — set the
// same shared secret the route reads so the suite is self-contained.
const ADMIN_TOKEN = "test_admin_tok_sprint56";
process.env["RD_ADMIN_TOKEN"] = ADMIN_TOKEN;

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
  app.use(paymentsRouter);
  return app;
}

async function makeUser(): Promise<TestUser> {
  const id = randomUUID();
  await db.insert(usersTable).values({
    id,
    email: `sub-sprint56-${id}@example.test`,
    firstName: "Sprint",
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
  extraHeaders?: Record<string, string>,
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(user ? { "x-test-user-id": user.id } : {}),
      ...extraHeaders,
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
    // orders.user_id has no cascade (financial records must not silently
    // vanish on user delete) — POST /subscriptions now creates a linked
    // first-cycle order, so it must be cleared before the user row.
    await db.delete(ordersTable).where(inArray(ordersTable.userId, CREATED_USER_IDS));
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test("trial created sets trialState = trial_purchased", async () => {
  const user = await makeUser();
  const r = await api("POST", "/subscriptions", baseBody({ planType: "trial" }), user);
  assert.equal(r.status, 201, JSON.stringify(r.json));
  assert.equal(r.json.subscription.trialState, "trial_purchased");
});

test("update trial state endpoint transitions state", async () => {
  const user = await makeUser();
  const created = await api("POST", "/subscriptions", baseBody({ planType: "trial" }), user);
  const subId = created.json.subscription.id;

  // Transition to active
  let r = await api("POST", `/subscriptions/${subId}/trial-state`, { event: "delivery_active" }, user);
  assert.equal(r.status, 200, JSON.stringify(r.json));
  
  let [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, subId));
  assert.equal(sub!.trialState, "trial_active");

  // Insert 3 deliveries to qualify for bridge transition
  await db.insert(subscriptionDeliveriesTable).values([
    { subscriptionId: subId, status: "delivered", scheduledFor: new Date("2026-07-13"), deliveryWindow: "morning", items: [] },
    { subscriptionId: subId, status: "delivered", scheduledFor: new Date("2026-07-14"), deliveryWindow: "morning", items: [] },
    { subscriptionId: subId, status: "delivered", scheduledFor: new Date("2026-07-15"), deliveryWindow: "morning", items: [] },
  ]);

  // Transition to eligible
  r = await api("POST", `/subscriptions/${subId}/trial-state`, { event: "delivery_delivered" }, user);
  assert.equal(r.status, 200, JSON.stringify(r.json));
  
  let [subUpdated] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, subId));
  assert.equal(subUpdated!.trialState, "trial_bridge_eligible");
});

test("GET /subscriptions/:id/trial-recap sums delivered macros", async () => {
  const user = await makeUser();
  const created = await api("POST", "/subscriptions", baseBody({ planType: "trial" }), user);
  const subId = created.json.subscription.id;

  // Transition to active
  await api("POST", `/subscriptions/${subId}/trial-state`, { event: "delivery_active" }, user);

  // Insert 3 mock delivered deliveries with items
  const [delivery] = await db
    .select()
    .from(subscriptionDeliveriesTable)
    .where(eq(subscriptionDeliveriesTable.subscriptionId, subId))
    .limit(1);

  if (delivery) {
    await db
      .update(subscriptionDeliveriesTable)
      .set({
        status: "delivered",
        items: [
          {
            slug: "aglio-olio-veg",
            name: "Aglio Olio - Veg",
            quantity: 3,
            unitPricePaise: 13000,
            image: "/images/dishes/aglio-olio-veg.jpg",
          },
        ],
      })
      .where(eq(subscriptionDeliveriesTable.id, delivery.id));
  }

  // Insert two more mock delivered deliveries to fulfill >= 3 criteria
  await db.insert(subscriptionDeliveriesTable).values([
    {
      subscriptionId: subId,
      status: "delivered",
      scheduledFor: new Date("2026-07-13"),
      deliveryWindow: "morning",
      items: [
        {
          slug: "aglio-olio-veg",
          name: "Aglio Olio - Veg",
          quantity: 2,
          unitPricePaise: 13000,
          image: "/images/dishes/aglio-olio-veg.jpg",
        },
      ],
    },
    {
      subscriptionId: subId,
      status: "delivered",
      scheduledFor: new Date("2026-07-14"),
      deliveryWindow: "morning",
      items: [
        {
          slug: "aglio-olio-veg",
          name: "Aglio Olio - Veg",
          quantity: 1,
          unitPricePaise: 13000,
          image: "/images/dishes/aglio-olio-veg.jpg",
        },
      ],
    },
  ]);

  // Transition to eligible
  await api("POST", `/subscriptions/${subId}/trial-state`, { event: "delivery_delivered" }, user);

  const recap = await api("GET", `/subscriptions/${subId}/trial-recap`, null, user);
  assert.equal(recap.status, 200, JSON.stringify(recap.json));
  assert.ok(recap.json.stats.calories > 0, "calories should be summed");
  assert.ok(recap.json.stats.protein > 0, "protein should be summed");
  assert.ok(recap.json.holdExpiration != null, "holdExpiration must be returned");
});

test("converting trial fails if capacity hold has expired (Simulated PAST date)", async () => {
  const user = await makeUser();
  const created = await api("POST", "/subscriptions", baseBody({ planType: "trial" }), user);
  const subId = created.json.subscription.id;

  // Manually update the subscription's createdAt to 10 days ago so the hold is expired
  const tenDaysAgo = new Date();
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
  await db
    .update(subscriptionsTable)
    .set({ createdAt: tenDaysAgo })
    .where(eq(subscriptionsTable.id, subId));

  const conv = await api("POST", `/subscriptions/${subId}/convert`, { cadence: "weekly", mealsPerDelivery: 5 }, user);
  assert.equal(conv.status, 409, "Must return 409 conflict when hold has expired");
  assert.match(String(conv.json.error), /hold expired/i);
});

test("pre-debit guard blocks mandate charge if notification dispatch missing", async () => {
  const user = await makeUser();
  const created = await api("POST", "/subscriptions", baseBody({ planType: "standard" }), user);
  const subId = created.json.subscription.id;

  // Create active mandate
  await db.insert(subscriptionMandatesTable).values({
    subscriptionId: subId,
    razorpayCustomerId: "cust_test",
    razorpayTokenId: "tok_test",
    status: "active",
  });

  // Attempting to charge mandate without pre-debit notification should fail
  // (ops-credentialed request — the business-logic guard is what's under test).
  const charge = await api("POST", "/payments/charge-mandate", {
    subscriptionId: subId,
    amountPaise: 380000,
    scheduledChargeDate: new Date(),
  }, user, { "x-admin-token": ADMIN_TOKEN });
  assert.equal(charge.status, 400, JSON.stringify(charge.json));
  assert.match(String(charge.json.error), /pre-debit notification/i);
});

test("charge-mandate: unauthenticated/wrongly-credentialed request is rejected (403)", async () => {
  const user = await makeUser();
  const created = await api("POST", "/subscriptions", baseBody({ planType: "standard" }), user);
  const subId = created.json.subscription.id;

  await db.insert(subscriptionMandatesTable).values({
    subscriptionId: subId,
    razorpayCustomerId: "cust_test",
    razorpayTokenId: "tok_test",
    status: "active",
  });

  const body = {
    subscriptionId: subId,
    amountPaise: 380000,
    scheduledChargeDate: new Date(),
  };

  // No credential at all — a plain customer session must not be able to
  // trigger a mandate charge.
  const noToken = await api("POST", "/payments/charge-mandate", body, user);
  assert.equal(noToken.status, 403, JSON.stringify(noToken.json));

  // Wrong token — must not be treated as ops-authorized.
  const wrongToken = await api("POST", "/payments/charge-mandate", body, user, {
    "x-admin-token": "not-the-real-token",
  });
  assert.equal(wrongToken.status, 403, JSON.stringify(wrongToken.json));
});

test("jobs/pre-debit-notifications: unauthenticated request is rejected (403), credentialed request succeeds", async () => {
  const noToken = await api("POST", "/jobs/pre-debit-notifications", {});
  assert.equal(noToken.status, 403, JSON.stringify(noToken.json));

  const wrongToken = await api("POST", "/jobs/pre-debit-notifications", {}, undefined, {
    "x-admin-token": "not-the-real-token",
  });
  assert.equal(wrongToken.status, 403, JSON.stringify(wrongToken.json));

  const authed = await api("POST", "/jobs/pre-debit-notifications", {}, undefined, {
    "x-admin-token": ADMIN_TOKEN,
  });
  assert.equal(authed.status, 200, JSON.stringify(authed.json));
  assert.equal(authed.json.success, true);
});
