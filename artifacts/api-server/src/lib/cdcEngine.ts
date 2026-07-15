/**
 * Change Data Capture (CDC), Event Routing, and Dead Letter Queue (DLQ) Engine
 * 
 * Step 1: CDC Engine watches DB table mutations and fires events in real time.
 * Step 2: Content-based Event Router routes mutations selectively to downstream sinks.
 * Step 3: Dead Letter Queue (DLQ) captures failed deliveries for retries & alerting.
 */

export type CdcOperation = "INSERT" | "UPDATE" | "DELETE";

export interface CdcEvent<T = Record<string, unknown>> {
  id: string;
  table: string;
  operation: CdcOperation;
  before: T | null;
  after: T | null;
  timestamp: string;
}

export type EventFilterPattern = string; // e.g. "menu_items.*", "orders.INSERT", "*"

export interface DeadLetterRecord<T = Record<string, unknown>> {
  id: string;
  event: CdcEvent<T>;
  sinkName: string;
  errorReason: string;
  attempts: number;
  maxAttempts: number;
  status: "pending" | "retried" | "exhausted";
  createdAt: string;
  lastAttemptAt: string;
}

export type SinkHandler<T = Record<string, unknown>> = (event: CdcEvent<T>) => Promise<void>;

class EventRouter {
  private routes = new Map<string, Set<{ sinkName: string; handler: SinkHandler }>>();

  /** Subscribe a downstream sink to a table/operation pattern (e.g. "menu_items.*" or "orders.INSERT") */
  subscribe(pattern: EventFilterPattern, sinkName: string, handler: SinkHandler): void {
    if (!this.routes.has(pattern)) {
      this.routes.set(pattern, new Set());
    }
    this.routes.get(pattern)!.add({ sinkName, handler });
  }

  /** Match and dispatch event to matching subscribed sinks */
  async routeEvent<T = Record<string, unknown>>(
    event: CdcEvent<T>,
    dlq: DeadLetterQueue,
    isRetry = false
  ): Promise<{ delivered: string[]; failed: string[] }> {
    const delivered: string[] = [];
    const failed: string[] = [];

    const matchedSinks = new Map<string, SinkHandler>();

    for (const [pattern, sinks] of this.routes.entries()) {
      if (this.matchesPattern(pattern, event.table, event.operation)) {
        for (const sink of sinks) {
          matchedSinks.set(sink.sinkName, sink.handler);
        }
      }
    }

    for (const [sinkName, handler] of matchedSinks.entries()) {
      try {
        await handler(event as CdcEvent<any>);
        delivered.push(sinkName);
      } catch (err: any) {
        failed.push(sinkName);
        if (!isRetry) {
          await dlq.enqueue(event as CdcEvent<any>, sinkName, err?.message ?? String(err));
        }
      }
    }

    return { delivered, failed };
  }

  private matchesPattern(pattern: string, table: string, operation: CdcOperation): boolean {
    if (pattern === "*") return true;
    const [pTable, pOp] = pattern.split(".");
    const tableMatch = pTable === "*" || pTable === table;
    const opMatch = !pOp || pOp === "*" || pOp === operation;
    return tableMatch && opMatch;
  }
}

export class DeadLetterQueue {
  private records: DeadLetterRecord[] = [];
  private maxAttemptsDefault = 3;

  async enqueue<T = Record<string, unknown>>(
    event: CdcEvent<T>,
    sinkName: string,
    errorReason: string,
    maxAttempts = this.maxAttemptsDefault
  ): Promise<DeadLetterRecord<T>> {
    const record: DeadLetterRecord<T> = {
      id: `dlq_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      event,
      sinkName,
      errorReason,
      attempts: 1,
      maxAttempts,
      status: "pending",
      createdAt: new Date().toISOString(),
      lastAttemptAt: new Date().toISOString(),
    };
    this.records.push(record as DeadLetterRecord<any>);
    return record;
  }

  getPending(): DeadLetterRecord[] {
    return this.records.filter((r) => r.status === "pending");
  }

  getExhausted(): DeadLetterRecord[] {
    return this.records.filter((r) => r.status === "exhausted");
  }

  async retryPending(router: EventRouter): Promise<{ retried: number; succeeded: number; failed: number }> {
    let retried = 0;
    let succeeded = 0;
    let failed = 0;

    for (const record of this.records) {
      if (record.status !== "pending") continue;
      retried++;
      record.attempts++;
      record.lastAttemptAt = new Date().toISOString();

      try {
        const { failed: failList } = await router.routeEvent(record.event, this, true);
        if (!failList.includes(record.sinkName)) {
          record.status = "retried";
          succeeded++;
        } else {
          if (record.attempts >= record.maxAttempts) {
            record.status = "exhausted";
          }
          failed++;
        }
      } catch (err: any) {
        record.errorReason = err?.message ?? String(err);
        if (record.attempts >= record.maxAttempts) {
          record.status = "exhausted";
        }
        failed++;
      }
    }

    return { retried, succeeded, failed };
  }
}

// Global Singleton Instances
export const cdcRouter = new EventRouter();
export const cdcDlq = new DeadLetterQueue();

// Step 1 Trigger Function: Called by DB mutations to fire CDC events instantly
export async function emitCdcChange<T = Record<string, unknown>>(params: {
  table: string;
  operation: CdcOperation;
  before?: T | null;
  after?: T | null;
}): Promise<{ event: CdcEvent<T>; delivered: string[]; failed: string[] }> {
  const event: CdcEvent<T> = {
    id: `cdc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    table: params.table,
    operation: params.operation,
    before: params.before ?? null,
    after: params.after ?? null,
    timestamp: new Date().toISOString(),
  };

  const { delivered, failed } = await cdcRouter.routeEvent(event, cdcDlq);
  return { event, delivered, failed };
}

// Register Standard Downstream System Sinks
export const SEARCH_INDEX_SINK_NAME = "SearchIndexSink";
export const ANALYTICS_SINK_NAME = "AnalyticsDashboardSink";
export const NOTIFICATION_ALERT_SINK_NAME = "NotificationAlertSink";

// Mock in-memory sink stores for downstream verification
export const mockSearchIndexStore = new Map<string, any>();
export const mockAnalyticsDashboardStore = { transactionCount: 0, revenueTotal: 0 };
export const mockNotificationAlertLogs: string[] = [];

// Step 2: Wire Event Filters per Downstream System Requirement
cdcRouter.subscribe("menu_items.*", SEARCH_INDEX_SINK_NAME, async (event) => {
  if (event.operation === "DELETE") {
    if (event.before?.slug) mockSearchIndexStore.delete(String(event.before.slug));
  } else if (event.after?.slug) {
    mockSearchIndexStore.set(String(event.after.slug), event.after);
  }
});

cdcRouter.subscribe("orders.*", ANALYTICS_SINK_NAME, async (event) => {
  if (event.operation === "INSERT" || event.operation === "UPDATE") {
    mockAnalyticsDashboardStore.transactionCount++;
    if (event.after?.totalPaise) {
      mockAnalyticsDashboardStore.revenueTotal += Number(event.after.totalPaise);
    }
  }
});

cdcRouter.subscribe("rd_advisory_alerts.INSERT", NOTIFICATION_ALERT_SINK_NAME, async (event) => {
  if (event.after?.message) {
    mockNotificationAlertLogs.push(`[ALERT SENT]: ${event.after.message}`);
  }
});
