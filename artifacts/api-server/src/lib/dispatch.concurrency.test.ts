/**
 * OA-DEEP-1.5 — concurrent-dispatch load balancing.
 *
 * `dispatchOrderInner` used to score all online riders on a
 * pre-transaction snapshot and commit to `scored[0]` without ever
 * locking the rider. Under concurrent dispatch (BullMQ worker,
 * POST /api/delivery/dispatch, the ops AI agent — all call
 * `dispatchOrder` independently) every in-flight call read the same
 * stale `activeOrderCount`, so several orders could each score the
 * same rider best and all commit to it: one rider ends up overloaded
 * while equally-eligible riders idle, and the `load * loadPerOrder`
 * balancing term is silently defeated.
 *
 * The fix claims the chosen rider under `FOR UPDATE SKIP LOCKED`
 * inside the same transaction that locks the order, falling back to
 * the next-best ranked candidate when the top one is already being
 * claimed by a concurrent transaction. This file proves the fix by
 * firing a burst of concurrent dispatches at a small, identically
 * scored rider pool and asserting the assignments spread out instead
 * of stacking on one rider.
 *
 * Hits the real dev DB via DATABASE_URL.
 *
 * Run with:
 *   DATABASE_URL=... GOOGLE_API_KEY=dummy node --test --import tsx \
 *     ./src/lib/dispatch.concurrency.test.ts
 */

import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import {
  db,
  deliveryEventsTable,
  dispatchDecisionsTable,
  ordersTable,
  ridersTable,
  usersTable,
} from "@workspace/db";

import { dispatchOrder } from "./dispatch";

const CREATED_USER_IDS: string[] = [];
const CREATED_ORDER_IDS: number[] = [];
const CREATED_RIDER_IDS: number[] = [];

import { before } from "node:test";

before(async () => {
  // Ensure a clean slate for the online rider pool so stale riders from
  // crashed runs don't absorb the load and defeat the contention test.
  await db.update(ridersTable).set({ status: "offline", activeOrderCount: 0 });
});

