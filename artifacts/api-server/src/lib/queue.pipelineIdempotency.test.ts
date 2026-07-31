/**
 * OA-MED-1.3 — the order-pipeline processor's prelude must be idempotent
 * BEFORE its side effects are allowed to rethrow, because a rethrow makes
 * BullMQ re-run the job from the top.
 *
 * These test the two properties a retry depends on, both of which were
 * previously false:
 *   1. the delivery_events insert does not duplicate on re-run
 *   2. the status write never walks an order BACKWARDS down the ladder
 *
 * The second is the real trap: auto-dispatch sets `rider_assigned`, so a
 * naive rethrow-and-retry would reset a dispatched order to `ready`.
 *
 * Run with:
 *   DATABASE_URL=... node --test --import tsx ./src/lib/queue.pipelineIdempotency.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db, deliveryEventsTable, ordersTable } from "@workspace/db";

import { _orderPipelineProcessorForTests as runStep } from "./queue";

async function seedOrder(status: string): Promise<number> {
  const [row] = await db
    .insert(ordersTable)
    .values({
      externalOrderId: `test-pipeline-${randomUUID()}`,
      status,
      totalPaise: 30000,
      items: [],
    })
    .returning({ id: ordersTable.id });
  return row!.id;
}

async function statusOf(orderId: number): Promise<string> {
  const [row] = await db
    .select({ status: ordersTable.status })
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId));
  return row!.status;
}

async function eventCount(orderId: number, event: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(deliveryEventsTable)
    .where(
      and(eq(deliveryEventsTable.orderId, orderId), eq(deliveryEventsTable.event, event)),
    );
  return Number(row?.n ?? 0);
}

test("re-running the same pipeline step does not duplicate its delivery_events row", async () => {
  const orderId = await seedOrder("placed");

  await runStep({ orderId, step: "preparing" });
  assert.equal(await eventCount(orderId, "order_preparing"), 1);

  // A rethrown side effect makes BullMQ re-run the whole processor. Before
  // the insert-if-absent guard this produced a second timeline row — the
  // exact harm scheduleOrderAdvance's jobId key exists to prevent.
  await runStep({ orderId, step: "preparing" });
  assert.equal(
    await eventCount(orderId, "order_preparing"),
    1,
    "a retry must not add a duplicate timeline row",
  );
});

test("a retry does NOT rewind an order that auto-dispatch already advanced", async () => {
  // The failure mode: attempt 1 sets `ready`, auto-dispatch assigns a rider
  // and moves the order to `rider_assigned`, then something later throws.
  // Attempt 2 re-runs the prelude — which used to blind-set `status = 'ready'`,
  // leaving an order that HAS a rider claiming it is still waiting for one.
  const orderId = await seedOrder("rider_assigned");

  await runStep({ orderId, step: "ready" });

  assert.equal(
    await statusOf(orderId),
    "rider_assigned",
    "the ready step must not walk a dispatched order backwards",
  );
});

test("the pipeline still advances an order that is genuinely behind", async () => {
  // The positive control — without it the test above would also pass if the
  // guard simply blocked every write.
  const orderId = await seedOrder("preparing");
  await runStep({ orderId, step: "ready" });
  assert.equal(await statusOf(orderId), "ready");

  await runStep({ orderId, step: "out_for_delivery" });
  assert.equal(await statusOf(orderId), "out_for_delivery");
});

test("a pipeline step never overwrites a terminal status", async () => {
  // cancelled/failed/refunded/billed are off the delivery ladder entirely. An
  // in-flight queued job landing after a cancellation must not resurrect the
  // order into the delivery flow.
  for (const terminal of ["cancelled", "failed", "refunded"]) {
    const orderId = await seedOrder(terminal);
    await runStep({ orderId, step: "out_for_delivery" });
    assert.equal(
      await statusOf(orderId),
      terminal,
      `a queued step must not overwrite the terminal status ${terminal}`,
    );
  }
});
