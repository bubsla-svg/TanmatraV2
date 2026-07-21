import { describe, it } from "node:test";
import assert from "node:assert";
import {
  emitCdcChange,
  cdcRouter,
  cdcDlq,
  mockSearchIndexStore,
  mockAnalyticsDashboardStore,
  mockNotificationAlertLogs,
  SEARCH_INDEX_SINK_NAME,
} from "./cdcEngine";

describe("Change Data Capture (CDC), Event Routing & Dead Letter Queue Architecture", () => {
  it("Step 1 (CDC): fires real-time CDC change events automatically on INSERT, UPDATE, and DELETE", async () => {
    const res = await emitCdcChange({
      table: "menu_items",
      operation: "UPDATE",
      before: { slug: "quinoa-upma", name: "Quinoa Upma Old" },
      after: { slug: "quinoa-upma", name: "Quinoa Upma New RD Formula" },
    });

    assert.ok(res.event.id.startsWith("cdc_"));
    assert.strictEqual(res.event.table, "menu_items");
    assert.strictEqual(res.event.operation, "UPDATE");
    assert.strictEqual((res.event.after as any).name, "Quinoa Upma New RD Formula");
    assert.ok(res.delivered.includes(SEARCH_INDEX_SINK_NAME));
  });

  it("Step 2 (Event Routing): selectively routes product changes to Search Index, transactions to Analytics, and alerts to Notifications", async () => {
    mockSearchIndexStore.clear();
    mockAnalyticsDashboardStore.transactionCount = 0;
    mockAnalyticsDashboardStore.revenueTotal = 0;
    mockNotificationAlertLogs.length = 0;

    // 1. Menu Item Change -> Search Index Sink updated instantly
    await emitCdcChange({
      table: "menu_items",
      operation: "INSERT",
      after: { slug: "paneer-burrito", name: "Paneer Tikka Burrito", price: 30100 },
    });

    assert.strictEqual(mockSearchIndexStore.has("paneer-burrito"), true);
    assert.strictEqual(mockSearchIndexStore.get("paneer-burrito").name, "Paneer Tikka Burrito");
    assert.strictEqual(mockAnalyticsDashboardStore.transactionCount, 0); // Analytics ignored it

    // 2. Order Transaction -> Analytics Sink updated instantly
    await emitCdcChange({
      table: "orders",
      operation: "INSERT",
      after: { id: 101, totalPaise: 85000, status: "placed" },
    });

    assert.strictEqual(mockAnalyticsDashboardStore.transactionCount, 1);
    assert.strictEqual(mockAnalyticsDashboardStore.revenueTotal, 85000);
    assert.strictEqual(mockSearchIndexStore.has("101"), false); // Search Index ignored it

    // 3. Clinical Alert -> Notification Alert Sink fired instantly
    await emitCdcChange({
      table: "rd_advisory_alerts",
      operation: "INSERT",
      after: { id: 1, message: "Critical allergen mismatch detected on order #TNM-9012" },
    });

    assert.strictEqual(mockNotificationAlertLogs.length, 1);
    assert.ok(mockNotificationAlertLogs[0].includes("Critical allergen mismatch"));
  });

  it("Step 3 (Dead Letter Queue): captures failed events into DLQ and enables automatic retries", async () => {
    const FAIL_SINK = "FaultyExternalPartnerSink";
    let attemptsCount = 0;

    cdcRouter.subscribe("partner_webhook.*", FAIL_SINK, async () => {
      attemptsCount++;
      if (attemptsCount < 3) {
        throw new Error("Network timeout: partner service unreachable 503");
      }
      // Succeeds on 3rd attempt
    });

    // Fire event -> delivery fails on 1st attempt -> enqueued into DLQ
    const res = await emitCdcChange({
      table: "partner_webhook",
      operation: "INSERT",
      after: { eventType: "ORDER_DISPATCHED", orderId: 8840 },
    });

    assert.ok(res.failed.includes(FAIL_SINK));

    const pendingDlq = cdcDlq.getPending();
    assert.ok(pendingDlq.length >= 1);
    const dlqRecord = pendingDlq.find((r) => r.sinkName === FAIL_SINK);
    assert.ok(dlqRecord);
    assert.strictEqual(dlqRecord.status, "pending");
    assert.ok(dlqRecord.errorReason.includes("Network timeout"));

    // Retry 1: attemptsCount becomes 2 -> fails again
    await cdcDlq.retryPending(cdcRouter);
    assert.strictEqual(attemptsCount, 2);

    // Retry 2: attemptsCount becomes 3 -> succeeds! State flips to 'retried'
    await cdcDlq.retryPending(cdcRouter);
    assert.strictEqual(attemptsCount, 3);
    assert.strictEqual(dlqRecord.status, "retried");
  });
});