after(async () => {
  if (CREATED_ORDER_IDS.length > 0) {
    await db
      .delete(deliveryEventsTable)
      .where(inArray(deliveryEventsTable.orderId, CREATED_ORDER_IDS));
    await db
      .delete(dispatchDecisionsTable)
      .where(inArray(dispatchDecisionsTable.orderId, CREATED_ORDER_IDS));
    await db.delete(ordersTable).where(inArray(ordersTable.id, CREATED_ORDER_IDS));
  }
  if (CREATED_RIDER_IDS.length > 0) {
    await db.delete(ridersTable).where(inArray(ridersTable.id, CREATED_RIDER_IDS));
  }
  if (CREATED_USER_IDS.length > 0) {
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
});

const DROP_LNG = 77.59;

// Own patch of map, well outside BATCH_MAX_DETOUR_KM (1.5 km) from any other
// suite's fixtures — see dispatch.channel.test.ts's `island` for why this
// matters (a stray cross-suite batch match would confound the race).
function island(n: number): number {
  return 19.11 + n * 0.05;
}

async function makeUser(): Promise<string> {
  const id = randomUUID();
  await db.insert(usersTable).values({
    id,
    email: `conc-${id}@test.local`,
    firstName: "Conc",
    lastName: "Test",
  });
  CREATED_USER_IDS.push(id);
  return id;
}

// All riders share one exact point — identical distance and rating terms —
// so the only thing that can break a tie in `scoreRiderForOrder` is the load
// term (`activeOrderCount * loadPerOrder`). Before the fix that term was
// read from a stale pre-transaction snapshot; after the fix it is
// irrelevant to the outcome anyway because the claim itself is what
// prevents the stack, not the score.
async function makeRider(lat: number): Promise<number> {
  const [r] = await db
    .insert(ridersTable)
    .values({
      name: `conc_rider_${randomUUID().slice(0, 8)}`,
      phone: `+9199${randomUUID().replace(/\D/g, "").slice(0, 8)}`,
      zone: "560001",
      status: "online",
      activeOrderCount: 0,
      rating: 5,
      lat,
      lng: DROP_LNG,
    })
    .returning();
  CREATED_RIDER_IDS.push(r!.id);
  return r!.id;
}

async function makeOrder(userId: string, lat: number): Promise<number> {
  const [o] = await db
    .insert(ordersTable)
    .values({
      userId,
      orderChannel: "own_app",
      status: "ready",
      totalPaise: 0,
      items: [],
      fulfillmentType: "delivery",
      pincode: "560001",
      addressLine: "test",
      city: "Bengaluru",
      phone: "+910000000000",
      priority: "routine",
      dropLat: lat,
      dropLng: DROP_LNG,
    })
    .returning();
  CREATED_ORDER_IDS.push(o!.id);
  return o!.id;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Dispatch every order concurrently, then retry any that lost the claim
 * race (`rider_claim_contended` / `lock_busy` — both mean "riders exist,
 * try again", exactly what `dispatchReadyOrders`'s sweep does on its next
 * pass) until all are assigned or the retry budget is exhausted.
 */
async function dispatchAllUntilAssigned(
  orderIds: number[],
  maxRounds = 25,
): Promise<Map<number, number>> {
  const riderByOrder = new Map<number, number>();
  let pending = orderIds;
  for (let round = 0; round < maxRounds && pending.length > 0; round++) {
    const results = await Promise.all(
      pending.map((orderId) => dispatchOrder(orderId, { allowBatch: false })),
    );
    const stillPending: number[] = [];
    results.forEach((r, i) => {
      const orderId = pending[i]!;
      if (r.ok && r.riderId != null) {
        riderByOrder.set(orderId, r.riderId);
      } else {
        stillPending.push(orderId);
      }
    });
    pending = stillPending;
    if (pending.length > 0) await sleep(5);
  }
  return riderByOrder;
}

test("concurrent dispatch distributes across riders instead of stacking one rider", async () => {
  const lat = island(0);
  const userId = await makeUser();
  const riderIds = await Promise.all([
    makeRider(lat),
    makeRider(lat),
    makeRider(lat),
    makeRider(lat),
  ]);
  const orderIds = await Promise.all(
    Array.from({ length: 8 }, () => makeOrder(userId, lat)),
  );

  const riderByOrder = await dispatchAllUntilAssigned(orderIds);
  assert.equal(
    riderByOrder.size,
    orderIds.length,
    "not every order was eventually assigned a rider",
  );

  const counts = new Map<number, number>();
  for (const riderId of riderByOrder.values()) {
    counts.set(riderId, (counts.get(riderId) ?? 0) + 1);
  }
  const usedRiders = [...counts.keys()];
  const perRiderCounts = riderIds.map((id) => counts.get(id) ?? 0);

  // The failure this test exists to catch: every order landing on the same
  // rider while the other three sit idle.
  assert.ok(
    Math.max(...perRiderCounts) < orderIds.length,
    `all ${orderIds.length} orders stacked onto a single rider: ${JSON.stringify(perRiderCounts)}`,
  );
  // Fair-share is 2 orders/rider (8 orders, 4 riders). Allow slack for
  // genuine timing variance in how the concurrent burst interleaves at the
  // Postgres connection-pool level, but a >1-order skew from fair share
  // would mean balancing is still broken, just less severely.
  assert.ok(
    Math.max(...perRiderCounts) <= 3,
    `distribution too skewed: ${JSON.stringify(perRiderCounts)}`,
  );
  assert.ok(
    usedRiders.length >= 3,
    `fewer than 3 of 4 riders were ever used: ${JSON.stringify(perRiderCounts)}`,
  );

  // Atomicity check: the increments the transaction performs must exactly
  // match the assignments handed out — no lost or duplicated claims.
  const rows = await db
    .select({ id: ridersTable.id, activeOrderCount: ridersTable.activeOrderCount })
    .from(ridersTable)
    .where(inArray(ridersTable.id, riderIds));
  const totalActive = rows.reduce((sum, r) => sum + r.activeOrderCount, 0);
  assert.equal(totalActive, orderIds.length);
  for (const r of rows) {
    assert.equal(
      r.activeOrderCount,
      counts.get(r.id) ?? 0,
      `rider ${r.id} activeOrderCount does not match the orders it was actually assigned`,
    );
  }
});

test("a single dispatch still succeeds cleanly against a tied rider pool", async () => {
  // Control: the atomic-claim path must not have broken the plain,
  // uncontended case.
  const lat = island(1);
  const userId = await makeUser();
  await makeRider(lat);
  await makeRider(lat);
  const orderId = await makeOrder(userId, lat);

  const result = await dispatchOrder(orderId, { allowBatch: false });
  assert.equal(result.ok, true, `dispatch failed: ${result.reason}`);
  assert.ok(result.riderId != null);
});
