/**
 * The paid-fulfilment invariant at the dispatch chokepoint (lib/paidGate.ts,
 * docs/MONEY-PATH-VERIFICATION.md §5): an order whose payment has not resolved
 * never consumes a rider, and never earns operational side effects.
 *
 * For an own_app order, `status = "placed"` IS the unpaid state — it is what
 * checkout writes before the Razorpay modal opens, and what an ABANDONED or
 * FAILED payment leaves behind. The owner's acceptance scenarios this file
 * pins at the dispatch level:
 *
 *   - Payment abandoned / failed / unresolved → the order is not dispatchable:
 *     dispatchOrder refuses it, the sweep never scans it, and a STAT order
 *     sitting unpaid past the SLA threshold does NOT stamp a permanent
 *     `sla_breach` — an abandoned checkout is not a delivery emergency.
 *   - Payment succeeded (status advanced to preparing/ready by the payment
 *     writers) → the SAME order dispatches normally, so every refusal above is
 *     attributable to the status predicate and not to a dispatcher that
 *     refuses everything.
 *
 * The refusal reason is asserted verbatim: dispatchReadyOrders treats any
 * non-"no riders available" failure as progress, so if this string ever
 * became the no-riders sentinel the sweep would break-loop on unpaid rows.
 *
 * The channel half of the chokepoint (aggregator orders refused outright) is
 * dispatch.channel.test.ts; this file is the payment half.
 *
 * Hits the real dev DB via DATABASE_URL.
 *
 * Run with:
 *   DATABASE_URL=... GOOGLE_API_KEY=dummy node --test --import tsx \
 *     ./src/lib/dispatch.paidGate.test.ts
 */

import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  deliveryEventsTable,
  dispatchDecisionsTable,
  ordersTable,
  ridersTable,
  usersTable,
} from "@workspace/db";

import { dispatchOrder, dispatchReadyOrders, STAT_DISPATCH_SLA_MIN } from "./dispatch";

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

// Same island isolation as dispatch.channel.test.ts: each test's fixtures sit
// ~5.5 km from its neighbours', outside BATCH_MAX_DETOUR_KM, so a leftover
// rider_assigned row from an earlier test can never be picked as this test's
// batch partner.
function island(n: number): number {
  return 12.97 + n * 0.05;
}

async function makeUser(): Promise<string> {
  const id = randomUUID();
  await db.insert(usersTable).values({
    id,
    email: `paid-${id}@test.local`,
    firstName: "Paid",
    lastName: "Gate",
  });
  CREATED_USER_IDS.push(id);
  return id;
}

