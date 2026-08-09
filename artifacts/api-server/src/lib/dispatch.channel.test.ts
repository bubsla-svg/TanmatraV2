/**
 * An order that did not arrive through our app never consumes one of our
 * riders. This file proves that against a real database, because the failure
 * it prevents is physical: a rider on a motorbike taking a patient's clinical
 * meal to an address on someone else's contract.
 *
 * Three doors, tested separately because they are separately reachable:
 *
 *   1. dispatchOrder — the chokepoint every automated path converges on
 *      (the sweep, the BullMQ worker, the ops AI agent, POST /api/delivery/
 *      dispatch). Refuses outright.
 *   2. overrideAssignment — the manual ops path, which does NOT go through
 *      dispatchOrder and so needs its own guard.
 *   3. findBatchPartner — the subtle one. The Petpooja rider webhook writes
 *      `rider_id` on any meal order it is told about and maps the status into
 *      `rider_assigned`, which is exactly the shape findBatchPartner looks
 *      for in a batch partner. Pick that row and dispatch hands OUR order to
 *      the aggregator's courier. Tests 3a/3b are a matched pair: identical
 *      fixtures, one column different, opposite outcomes — so the pass is
 *      attributable to the channel predicate and nothing else.
 *
 * Hits the real dev DB via DATABASE_URL.
 *
 * Run with:
 *   DATABASE_URL=... GOOGLE_API_KEY=dummy node --test --import tsx \
 *     ./src/lib/dispatch.channel.test.ts
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
import { orderChannelValues, type OrderChannel } from "@workspace/db/schema";

import { dispatchOrder, overrideAssignment } from "./dispatch";

const CREATED_USER_IDS: string[] = [];
const CREATED_ORDER_IDS: number[] = [];
const CREATED_RIDER_IDS: number[] = [];

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

/**
 * Each test gets its own patch of map, ~5.5 km from its neighbours — well
 * outside BATCH_MAX_DETOUR_KM (1.5 km). Without this the batching tests are
 * confounded: fixtures from earlier tests in this file are still in the
 * database, still `rider_assigned`, still minutes old, and would satisfy the
 * batch-partner query themselves. The first draft of this file "passed" its
 * aggregator test for exactly that reason — our order was batched, but onto a
 * legitimate own_app leftover, not onto the trap. Isolation is what makes the
 * assertion mean what it says.
 *
 * Riders move with their island so rider scoring stays realistic; every row
 * here has a non-null dropLat, so findBatchPartner's legacy pincode fallback
 * (which only looks at rows missing coordinates) can never cross-match either.
 */
function island(n: number): number {
  return 12.97 + n * 0.05;
}

async function makeUser(): Promise<string> {
  const id = randomUUID();
  await db.insert(usersTable).values({
    id,
    email: `chan-${id}@test.local`,
    firstName: "Chan",
    lastName: "Test",
  });
  CREATED_USER_IDS.push(id);
  return id;
}

async function makeRider(lat: number): Promise<number> {
  const [r] = await db
    .insert(ridersTable)
    .values({
      // Unique phone per rider: the riders table is shared with other suites
      // and a collision here would silently reuse someone else's fixture.
      name: `chan_rider_${randomUUID().slice(0, 8)}`,
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

async function makeOrder(opts: {
  userId: string;
  lat: number;
  channel?: OrderChannel;
  status?: string;
  riderId?: number;
  latOffset?: number;
}): Promise<number> {
  const [o] = await db
    .insert(ordersTable)
    .values({
      userId: opts.userId,
      // Omitted on purpose where the caller wants the column default, so the
      // default itself stays exercised rather than papered over by fixtures.
      ...(opts.channel ? { orderChannel: opts.channel } : {}),
      status: opts.status ?? "ready",
      totalPaise: 0,
      items: [],
      fulfillmentType: "delivery",
      pincode: "560001",
      addressLine: "test",
      city: "Bengaluru",
      phone: "+910000000000",
      priority: "routine",
      dropLat: opts.lat + (opts.latOffset ?? 0),
      dropLng: DROP_LNG,
      ...(opts.riderId ? { riderId: opts.riderId } : {}),
    })
    .returning();
  CREATED_ORDER_IDS.push(o!.id);
  return o!.id;
}

test("dispatchOrder refuses every channel that is not own_app", async () => {
  const lat = island(0);
  const userId = await makeUser();
  await makeRider(lat); // an idle, online rider is available throughout

  for (const channel of orderChannelValues.filter((c) => c !== "own_app")) {
    const orderId = await makeOrder({ userId, lat, channel });
    const result = await dispatchOrder(orderId);

    assert.equal(result.ok, false, `${channel} order was dispatched`);
    assert.equal(result.reason, "not an own-app order");
    assert.equal(result.riderId, null);

    // The refusal must be a refusal, not a rollback: nothing may be written.
    const [row] = await db
      .select({ riderId: ordersTable.riderId, status: ordersTable.status })
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId))
      .limit(1);
    assert.equal(row!.riderId, null, `${channel} order was given a rider`);
    assert.equal(row!.status, "ready", `${channel} order had its status moved`);
  }
});

test("...and still dispatches an own_app order under the same conditions", async () => {
  // The control. Without it, the test above would pass just as happily if
  // dispatch were broken for every order in the system.
  const lat = island(1);
  const userId = await makeUser();
  await makeRider(lat);
  const orderId = await makeOrder({ userId, lat, channel: "own_app" });

  const result = await dispatchOrder(orderId);
  assert.equal(result.ok, true, `own_app order refused: ${result.reason}`);
  assert.ok(result.riderId != null);
});

test("overrideAssignment refuses a non-own_app order even for a deliberate operator", async () => {
  const lat = island(2);
  const userId = await makeUser();
  const riderId = await makeRider(lat);
  const aggregatorOrderId = await makeOrder({ userId, lat, channel: "zomato" });

  const out = await overrideAssignment({
    orderId: aggregatorOrderId,
    riderId,
    operatorId: "test_ops",
    notes: "manual",
  });
  assert.equal(out.ok, false);
  assert.equal(out.reason, "not an own-app order");

  const [row] = await db
    .select({ riderId: ordersTable.riderId })
    .from(ordersTable)
    .where(eq(ordersTable.id, aggregatorOrderId))
    .limit(1);
  assert.equal(row!.riderId, null);

  // Same operator, same rider, an own_app order: accepted. Proves the refusal
  // above is about the channel and not about the override path being broken.
  const ownOrderId = await makeOrder({ userId, lat, channel: "own_app" });
  const ok = await overrideAssignment({
    orderId: ownOrderId,
    riderId,
    operatorId: "test_ops",
    notes: "manual",
  });
  assert.equal(ok.ok, true, `override refused an own_app order: ${ok.reason}`);
});

test("overrideAssignment refuses an unpaid ('placed') own_app order", async () => {
  // lib/paidGate.ts: overrideAssignment is a status-free escape hatch for
  // ASSIGNMENT, never for PAYMENT. Before this gate, an operator (or the ops
  // AI agent's assign_rider-adjacent tooling) could hand a real rider to an
  // order nobody has paid for yet, purely by naming it directly.
  const lat = island(5);
  const userId = await makeUser();
  const riderId = await makeRider(lat);
  const orderId = await makeOrder({ userId, lat, channel: "own_app", status: "placed" });

  const out = await overrideAssignment({
    orderId,
    riderId,
    operatorId: "test_ops",
    notes: "manual",
  });
  assert.equal(out.ok, false);
  assert.equal(out.reason, "order not in a paid-live status");

  const [row] = await db
    .select({ riderId: ordersTable.riderId, status: ordersTable.status })
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId))
    .limit(1);
  assert.equal(row!.riderId, null, "unpaid order was given a rider");
  assert.equal(row!.status, "placed", "unpaid order's status was moved");
});

