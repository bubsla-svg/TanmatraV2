import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import {
  recordBusinessMetric,
  evaluateBusinessMetricAnomalies,
  hourlyMetricsWindow,
  businessAnomalyAlertsLog,
} from "./businessMetricsAlerting";
import {
  executeSyntheticTransactionJourney,
  syntheticRunHistory,
} from "./syntheticRunner";
import {
  captureSilentWebhookFailure,
  reprocessWebhookDlqRecord,
  webhookDlqRecords,
} from "./webhookDlq";

describe("Business Metric Alerting, Synthetic Monitoring & Webhook DLQ Engine", () => {
  beforeEach(() => {
    hourlyMetricsWindow.length = 0;
    businessAnomalyAlertsLog.length = 0;
    syntheticRunHistory.length = 0;
    webhookDlqRecords.length = 0;
  });

  it("Step 1 (Business Metric Alerting): triggers critical revenue bleed alert when signups active but payments drop to zero", () => {
    // Record 5 signups with 0 payments
    for (let i = 0; i < 5; i++) {
      recordBusinessMetric("signup");
    }

    assert.ok(businessAnomalyAlertsLog.length >= 1);
    assert.ok(businessAnomalyAlertsLog[0].includes("CRITICAL_BUSINESS_BLEED_ALERT"));
  });

  it("Step 2 (Synthetic Monitoring): executes 5-step e2e user journey and flags synthetic step failures", async () => {
    // 1. Successful Journey Run
    const successResult = await executeSyntheticTransactionJourney();
    assert.strictEqual(successResult.status, "SUCCESS");
    assert.strictEqual(successResult.steps.length, 5);

    // 2. Journey Run with Simulated Payment Failure
    const failureResult = await executeSyntheticTransactionJourney({ payment: true });
    assert.strictEqual(failureResult.status, "FAILED");
    assert.strictEqual(failureResult.failedStep, "payment");
  });

  it("Step 3 (Webhook DLQ): captures silent HTTP 200 webhook business logic failures for inspection & reprocessing", async () => {
    const record = await captureSilentWebhookFailure({
      provider: "razorpay",
      eventId: "evt_pay_881920",
      payload: { paymentId: "pay_99210", amount: 49900 },
      internalErrorMessage: "Postgres connection pool exhausted during invoice generation",
      httpResponseCode: 200,
    });

    assert.ok(record.id.startsWith("wh_dlq_"));
    assert.strictEqual(record.status, "pending");

    // Reprocess DLQ Record
    const reprocessRes = await reprocessWebhookDlqRecord(record.id, async (payload) => {
      assert.strictEqual(payload.paymentId, "pay_99210");
      return true; // Successfully reprocessed!
    });

    assert.strictEqual(reprocessRes.success, true);
    assert.strictEqual(record.status, "reprocessed");
  });
});
