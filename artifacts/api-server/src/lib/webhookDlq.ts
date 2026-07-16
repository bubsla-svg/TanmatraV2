import { logger } from "./logger";

/**
 * Step 3: Dead Letter Queue (DLQ) for Webhooks.
 * Catches webhook events where the HTTP response was 200 OK to provider,
 * but internal business processing failed silently.
 */

export interface WebhookDlqRecord {
  id: string;
  provider: "razorpay" | "petpooja" | "stripe";
  eventId: string;
  payload: Record<string, unknown>;
  internalErrorMessage: string;
  httpResponseCode: number;
  status: "pending" | "reprocessed" | "failed";
  receivedAt: string;
  reprocessedAt?: string;
}

export const webhookDlqRecords: WebhookDlqRecord[] = [];

export async function captureSilentWebhookFailure(params: {
  provider: "razorpay" | "petpooja" | "stripe";
  eventId: string;
  payload: Record<string, unknown>;
  internalErrorMessage: string;
  httpResponseCode?: number;
}): Promise<WebhookDlqRecord> {
  const record: WebhookDlqRecord = {
    id: `wh_dlq_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    provider: params.provider,
    eventId: params.eventId,
    payload: params.payload,
    internalErrorMessage: params.internalErrorMessage,
    httpResponseCode: params.httpResponseCode ?? 200,
    status: "pending",
    receivedAt: new Date().toISOString(),
  };

  webhookDlqRecords.push(record);

  logger.warn(
    { record, alert: "SILENT_WEBHOOK_BUSINESS_FAILURE_ENQUEUED" },
    "webhook.dlq.silent_failure_captured"
  );

  return record;
}

export async function reprocessWebhookDlqRecord(
  recordId: string,
  reprocessHandler: (payload: Record<string, unknown>) => Promise<boolean>
): Promise<{ success: boolean; error?: string }> {
  const record = webhookDlqRecords.find((r) => r.id === recordId);
  if (!record) return { success: false, error: "Record not found" };

  try {
    const ok = await reprocessHandler(record.payload);
    if (ok) {
      record.status = "reprocessed";
      record.reprocessedAt = new Date().toISOString();
      return { success: true };
    }
    record.status = "failed";
    return { success: false, error: "Reprocessing logic returned false" };
  } catch (err: any) {
    record.status = "failed";
    return { success: false, error: err?.message ?? String(err) };
  }
}
