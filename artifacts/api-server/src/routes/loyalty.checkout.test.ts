/**
 * Integration tests for the route-level checkout safety contract on
 * `POST /orders/finalize`:
 *
 *   1. The premium-meal gate returns 403 when a non-premium user has any
 *      premium-only dish in the cart, and lets a premium user through.
 *   2. The delivery-slot reservation honors `capacity` under concurrent
 *      finalize calls — exactly `capacity` calls succeed; the rest fail
 *      with 409 "delivery slot full". Persisted `reservedCount` matches
 *      the success count and never exceeds capacity.
 *
 * Run with:
 *   node --test --import tsx ./src/routes/loyalty.checkout.test.ts
 *
 * Stands up a tiny express app on a random port mounting the real loyalty
 * router with a stubbed auth middleware, just like groupOrders.test.ts.
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
  creditLedgerTable,
  db,
  deliverySlotsTable,
  deriveOperationalDate,
  orderClaimsTable,
  ordersTable,
  pickupLocationsTable,
  premiumMembershipsTable,
  premiumMealsTable,
  slotReservationsTable,
  usersTable,
  menuItemsTable,
} from "@workspace/db";
import { TEST_DISHES as DISHES } from "../test-fixtures/dishes.js";

import loyaltyRouter from "./loyalty";

const PREMIUM_SLUGS = [
  "alfredo-pasta-prawns",
  "pesto-pasta-prawns",
  "crispy-peri-peri-chicken-burrito-wrap",
] as const;

interface TestUser {
  id: string;
  firstName: string;
  email: string;
}

let server: http.Server;
let baseUrl = "";
const CREATED_USER_IDS: string[] = [];
const CREATED_PICKUP_IDS: number[] = [];
const CREATED_SLOT_IDS: number[] = [];
const USER_REGISTRY = new Map<string, TestUser>();

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
    const u = headerId ? USER_REGISTRY.get(headerId) : undefined;
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
  app.use(loyaltyRouter);
  return app;
}

async function makeUser(label: string): Promise<TestUser> {
  const id = randomUUID();
  await db.insert(usersTable).values({
    id,
    email: `loyalty-checkout-${label}-${id}@example.test`,
    firstName: label,
  });
  CREATED_USER_IDS.push(id);
  // Seed one delivered order so the first-order offer (25% up to ₹80)
  // never fires here — these tests lock in premium/slot behavior. The
  // offer itself is covered in loyaltyEngine.checkout.test.ts.
  await db.insert(ordersTable).values({
    userId: id,
    externalOrderId: `prior-${randomUUID()}`,
    status: "delivered",
    totalPaise: 10_000,
    items: [{ id: 1, name: "Prior Meal", qty: 1, price: 10_000 }],
    fulfillmentType: "delivery",
  });
  const user: TestUser = {
    id,
    firstName: label,
    email: `loyalty-checkout-${label}@example.test`,
  };
  USER_REGISTRY.set(id, user);
  return user;
}

async function makePickup(): Promise<number> {
  const [loc] = await db
    .insert(pickupLocationsTable)
    .values({
      name: `Loyalty Checkout Pickup ${randomUUID().slice(0, 6)}`,
      addressLine: "1 Test St",
      city: "Bengaluru",
      pincode: "560001",
      lat: 12.97,
      lng: 77.59,
      discountPaise: 0,
      active: true,
    })
    .returning();
  CREATED_PICKUP_IDS.push(loc!.id);
  return loc!.id;
}

async function makeSlot(capacity: number): Promise<number> {
  // Unique zone per slot so the (zone, startsAt, endsAt) unique index
  // can't collide across parallel test runs.
  const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const [row] = await db
    .insert(deliverySlotsTable)
    .values({
      slotDate: deriveOperationalDate(start),
      startsAt: start,
      endsAt: end,
      zone: `test-${randomUUID().slice(0, 8)}`,
      capacity,
      reservedCount: 0,
    })
    .returning();
  CREATED_SLOT_IDS.push(row!.id);
  return row!.id;
}

async function makePremium(userId: string): Promise<void> {
  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.insert(premiumMembershipsTable).values({
    userId,
    status: "active",
    currentPeriodEnd: periodEnd,
  });
}

async function api(
  method: string,
  path: string,
  body: unknown,
  user: TestUser,
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-test-user-id": user.id,
      "idempotency-key": randomUUID(),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

function pickAvailableNonPremium(n: number) {
  const skip = new Set<string>(PREMIUM_SLUGS);
  const pool = DISHES.filter(
    (d) => d.isAvailable && !skip.has(d.slug) && d.price > 0,
  );
  if (pool.length < n) throw new Error(`only ${pool.length} usable dishes`);
  return pool.slice(0, n);
}

function findPremiumDish() {
  for (const slug of PREMIUM_SLUGS) {
    const d = DISHES.find((d) => d.slug === slug);
    if (d) return d;
  }
  throw new Error("no premium dish in catalog");
}

before(async () => {
  // Make sure premium_meals is seeded with the curated slugs the route's
  // gate reads. The route's own ensurePremiumSeeded() runs lazily, but
  // we want the rows present even if the engine is exercised before any
  // /premium/* endpoint is hit during this test file.
  for (const slug of PREMIUM_SLUGS) {
    await db
      .insert(premiumMealsTable)
      .values({ dishSlug: slug, reason: "test seed" })
      .onConflictDoNothing({ target: premiumMealsTable.dishSlug });

    await db
      .update(menuItemsTable)
      .set({ allergenReviewState: "reviewed" })
      .where(eq(menuItemsTable.slug, slug));
  }

  const app = makeApp();
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
  if (CREATED_USER_IDS.length > 0) {
    await db
      .delete(slotReservationsTable)
      .where(inArray(slotReservationsTable.userId, CREATED_USER_IDS));
    await db
      .delete(orderClaimsTable)
      .where(inArray(orderClaimsTable.userId, CREATED_USER_IDS));
    await db
      .delete(ordersTable)
      .where(inArray(ordersTable.userId, CREATED_USER_IDS));
    await db
      .delete(creditLedgerTable)
      .where(inArray(creditLedgerTable.userId, CREATED_USER_IDS));
    await db
      .delete(premiumMembershipsTable)
      .where(inArray(premiumMembershipsTable.userId, CREATED_USER_IDS));
    await db
      .delete(usersTable)
      .where(inArray(usersTable.id, CREATED_USER_IDS));
  }
  for (const id of CREATED_SLOT_IDS) {
    await db
      .delete(slotReservationsTable)
      .where(eq(slotReservationsTable.slotId, id));
    await db.delete(deliverySlotsTable).where(eq(deliverySlotsTable.id, id));
  }
  for (const id of CREATED_PICKUP_IDS) {
    await db.delete(pickupLocationsTable).where(eq(pickupLocationsTable.id, id));
  }
});

test("POST /orders/finalize returns 403 when a non-premium user has a premium dish", async () => {
  const user = await makeUser("NonPremium");
  const pickupId = await makePickup();
  const premium = findPremiumDish();
  const [filler] = pickAvailableNonPremium(1);

  const r = await api(
    "POST",
    "/orders/finalize",
    {
      orderId: `ord-${randomUUID()}`,
      fulfillmentType: "pickup",
      pickupLocationId: pickupId,
      items: [
        { id: premium.id, name: premium.name, qty: 1, price: premium.price },
        { id: filler!.id, name: filler!.name, qty: 1, price: filler!.price },
      ],
    },
    user,
  );

  assert.equal(r.status, 403, `expected 403, got ${r.status}: ${JSON.stringify(r.json)}`);
  assert.match(String(r.json.error), /premium/i);

  // No order or claim row may have been written. makeUser seeds one
  // `prior-*` order (first-order-offer neutraliser), so exclude it.
  const orders = await db
    .select({
      id: ordersTable.id,
      externalOrderId: ordersTable.externalOrderId,
    })
    .from(ordersTable)
    .where(eq(ordersTable.userId, user.id));
  const nonSeeded = orders.filter(
    (o) => !String(o.externalOrderId ?? "").startsWith("prior-"),
  );
  assert.equal(nonSeeded.length, 0, "premium-gated order must not be persisted");
});

test("POST /orders/finalize lets a premium user complete an order with premium dishes", async () => {
  const user = await makeUser("Premium");
  await makePremium(user.id);
  const pickupId = await makePickup();
  const premium = findPremiumDish();

  const r = await api(
    "POST",
    "/orders/finalize",
    {
      orderId: `ord-${randomUUID()}`,
      fulfillmentType: "pickup",
      pickupLocationId: pickupId,
      items: [
        { id: premium.id, name: premium.name, qty: 1, price: premium.price },
      ],
    },
    user,
  );

  assert.equal(r.status, 200, `expected 200, got ${r.status}: ${JSON.stringify(r.json)}`);
  assert.equal(r.json.grossPaise, premium.price);
  assert.equal(r.json.finalPaise, premium.price);
});

// ---------------------------------------------------------------------------
// Owner containment gate (docs/MONEY-PATH-VERIFICATION.md "Settlement Trust
// Boundary"): ORDER_FINALIZE_DISABLED refuses this route with a typed 503,
// same shape as PLAN_CHECKOUT_DISABLED (subscriptions.idempotency.test.ts).
// ---------------------------------------------------------------------------

test("ORDER_FINALIZE_DISABLED: typed 503, nothing created, idempotency key not poisoned", async () => {
  const user = await makeUser("Gated");
  const pickupId = await makePickup();
  const [dish] = pickAvailableNonPremium(1);
  const body = {
    orderId: `ord-gated-${randomUUID()}`,
    fulfillmentType: "pickup",
    pickupLocationId: pickupId,
    items: [{ id: dish!.id, name: dish!.name, qty: 1, price: dish!.price }],
  };

  process.env["ORDER_FINALIZE_DISABLED"] = "1";
  try {
    const gated = await api("POST", "/orders/finalize", body, user);
    assert.equal(gated.status, 503, JSON.stringify(gated.json));
    assert.equal(gated.json.code, "CHECKOUT_TEMPORARILY_UNAVAILABLE");
    assert.equal(
      gated.json.message,
      "Checkout is temporarily unavailable. Please try again shortly.",
    );

    const orders = await db
      .select({ externalOrderId: ordersTable.externalOrderId })
      .from(ordersTable)
      .where(eq(ordersTable.userId, user.id));
    const nonSeeded = orders.filter(
      (o) => !String(o.externalOrderId ?? "").startsWith("prior-"),
    );
    assert.equal(nonSeeded.length, 0, "a gated request must create nothing");
  } finally {
    delete process.env["ORDER_FINALIZE_DISABLED"];
  }
});

test("ORDER_FINALIZE_DISABLED unset: the route behaves exactly as before — the control", async () => {
  // Without this, the gate test above would pass just as happily if the
  // route were broken for every request regardless of the flag.
  const user = await makeUser("Ungated");
  const pickupId = await makePickup();
  const [dish] = pickAvailableNonPremium(1);

  const r = await api(
    "POST",
    "/orders/finalize",
    {
      orderId: `ord-ungated-${randomUUID()}`,
      fulfillmentType: "pickup",
      pickupLocationId: pickupId,
      items: [{ id: dish!.id, name: dish!.name, qty: 1, price: dish!.price }],
    },
    user,
  );

  assert.equal(r.status, 200, `expected 200, got ${r.status}: ${JSON.stringify(r.json)}`);
});

test("POST /orders/finalize honors slot capacity under concurrent finalize calls", async () => {
  const capacity = 2;
  const concurrentCallers = 5;
  const slotId = await makeSlot(capacity);
  const [dish] = pickAvailableNonPremium(1);

  const users = await Promise.all(
    Array.from({ length: concurrentCallers }, (_, i) => makeUser(`Slot${i}`)),
  );

  const responses = await Promise.all(
    users.map((u) =>
      api(
        "POST",
        "/orders/finalize",
        {
          orderId: `ord-${randomUUID()}`,
          fulfillmentType: "delivery",
          deliverySlotId: slotId,
          address: {
            label: "Home",
            line: "1 Test Lane",
            city: "Noida",
            pincode: "201301",
          },
          items: [
            { id: dish!.id, name: dish!.name, qty: 1, price: dish!.price },
          ],
        },
        u,
      ),
    ),
  );

  const successes = responses.filter((r) => r.status === 200);
  const conflicts = responses.filter((r) => r.status === 409);
  const other = responses.filter(
    (r) => r.status !== 200 && r.status !== 409,
  );

  assert.equal(
    other.length,
    0,
    `unexpected statuses: ${JSON.stringify(other.map((r) => ({ s: r.status, b: r.json })))}`,
  );
  assert.equal(
    successes.length,
    capacity,
    `exactly capacity (${capacity}) finalize calls must succeed, got ${successes.length}`,
  );
  assert.equal(
    conflicts.length,
    concurrentCallers - capacity,
    `the rest must 409 with delivery slot full`,
  );
  for (const c of conflicts) {
    assert.match(String(c.json.error), /delivery slot full/i);
  }

  // Reload the slot row — reservedCount must equal capacity, never more.
  const [persisted] = await db
    .select()
    .from(deliverySlotsTable)
    .where(eq(deliverySlotsTable.id, slotId));
  assert.ok(persisted);
  assert.equal(
    persisted!.reservedCount,
    capacity,
    "reservedCount must match capacity, never exceed it",
  );

  // And the slot_reservations table should hold exactly `capacity` rows
  // for this slot — one per successful order.
  const reservations = await db
    .select({ id: slotReservationsTable.id })
    .from(slotReservationsTable)
    .where(eq(slotReservationsTable.slotId, slotId));
  assert.equal(reservations.length, capacity);
});

test("POST /orders/finalize auto-assigns an ASAP slot when delivery arrives with no slot", async () => {
  const user = await makeUser("AsapNow");
  // Guarantee at least one open future window exists for the auto-assign.
  const slotId = await makeSlot(5);
  const [dish] = pickAvailableNonPremium(1);

  const r = await api(
    "POST",
    "/orders/finalize",
    {
      orderId: `ord-${randomUUID()}`,
      fulfillmentType: "delivery",
      // Deliberately NO deliverySlotId — the "Deliver Now" default mode.
      items: [{ id: dish!.id, name: dish!.name, qty: 1, price: dish!.price }],
      address: {
        label: "Home",
        line: "42 Test Lane",
        city: "Noida",
        pincode: "201301",
        phone: "+911234567890",
      },
    },
    user,
  );

  assert.equal(
    r.status,
    200,
    `ASAP finalize must succeed, got ${r.status}: ${JSON.stringify(r.json)}`,
  );
  // A real slot reservation must exist for the order — ASAP means "earliest
  // open window", not "no window".
  const reservations = await db
    .select({ slotId: slotReservationsTable.slotId })
    .from(slotReservationsTable)
    .where(eq(slotReservationsTable.orderId, r.json.serverOrderId));
  assert.equal(reservations.length, 1, "ASAP order must reserve exactly one slot");
  void slotId; // referenced to keep the created slot in cleanup scope
});
