/**
 * F-4 regression: an unprocessed Razorpay webhook must raise an alarm.
 *
 * `webhook_inbox` is written on every verified gateway callback and, before
 * this metric existed, read by NOTHING in the running system — no scheduler
 * swept it, and none of the five anomaly metrics covered it. A rotated webhook
 * secret, a payload schema drift, or a sustained gateway outage piled up
 * `failed` rows in silence while customers' money sat captured against orders
 * that were never confirmed.
 *
 * Requires a database:
 *   DATABASE_URL=... node --test --import tsx ./src/lib/anomalies.webhookInbox.test.ts
 */
import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";
import { inArray, eq } from "drizzle-orm";
import { db, webhookInboxTable, anomalyAlertsTable } from "@workspace/db";
import { runAnomalyScan, listMetrics } from "./anomalies";

const RUN = randomUUID().slice(0, 8);
const createdEventIds: string[] = [];

/** The hour the scan will evaluate: the completed hour before `now`. */
const HOUR_MS = 60 * 60 * 1000;
const now = new Date();
const windowEnd = new Date(Math.floor(now.getTime() / HOUR_MS) * HOUR_MS);
const insideWindow = new Date(windowEnd.getTime() - 30 * 60 * 1000);

async function seedInboxRow(status: string): Promise<void> {
  const eventId = `evt_f4_${RUN}_${randomUUID().slice(0, 8)}`;
  createdEventIds.push(eventId);
  await db.insert(webhookInboxTable).values({
    eventId,
    source: "razorpay",
    eventType: "payment.captured",
    payload: "{}",
    status,
    createdAt: insideWindow,
  });
}

async function scanForWebhookInbox() {
  const results = await runAnomalyScan(now);
  return results.find((r) => r.metric === "webhook_inbox_failed");
}

test("the metric is registered — a new key must reach listMetrics, not just the type", () => {
  // The type union alone would compile fine while the metric never ran:
  // `runAnomalyScan` iterates the METRICS record, so registration is the
  // thing that actually decides whether this alarm exists.
  const keys = listMetrics().map((m) => m.key);
  assert.ok(keys.includes("webhook_inbox_failed"), `metric not registered: ${keys.join(", ")}`);
});

test("a failed webhook in the window fires the alarm", async () => {
  await seedInboxRow("failed");

  const result = await scanForWebhookInbox();
  assert.ok(result, "webhook_inbox_failed produced no detection result");
  assert.ok(
    result.value >= 1,
    `expected at least the seeded stuck row, got value=${result.value} (${result.reason})`,
  );
  assert.equal(result.fired, true, `alarm did not fire: ${result.reason}`);
});

test("a pending webhook counts too — stuck is stuck, whatever it is called", async () => {
  await seedInboxRow("pending");
  const result = await scanForWebhookInbox();
  assert.ok(result);
  assert.ok(result.value >= 1, `pending rows must count as stuck, got ${result.value}`);
});

test("processed and duplicate rows are NOT stuck", async () => {
  // The counterpart that keeps this from being an alarm that always fires:
  // a healthy hour of traffic is all `processed`, plus `duplicate` for the
  // gateway's at-least-once redeliveries, and must stay quiet.
  const before = await scanForWebhookInbox();
  const baselineValue = before?.value ?? 0;

  await seedInboxRow("processed");
  await seedInboxRow("duplicate");

  const after_ = await scanForWebhookInbox();
  assert.ok(after_);
  assert.equal(
    after_.value,
    baselineValue,
    "processed/duplicate rows must not raise the stuck count",
  );
});

after(async () => {
  if (createdEventIds.length > 0) {
    await db.delete(webhookInboxTable).where(inArray(webhookInboxTable.eventId, createdEventIds));
  }
  // runAnomalyScan writes real alert rows; this metric's are ours to clear.
  await db.delete(anomalyAlertsTable).where(eq(anomalyAlertsTable.metric, "webhook_inbox_failed"));
});