async function makeRider(lat: number): Promise<number> {
  const [r] = await db
    .insert(ridersTable)
    .values({
      name: `paid_rider_${randomUUID().slice(0, 8)}`,
      phone: `+9198${randomUUID().replace(/\D/g, "").slice(0, 8)}`,
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
  status: string;
  priority?: "routine" | "urgent" | "stat";
  createdAt?: Date;
}): Promise<number> {
  const [o] = await db
    .insert(ordersTable)
    .values({
      userId: opts.userId,
      // orderChannel omitted on purpose: checkout writes through the column
      // default, so the unpaid rows here are shaped exactly as an abandoned
      // Razorpay modal leaves them.
      status: opts.status,
      totalPaise: 42000,
      chargePaise: 42000,
      items: [{ id: 31, name: "Moong Khichdi", qty: 2, price: 21000 }],
      fulfillmentType: "delivery",
      pincode: "560001",
      addressLine: "test",
      city: "Bengaluru",
      phone: "+910000000000",
      priority: opts.priority ?? "routine",
      dropLat: opts.lat,
      dropLng: DROP_LNG,
      ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
    })
    .returning();
  CREATED_ORDER_IDS.push(o!.id);
  return o!.id;
}

async function orderRow(id: number) {
  const [row] = await db
    .select({
      status: ordersTable.status,
      riderId: ordersTable.riderId,
      slaBreachAt: ordersTable.slaBreachAt,
    })
    .from(ordersTable)
    .where(eq(ordersTable.id, id))
    .limit(1);
  return row!;
}

const REFUSAL = "order not in a dispatchable status (unpaid or terminal)";

test("dispatchOrder refuses an own_app order in every non-assignable status", async () => {
  const lat = island(10);
  const userId = await makeUser();
  await makeRider(lat); // an idle, online rider is available throughout

  // placed = unpaid (abandoned/failed/unresolved checkout all leave this);
  // failed/cancelled/refunded = resolved-dead; delivered = done; billed =
  // mandate settlement ledger row. All non-assignable, all fail closed.
  for (const status of ["placed", "failed", "cancelled", "refunded", "delivered", "billed"]) {
    const orderId = await makeOrder({ userId, lat, status });
    const result = await dispatchOrder(orderId);

    assert.equal(result.ok, false, `a ${status} order was dispatched`);
    assert.equal(result.reason, REFUSAL, `wrong refusal reason for ${status}`);
    assert.equal(result.riderId, null);

    // A refusal, not a rollback: nothing may be written.
    const row = await orderRow(orderId);
    assert.equal(row.riderId, null, `a ${status} order was given a rider`);
    assert.equal(row.status, status, `a ${status} order had its status moved`);
  }
});

test("...and dispatches the identical order once payment has advanced it", async () => {
  // The matched pair. The payment writers (routes/payments.ts, the
  // reconciliation sweep, the verified zero-charge finalize) advance
  // placed→preparing; from there the order is assignable. Without this
  // control the refusals above would pass just as happily if dispatch were
  // broken for every order in the system.
  const lat = island(11);
  const userId = await makeUser();
  await makeRider(lat);

  for (const status of ["preparing", "ready"]) {
    const orderId = await makeOrder({ userId, lat, status });
    const result = await dispatchOrder(orderId, { allowBatch: false });
    assert.equal(result.ok, true, `a paid ${status} order was refused: ${result.reason}`);
    assert.ok(result.riderId != null);
  }
});

test("the sweep never touches an unpaid order: no dispatch attempt, no SLA breach stamp", async () => {
  const lat = island(12);
  const userId = await makeUser();
  await makeRider(lat);

  const pastSla = new Date(Date.now() - (STAT_DISPATCH_SLA_MIN + 5) * 60_000);

  // The trap: a STAT-priority order whose payment was abandoned, sitting well
  // past the dispatch SLA. Before the gate this stamped a permanent
  // `sla_breach` and consumed a rider — a delivery emergency invented out of
  // an unpaid checkout.
  const unpaidStat = await makeOrder({
    userId,
    lat,
    status: "placed",
    priority: "stat",
    createdAt: pastSla,
  });
  // The control: identical row, but payment resolved (preparing). Must be
  // picked up by the same sweep — SLA stamped AND rider assigned — so the
  // silence on the unpaid row is the status predicate, not a dead sweep.
  const paidStat = await makeOrder({
    userId,
    lat,
    status: "preparing",
    priority: "stat",
    createdAt: pastSla,
  });

  const sweep = await dispatchReadyOrders();

  assert.ok(
    !sweep.results.some((r) => r.orderId === unpaidStat),
    "the sweep attempted to dispatch an unpaid order",
  );
  const unpaidRow = await orderRow(unpaidStat);
  assert.equal(unpaidRow.status, "placed");
  assert.equal(unpaidRow.riderId, null, "an unpaid order was given a rider");
  assert.equal(
    unpaidRow.slaBreachAt,
    null,
    "an abandoned unpaid checkout was stamped as an SLA breach",
  );
  const unpaidBreachEvents = await db
    .select({ id: deliveryEventsTable.id })
    .from(deliveryEventsTable)
    .where(
      and(
        eq(deliveryEventsTable.orderId, unpaidStat),
        eq(deliveryEventsTable.event, "sla_breach"),
      ),
    );
  assert.equal(unpaidBreachEvents.length, 0, "an unpaid order emitted an sla_breach event");

  const paidRow = await orderRow(paidStat);
  assert.ok(paidRow.riderId != null, "the paid STAT control was not assigned");
  assert.ok(
    paidRow.slaBreachAt != null,
    "the paid STAT control was not stamped — the SLA scan is dead and the unpaid assertion proves nothing",
  );
});
