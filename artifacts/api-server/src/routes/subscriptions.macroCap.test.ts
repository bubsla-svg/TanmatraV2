/**
 * Integration tests for macro-cap validation on
 * POST /subscription-deliveries/:id/swap.
 *
 * Closes a PR-07 gap: swap candidates were only checked for allergen/diet
 * safety, never against the subscriber's daily calorie target. A member
 * with no dailyCalorieTarget set (the common case for guest/household
 * members with no independent profile) is never blocked — the check is
 * opt-in via a real target, never a fabricated one.
 *
 * Run with:
 *   node --test --import tsx ./src/routes/subscriptions.macroCap.test.ts
 */
import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";
import { type AddressInfo } from "node:net";
import http from "node:http";

import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { eq, inArray } from "drizzle-orm";
import { db, usersTable, subscriptionsTable, userPreferencesTable, ordersTable } from "@workspace/db";

import subscriptionsRouter from "./subscriptions";
import "../test-fixtures/dishes"; // registers TEST_DISHES (480 kcal each) into the catalog

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
    email: `sub-macrocap-${id}@example.test`,
    firstName: "Macro",
    lastName: "Cap",
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
      // Fresh key per call — see idempotencyMiddleware on POST /subscriptions.
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

/** Creates an active weekly subscription with one member and returns
 * {subId, memberId, deliveryId} for the earliest generated delivery. */
async function seedSubscription(
  user: TestUser,
  memberDailyCalorieTarget?: number,
): Promise<{ subId: number; memberId: number; deliveryId: number }> {
  const created = await api(
    "POST",
    "/subscriptions",
    {
      cadence: "weekly",
      mealsPerDelivery: 5,
      deliveryWindow: "12:00-14:00",
      startDate: futureISO(3),
      planType: "standard",
      // planId became required for new signups ("legacy pricing is disabled")
      // after this file was written; other subscription test files already
      // pass one (see subscriptions.creditLedger.test.ts, .catalogQuote.test.ts).
      planId: "desk_fuel",
      track: "veg",
      members: [
        {
          name: "Primary",
          diet: "any",
          allergens: [],
          spiceLevel: "medium",
          ...(memberDailyCalorieTarget != null
            ? { dailyCalorieTarget: memberDailyCalorieTarget }
            : {}),
        },
      ],
      defaultItems: [],
    },
    user,
  );
  assert.equal(created.status, 201, JSON.stringify(created.json));
  const subId = created.json.subscription.id as number;
  await db.update(subscriptionsTable).set({ status: "active" }).where(eq(subscriptionsTable.id, subId));

  const got = await api("GET", `/subscriptions/${subId}`, undefined, user);
  assert.equal(got.status, 200, JSON.stringify(got.json));
  const memberId = got.json.members[0].id as number;
  const deliveryId = got.json.deliveries[0].id as number;
  return { subId, memberId, deliveryId };
}

after(async () => {
  if (CREATED_USER_IDS.length > 0) {
    // orders.user_id has no cascade — POST /subscriptions creates a linked
    // first-cycle order (see #220), which must be deleted before the user.
    await db.delete(ordersTable).where(inArray(ordersTable.userId, CREATED_USER_IDS));
    await db.delete(userPreferencesTable).where(inArray(userPreferencesTable.userId, CREATED_USER_IDS));
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
});

test("setup: start server", async () => {
  server = http.createServer(makeApp());
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test("swap is rejected when the candidate dish exceeds the member's per-meal calorie allowance", async () => {
  const user = await makeUser();
  // Target 300 kcal/day, one meal that day → allowance 300, cap 345 (15%
  // tolerance). The 480 kcal fixture dish exceeds it.
  const { deliveryId, memberId } = await seedSubscription(user, 300);

  const res = await api(
    "POST",
    `/subscription-deliveries/${deliveryId}/swap`,
    {
      items: [
        {
          slug: "test-grilled-salmon",
          name: "Grilled Salmon",
          image: "/test/test-grilled-salmon.jpg",
          quantity: 1,
          unitPricePaise: 48500,
          memberId,
        },
      ],
    },
    user,
  );

  assert.equal(res.status, 422, JSON.stringify(res.json));
  assert.equal(res.json.code, "macro_cap_exceeded");
  assert.equal(res.json.reasons[0].slug, "test-grilled-salmon");
});

test("swap is allowed when the candidate dish is within the member's per-meal calorie allowance", async () => {
  const user = await makeUser();
  // Target 1000 kcal/day, one meal that day → allowance 1000, cap 1150.
  // The 480 kcal fixture dish is comfortably within it.
  const { deliveryId, memberId } = await seedSubscription(user, 1000);

  const res = await api(
    "POST",
    `/subscription-deliveries/${deliveryId}/swap`,
    {
      items: [
        {
          slug: "test-power-bowl",
          name: "Power Bowl",
          image: "/test/test-power-bowl.jpg",
          quantity: 1,
          unitPricePaise: 39500,
          memberId,
        },
      ],
    },
    user,
  );

  assert.equal(res.status, 200, JSON.stringify(res.json));
});

test("swap is never blocked for a member with no dailyCalorieTarget set", async () => {
  const user = await makeUser();
  // No target passed — the common case for a member with no independent
  // onboarding profile. The check must be skipped entirely, not fabricated.
  const { deliveryId, memberId } = await seedSubscription(user);

  const res = await api(
    "POST",
    `/subscription-deliveries/${deliveryId}/swap`,
    {
      items: [
        {
          slug: "test-keto-ribeye",
          name: "Keto Ribeye",
          image: "/test/test-keto-ribeye.jpg",
          quantity: 1,
          unitPricePaise: 62500,
          memberId,
        },
      ],
    },
    user,
  );

  assert.equal(res.status, 200, JSON.stringify(res.json));
});

test("a single-member subscription backfills the member's macro target from the account holder's userPreferences", async () => {
  const user = await makeUser();
  await db.insert(userPreferencesTable).values({
    userId: user.id,
    calorieTarget: 300,
    proteinTargetGrams: 40,
  });

  const { deliveryId, memberId } = await seedSubscription(user); // no explicit target passed

  // The backfilled target (300 kcal) should make the 480 kcal fixture dish
  // exceed the cap, proving the backfill actually took effect.
  const res = await api(
    "POST",
    `/subscription-deliveries/${deliveryId}/swap`,
    {
      items: [
        {
          slug: "test-miso-cod",
          name: "Miso Cod",
          image: "/test/test-miso-cod.jpg",
          quantity: 1,
          unitPricePaise: 54500,
          memberId,
        },
      ],
    },
    user,
  );

  assert.equal(res.status, 422, JSON.stringify(res.json));
  assert.equal(res.json.code, "macro_cap_exceeded");
});

test("teardown: stop server", async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