test("overrideAssignment still allows reassigning an already-dispatched, paid-live order", async () => {
  // Paid-live (lib/paidGate.ts) deliberately includes rider_assigned /
  // out_for_delivery, broader than isFulfilmentAssignable's preparing/ready —
  // a legitimate reassignment happens AFTER first assignment. Collapsing the
  // two predicates into the assignable-only one was a previously reviewed-out
  // bug (paidGate.ts's own doc comment calls it out); this pins that the
  // paid-liveness gate did not resurrect it.
  const lat = island(6);
  const userId = await makeUser();
  const originalRiderId = await makeRider(lat);
  const newRiderId = await makeRider(lat);
  const orderId = await makeOrder({
    userId,
    lat,
    channel: "own_app",
    status: "rider_assigned",
    riderId: originalRiderId,
  });

  const out = await overrideAssignment({
    orderId,
    riderId: newRiderId,
    operatorId: "test_ops",
    notes: "reassign",
  });
  assert.equal(out.ok, true, `reassignment refused: ${JSON.stringify(out)}`);

  const [row] = await db
    .select({ riderId: ordersTable.riderId })
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId))
    .limit(1);
  assert.equal(row!.riderId, newRiderId);
});

/**
 * 3a and 3b differ in exactly one column. Read them together or neither means
 * much.
 */
test("an aggregator order carrying a rider is never chosen as a batch partner", async () => {
  const lat = island(3);
  const userId = await makeUser();
  const riderId = await makeRider(lat);

  // The trap, exactly as the Petpooja rider webhook would leave it: an order
  // we did not take, already assigned to a courier, in flight, at the same
  // doorstep, inside the batching window.
  await makeOrder({
    userId,
    lat,
    channel: "zomato",
    status: "rider_assigned",
    riderId,
    latOffset: 0.0001, // ~11 m — comfortably inside BATCH_MAX_DETOUR_KM
  });

  const ourOrderId = await makeOrder({ userId, lat, channel: "own_app" });
  const result = await dispatchOrder(ourOrderId, { allowBatch: true });

  // Assigning our order to that rider on its own merits is fine — it is our
  // rider. Bagging our patient's meal WITH the Zomato drop is not.
  assert.equal(result.batched, false, "our order was batched onto a Zomato order");
});

test("...but an own_app order in the identical position is chosen", async () => {
  const lat = island(4);
  const userId = await makeUser();
  const riderId = await makeRider(lat);

  await makeOrder({
    userId,
    lat,
    channel: "own_app",
    status: "rider_assigned",
    riderId,
    latOffset: 0.0001,
  });

  const ourOrderId = await makeOrder({ userId, lat, channel: "own_app" });
  const result = await dispatchOrder(ourOrderId, { allowBatch: true });

  // If this ever fails, the fixture stopped being batchable and the test
  // above is no longer evidence of anything — fix this one first.
  assert.equal(
    result.batched,
    true,
    "fixture is not batchable, so the aggregator test proves nothing",
  );
});
