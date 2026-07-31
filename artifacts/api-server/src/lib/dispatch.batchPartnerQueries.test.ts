/**
 * OA-MED-1.1 — findBatchPartner used to issue one `riders` query PER batch
 * candidate, awaited sequentially. The candidate query has no LIMIT, so the
 * round-trip count scaled with open orders in the zone.
 *
 * This is the audit's own recommended shape for N+1 findings: "wrap the
 * Drizzle executor in a counting proxy in a test harness and assert query
 * counts directly — this makes N+1 regressions catchable in CI rather than
 * only observable in production." A latency assertion would be flaky; a
 * query count is exact.
 *
 * Run with:
 *   DATABASE_URL=... node --test --import tsx ./src/lib/dispatch.batchPartnerQueries.test.ts
 */
import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import {
  db,
  pool,
  ordersTable,
  ridersTable,
  usersTable,
  deliveryEventsTable,
  dispatchDecisionsTable,
} from "@workspace/db";

import { dispatchOrder } from "./dispatch";

const CENTER = { lat: 12.9716, lng: 77.5946 };
const CREATED_ORDER_IDS: number[] = [];
const CREATED_RIDER_IDS: number[] = [];
const CREATED_USER_IDS: string[] = [];

async function makeUser(): Promise<string> {
  const id = `qc-user-${randomUUID()}`;
  await db.insert(usersTable).values({ id, email: `${id}@example.test` });
  CREATED_USER_IDS.push(id);
  return id;
}

async function makeRiderAt(
  status: "online" | "offline",
  at: { lat: number; lng: number },
): Promise<number> {
  const [r] = await db
    .insert(ridersTable)
    .values({
      name: `qc-rider-${randomUUID().slice(0, 8)}`,
      phone: `+91${Math.floor(Math.random() * 1e10)}`,
      zone: "BLR-Central",
      status,
      lat: at.lat,
      lng: at.lng,
      activeOrderCount: 0,
    })
    .returning({ id: ridersTable.id });
  CREATED_RIDER_IDS.push(r!.id);
  return r!.id;
}

const makeRider = (status: "online" | "offline") => makeRiderAt(status, CENTER);

async function makeOrder(opts: {
  userId: string;
  status: "ready" | "rider_assigned";
  riderId: number | null;
  drop: { lat: number; lng: number };
}): Promise<number> {
  const [o] = await db
    .insert(ordersTable)
    .values({
      userId: opts.userId,
      externalOrderId: `qc-${randomUUID()}`,
      status: opts.status,
      riderId: opts.riderId,
      totalPaise: 30000,
      items: [{ id: 1, name: "rice", qty: 1, price: 30000 }],
      city: "Bengaluru",
      pincode: "560001",
      addressLine: "qc",
      phone: "+910000000000",
      dropLat: opts.drop.lat,
      dropLng: opts.drop.lng,
      fulfillmentType: "delivery",
      priority: "routine",
      orderChannel: "own_app",
    })
    .returning({ id: ordersTable.id });
  CREATED_ORDER_IDS.push(o!.id);
  return o!.id;
}

after(async () => {
  if (CREATED_ORDER_IDS.length) {
    // Children first — dispatchOrder writes both, and their FKs block the
    // order delete.
    await db
      .delete(deliveryEventsTable)
      .where(inArray(deliveryEventsTable.orderId, CREATED_ORDER_IDS));
    await db
      .delete(dispatchDecisionsTable)
      .where(inArray(dispatchDecisionsTable.orderId, CREATED_ORDER_IDS));
    await db.delete(ordersTable).where(inArray(ordersTable.id, CREATED_ORDER_IDS));
  }
  if (CREATED_RIDER_IDS.length) {
    await db.delete(ridersTable).where(inArray(ridersTable.id, CREATED_RIDER_IDS));
  }
  if (CREATED_USER_IDS.length) {
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
});

/** Count queries whose SQL reads from `riders`, while running `fn`. */
async function countRiderQueries(fn: () => Promise<unknown>): Promise<number> {
  const original = pool.query.bind(pool);
  let count = 0;
  (pool as unknown as { query: unknown }).query = (...args: unknown[]) => {
    const text = typeof args[0] === "string" ? args[0] : (args[0] as { text?: string })?.text ?? "";
    // Reads only — the claim path's UPDATE on riders is a different concern
    // and is supposed to happen once.
    if (/from\s+"?riders"?/i.test(text) && /^\s*select/i.test(text)) count += 1;
    return (original as (...a: unknown[]) => unknown)(...args);
  };
  try {
    await fn();
  } finally {
    (pool as unknown as { query: unknown }).query = original;
  }
  return count;
}

test("batch-partner search does not scale rider SELECTs with candidate count", async () => {
  const userId = await makeUser();

  // 12 batchable candidates, each already assigned to its OWN rider — and
  // every one of those riders is OFFLINE. That is the pathological shape:
  // pre-fix, each candidate cost a round trip purely to discover its rider
  // was offline and `continue`.
  for (let i = 0; i < 12; i++) {
    const offlineRider = await makeRider("offline");
    await makeOrder({
      userId,
      status: "rider_assigned",
      riderId: offlineRider,
      // ~50m apart — comfortably inside the batching bbox.
      drop: { lat: CENTER.lat + i * 0.0005, lng: CENTER.lng },
    });
  }
  // One online rider so the non-batched path can still assign.
  await makeRider("online");

  const target = await makeOrder({
    userId,
    status: "ready",
    riderId: null,
    drop: { lat: CENTER.lat, lng: CENTER.lng },
  });

  const queries = await countRiderQueries(() =>
    dispatchOrder(target, { allowBatch: true }),
  );

  // The pool is fetched once and indexed; the per-candidate lookups are Map
  // hits. Pre-fix this was ~12 extra SELECTs on top of the pool fetch, so a
  // small ceiling both proves the fix and fails loudly if the N+1 returns.
  assert.ok(
    queries <= 4,
    `expected a candidate-count-independent number of rider SELECTs, got ${queries} with 12 candidates`,
  );
});

test("batching still works — the fix must not simply stop finding partners", async () => {
  // Positive control. Without this, the assertion above would also pass if
  // findBatchPartner had been broken into never matching anything.
  //
  // Own geography, ~55km north of the first test's: that test's target order
  // ends up `rider_assigned` at CENTER with an online rider, which makes it a
  // legitimate batch partner here and would steal this assertion.
  const here = { lat: CENTER.lat + 0.5, lng: CENTER.lng };
  const userId = await makeUser();
  const onlineRider = await makeRiderAt("online", here);
  await makeOrder({
    userId,
    status: "rider_assigned",
    riderId: onlineRider,
    drop: { lat: here.lat + 0.0004, lng: here.lng },
  });

  const target = await makeOrder({
    userId,
    status: "ready",
    riderId: null,
    drop: here,
  });

  const result = await dispatchOrder(target, { allowBatch: true });
  assert.equal(result.batched, true, "a nearby online-rider partner must still batch");
  assert.equal(result.riderId, onlineRider);
});
