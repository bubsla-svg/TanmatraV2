/**
 * Golden test for OA-DEEP-1.2 (TODO_optimization-auditor.md): buildBaseline
 * was rewritten from 168 sequential single-hour queries per metric into 1-2
 * grouped queries per metric. This asserts the optimized buildBaseline
 * produces IDENTICAL baseline/std output to the frozen pre-optimization
 * algorithm (__buildBaselineOldForTest), against real seeded Postgres data
 * spanning the full 169-hour lookback window, for all 5 metrics — including
 * the hour-of-day seasonal-weighting branch and the "< 3 valid buckets"
 * early return.
 *
 * Run from artifacts/api-server:
 *   DATABASE_URL=... node --test --import tsx ./src/lib/anomalies.golden.test.ts
 */
import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { db, ordersTable, deliveryEventsTable } from "@workspace/db";
import {
  listMetrics,
  __buildBaselineOldForTest,
  __buildBaselineForTest,
  type MetricKey,
} from "./anomalies";

const HOUR_MS = 60 * 60 * 1000;
const CREATED_ORDER_IDS: number[] = [];

after(async () => {
  if (CREATED_ORDER_IDS.length > 0) {
    await db.delete(deliveryEventsTable).where(inArray(deliveryEventsTable.orderId, CREATED_ORDER_IDS));
    await db.delete(ordersTable).where(inArray(ordersTable.id, CREATED_ORDER_IDS));
  }
});

async function insertOrder(status: string, createdAt: Date): Promise<number> {
  const [row] = await db
    .insert(ordersTable)
    .values({ status, totalPaise: 50_000, items: [], createdAt })
    .returning({ id: ordersTable.id });
  CREATED_ORDER_IDS.push(row!.id);
  return row!.id;
}

async function insertEvent(
  orderId: number,
  event: string,
  createdAt: Date,
  meta?: Record<string, unknown>,
): Promise<void> {
  await db.insert(deliveryEventsTable).values({ orderId, event, createdAt, meta });
}

// windowEnd must be hour-aligned, exactly as evaluateMetric computes it.
const now = new Date();
const windowEnd = new Date(Math.floor(now.getTime() / HOUR_MS) * HOUR_MS);

async function seed(): Promise<void> {
  // Spread activity across the full 169-hour lookback window (h=2..169 maps
  // to buildBaseline's actual bucket range) with deliberately UNEVEN density
  // — some hours get several orders, most get none — so the "< 3 valid
  // buckets" and seasonal-weighting branches both get real exercise, not
  // just the common case.
  for (let h = 2; h <= 169; h++) {
    // Only ~40% of hours get any activity at all — sparse, realistic, and
    // guarantees plenty of empty (sampleSize=0) buckets on both sides.
    if (h % 5 !== 0 && h % 7 !== 0) continue;
    const bucketStart = new Date(windowEnd.getTime() - h * HOUR_MS);
    const ordersThisHour = 1 + (h % 4); // 1..4 orders in this hour

    for (let i = 0; i < ordersThisHour; i++) {
      const createdAt = new Date(bucketStart.getTime() + i * 5 * 60_000);
      // ~20% refunded.
      const status = (h + i) % 5 === 0 ? "refunded" : "delivered";
      const orderId = await insertOrder(status, createdAt);

      // kitchen_ready_minutes: 'ready' event 8-40 minutes after creation.
      const readyMinutes = 8 + ((h * 3 + i * 7) % 32);
      await insertEvent(orderId, "ready", new Date(createdAt.getTime() + readyMinutes * 60_000));

      // rider_acceptance_minutes: rider_assigned then out_for_delivery.
      const assignedAt = new Date(createdAt.getTime() + 20 * 60_000);
      const acceptMinutes = 1 + ((h + i) % 10);
      await insertEvent(orderId, "rider_assigned", assignedAt);
      await insertEvent(
        orderId,
        "out_for_delivery",
        new Date(assignedAt.getTime() + acceptMinutes * 60_000),
      );

      // payment_failure_rate: ~15% of orders get a payment_failed event.
      if ((h + i) % 7 === 0) {
        await insertEvent(orderId, "payment_failed", new Date(createdAt.getTime() + 60_000));
      }

      // low_rating_rate: ~50% of orders get rated, occasionally low.
      if ((h + i) % 2 === 0) {
        const rating = (h + i) % 6 === 0 ? 1 : 5;
        await insertEvent(orderId, "order_rated", new Date(createdAt.getTime() + 90 * 60_000), {
          rating,
        });
      }
    }
  }
}

test("seed realistic sparse activity across the 169-hour lookback window", async () => {
  await seed();
  assert.ok(CREATED_ORDER_IDS.length > 20, `expected a meaningful seed, got ${CREATED_ORDER_IDS.length} orders`);
});

for (const spec of listMetrics()) {
  const metric: MetricKey = spec.key;
  test(`buildBaseline(${metric}) matches the pre-optimization algorithm exactly`, async () => {
    const [oldResult, newResult] = await Promise.all([
      __buildBaselineOldForTest(metric, windowEnd),
      __buildBaselineForTest(metric, windowEnd),
    ]);

    assert.equal(
      newResult.baseline === null,
      oldResult.baseline === null,
      `${metric}: null-ness of baseline differs (old=${oldResult.baseline}, new=${newResult.baseline})`,
    );
    assert.equal(
      newResult.std === null,
      oldResult.std === null,
      `${metric}: null-ness of std differs`,
    );
    if (oldResult.baseline != null && newResult.baseline != null) {
      assert.ok(
        Math.abs(oldResult.baseline - newResult.baseline) < 1e-9,
        `${metric}: baseline mismatch — old=${oldResult.baseline}, new=${newResult.baseline}`,
      );
    }
    if (oldResult.std != null && newResult.std != null) {
      assert.ok(
        Math.abs(oldResult.std - newResult.std) < 1e-9,
        `${metric}: std mismatch — old=${oldResult.std}, new=${newResult.std}`,
      );
    }
  });
}

// Explicit sanity check that the seed is capable of producing a NON-null
// baseline for at least one metric — otherwise every assertion above would
// trivially pass by both sides always returning null (the "< 3 valid
// buckets" branch), which would prove nothing.
test("sanity: at least one metric produced a real (non-null) baseline", async () => {
  const results = await Promise.all(
    listMetrics().map((s) => __buildBaselineForTest(s.key, windowEnd)),
  );
  assert.ok(
    results.some((r) => r.baseline !== null),
    "expected at least one metric to have enough seeded buckets for a real baseline — the golden comparison above would be vacuous otherwise",
  );
});
