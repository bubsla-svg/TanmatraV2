/**
 * POST /subscriptions idempotency (integration, real Postgres).
 *
 * Why this exists: a double-POST to this route was NOT self-deduping. Each
 * attempt mints a fresh subscription id, so the linked order's `sub-<id>`
 * externalOrderId differs between attempts and the order insert's
 * onConflictDoNothing never matches — an unguarded network retry created a
 * second subscription, second order, second delivery schedule and a second
 * credit debit. The route now mounts idempotencyMiddleware inline (same
 * pattern as loyalty.ts /orders/finalize), and these tests pin the contract:
 *
 *   1. Missing Idempotency-Key → 400 idempotency_key_required (the mount
 *      itself — this is what stops a client regressing to headerless calls).
 *   2. Same key + same body → the SECOND response is a verbatim replay
 *      (Idempotent-Replay: true), and the user has exactly ONE subscription
 *      and ONE order row. The kill-shot assertion for the retry bug.
 *   3. Same key + different body → 409 idempotency_key_mismatch, loud.
 *   4. Different keys → distinct subscriptions (no over-deduplication).
 *
 * Harness mirrors subscriptions.order.test.ts: own express app, x-test-user-id
 * auth stub, real DB rows cleaned up in after().
 *
 * Run with:
 *   node --test --import tsx ./src/routes/subscriptions.idempotency.test.ts
 */

import assert from "node:assert/strict";
import { test, after, before } from "node:test";
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
  idempotencyKeysTable,
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
    email: `sub-idem-${id}@example.test`,
    firstName: "Idem",
    lastName: "Tester",
  });
  CREATED_USER_IDS.push(id);
  const u = { id };
  REGISTRY.set(id, u);
  return u;
}

/** Unlike the sibling files' helpers (fresh key per call), the key here is an
 *  EXPLICIT parameter — controlling replay vs fresh-create is the subject
 *  under test. `null` sends no header at all. */
async function api(
  method: string,
  path: string,
  body: unknown,
  user: TestUser,
  idempotencyKey: string | null,
): Promise<{ status: number; json: any; replayed: boolean }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-test-user-id": user.id,
      ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
    },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return {
    status: res.status,
    json: text ? JSON.parse(text) : null,
    replayed: res.headers.get("idempotent-replay") === "true",
  };
}

function tomorrowISO(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 2);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Plan-v2 shape, copied from subscriptions.creditLedger.test.ts — a file the
 *  money-integration job actually runs. `planId` is REQUIRED there: the CI
 *  environment has legacy pricing disabled, so a planId-less body 400s
 *  `legacy_pricing_disabled` before ever reaching the code under test. */
function baseBody(extra: Record<string, unknown>) {
  return {
    planId: "desk_fuel",
    track: "veg",
    cadence: "monthly",
    mealsPerDelivery: 22,
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

before(async () => {
  const app = makeApp();
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  if (CREATED_USER_IDS.length > 0) {
    // orders.user_id has no cascade — clear dependents before the user rows.
    await db
      .delete(idempotencyKeysTable)
      .where(inArray(idempotencyKeysTable.userId, CREATED_USER_IDS));
    await db.delete(ordersTable).where(inArray(ordersTable.userId, CREATED_USER_IDS));
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
});

// ---------------------------------------------------------------------------
// 1. The mount: no header, no create
// ---------------------------------------------------------------------------

test("POST /subscriptions without an Idempotency-Key is 400 and creates nothing", async () => {
  const user = await makeUser();
  const res = await api("POST", "/subscriptions", baseBody({ planType: "standard" }), user, null);
  assert.equal(res.status, 400, JSON.stringify(res.json));
  assert.equal(res.json.error, "idempotency_key_required");

  const subs = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, user.id));
  assert.equal(subs.length, 0, "a 400 must not have created a subscription");
});

// ---------------------------------------------------------------------------
// 2. The retry bug, pinned dead: same key + same body = ONE of everything
// ---------------------------------------------------------------------------

test("same key + same body: second POST replays the first 201 — one subscription, one order", async () => {
  const user = await makeUser();
  const key = `sub-${randomUUID()}`;
  const body = baseBody({ planType: "standard" });

  const first = await api("POST", "/subscriptions", body, user, key);
  assert.equal(first.status, 201, JSON.stringify(first.json));
  assert.equal(first.replayed, false);

  const second = await api("POST", "/subscriptions", body, user, key);
  assert.equal(second.status, 201, JSON.stringify(second.json));
  assert.equal(second.replayed, true, "second call must be a middleware replay");
  assert.equal(
    second.json.subscription.id,
    first.json.subscription.id,
    "replay must return the ORIGINAL subscription, not a new one",
  );

  // The assertion that used to fail: before the mount, the retry minted a
  // second subscription with its own `sub-<id>` order (onConflictDoNothing
  // can't dedupe across different externalOrderIds).
  const subs = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, user.id));
  assert.equal(subs.length, 1, `expected 1 subscription, got ${subs.length}`);

  const orders = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.userId, user.id));
  assert.equal(orders.length, 1, `expected 1 order, got ${orders.length}`);
});

// ---------------------------------------------------------------------------
// 3. Key reuse with a different body must be loud, never silently dropped
// ---------------------------------------------------------------------------

test("same key + different body is 409 idempotency_key_mismatch", async () => {
  const user = await makeUser();
  const key = `sub-${randomUUID()}`;

  const first = await api("POST", "/subscriptions", baseBody({ planType: "standard" }), user, key);
  assert.equal(first.status, 201, JSON.stringify(first.json));

  const second = await api(
    "POST",
    "/subscriptions",
    baseBody({ planType: "standard", mealsPerDelivery: 3 }),
    user,
    key,
  );
  assert.equal(second.status, 409, JSON.stringify(second.json));
  assert.equal(second.json.error, "idempotency_key_mismatch");
});

// ---------------------------------------------------------------------------
// 4. Fresh keys still create fresh subscriptions (no over-dedupe)
// ---------------------------------------------------------------------------

test("different keys create distinct subscriptions", async () => {
  const user = await makeUser();
  const body = baseBody({ planType: "standard" });

  const a = await api("POST", "/subscriptions", body, user, `sub-${randomUUID()}`);
  const b = await api("POST", "/subscriptions", body, user, `sub-${randomUUID()}`);
  assert.equal(a.status, 201, JSON.stringify(a.json));
  assert.equal(b.status, 201, JSON.stringify(b.json));
  assert.notEqual(a.json.subscription.id, b.json.subscription.id);

  const subs = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, user.id));
  assert.equal(subs.length, 2);
});
