import { and, desc, eq, gte, isNull, lt, or, sql } from "drizzle-orm";
import {
  db,
  anomalyAlertsTable,
  ordersTable,
  deliveryEventsTable,
  webhookInboxTable,
  type AnomalyAlert,
} from "@workspace/db";
import { logger } from "./logger";
import { explainAnomalyWithAI } from "./anomalyExplainer";

// ─── Types & metric registry ───────────────────────────────────────────────

export type MetricKey =
  | "refund_rate"
  | "kitchen_ready_minutes"
  | "rider_acceptance_minutes"
  | "payment_failure_rate"
  | "low_rating_rate"
  | "webhook_inbox_failed";

export interface MetricSample {
  metric: MetricKey;
  value: number;
  // Optional volume so we can require a minimum sample size before alerting.
  sampleSize: number;
}

export interface MetricResult extends MetricSample {
  baseline: number | null;
  baselineStd: number | null;
  // Per-metric thresholding. `value` exceeds when:
  //   - direction === "high" and value > threshold (or > baseline + k*std)
  //   - direction === "low"  and value < threshold (or < baseline - k*std)
  threshold: number;
  direction: "high" | "low";
  windowStart: Date;
  windowEnd: Date;
}

const HOUR_MS = 60 * 60 * 1000;

interface MetricSpec {
  key: MetricKey;
  label: string;
  // Minimum sample size in the current window before we will alert. Avoids
  // noisy alerts during low-volume periods.
  minSamples: number;
  // Floor / ceiling. For high-direction metrics, current value must exceed
  // BOTH (baseline + k*std) AND `floor` to alert. Prevents alerting when
  // baseline noise produces tiny absolute values.
  floor: number;
  // Standard-deviation multiplier for dynamic threshold.
  k: number;
  direction: "high" | "low";
  unit: string;
  // Plain-language template. {value} {baseline} {unit} are substituted.
  summaryTemplate: (s: SummaryArgs) => string;
  suggestedAction: (s: SummaryArgs) => string;
}

interface SummaryArgs {
  value: number;
  baseline: number | null;
  threshold: number;
  windowStart: Date;
  windowEnd: Date;
  sampleSize: number;
}

const fmt = (n: number, digits = 1): string =>
  Number.isFinite(n) ? n.toFixed(digits) : "—";
const fmtPct = (n: number): string => `${(n * 100).toFixed(1)}%`;
const fmtTime = (d: Date): string =>
  d.toISOString().replace("T", " ").slice(11, 16);

const METRICS: Record<MetricKey, MetricSpec> = {
  refund_rate: {
    key: "refund_rate",
    label: "Refund rate",
    minSamples: 10,
    floor: 0.05, // ignore <5% absolute
    k: 2.5,
    direction: "high",
    unit: "%",
    summaryTemplate: (s) =>
      `Refunds ran at ${fmtPct(s.value)} of orders between ${fmtTime(s.windowStart)}–${fmtTime(s.windowEnd)} (${s.sampleSize} orders), versus a recent baseline of ${s.baseline != null ? fmtPct(s.baseline) : "n/a"}.`,
    suggestedAction: () =>
      "Spot-check the last 10 refunded orders for a common SKU, kitchen station, or delivery zone, then 86 the offending dish or pause the route.",
  },
  kitchen_ready_minutes: {
    key: "kitchen_ready_minutes",
    label: "Kitchen ticket-to-ready time",
    minSamples: 8,
    floor: 14, // ignore <14 min average
    k: 2,
    direction: "high",
    unit: "min",
    summaryTemplate: (s) =>
      `Kitchen took ${fmt(s.value)} min on average to mark orders ready in the last hour (${s.sampleSize} orders); baseline is ${s.baseline != null ? `${fmt(s.baseline)} min` : "n/a"}.`,
    suggestedAction: () =>
      "Pull up the live queue, identify the slowest station, and decide whether to add a cook, simplify the menu, or 86 a slow-prep dish.",
  },
  rider_acceptance_minutes: {
    key: "rider_acceptance_minutes",
    label: "Rider pickup lag",
    minSamples: 5,
    floor: 6,
    k: 2,
    direction: "high",
    unit: "min",
    summaryTemplate: (s) =>
      `Riders are taking ${fmt(s.value)} min on average to leave the kitchen after assignment (${s.sampleSize} handoffs); baseline is ${s.baseline != null ? `${fmt(s.baseline)} min` : "n/a"}.`,
    suggestedAction: () =>
      "Check rider availability and online count; consider a smart-dispatch run or escalate to the rider supervisor if drop-offs are clustered in one zone.",
  },
  payment_failure_rate: {
    key: "payment_failure_rate",
    label: "Payment failures",
    minSamples: 8,
    floor: 0.04,
    k: 2.5,
    direction: "high",
    unit: "%",
    summaryTemplate: (s) =>
      `Payment failures hit ${fmtPct(s.value)} of attempts in the last hour (${s.sampleSize} orders); baseline ${s.baseline != null ? fmtPct(s.baseline) : "n/a"}.`,
    suggestedAction: () =>
      "Check the payments dashboard for upstream gateway errors; if isolated to a single PSP, fail over and notify finance.",
  },
  low_rating_rate: {
    key: "low_rating_rate",
    label: "Low ratings (≤2★)",
    minSamples: 5,
    floor: 0.1,
    k: 2,
    direction: "high",
    unit: "%",
    summaryTemplate: (s) =>
      `${fmtPct(s.value)} of rated orders in the last hour scored ≤2★ (${s.sampleSize} ratings); baseline ${s.baseline != null ? fmtPct(s.baseline) : "n/a"}.`,
    suggestedAction: () =>
      "Open the support agent and review the linked orders; cluster by dish or rider before issuing make-good credits.",
  },
  // F-4. `webhook_inbox` is written on every verified Razorpay callback and
  // read by NOTHING in the running system — repo-wide, its only other readers
  // are two manual verification scripts. A rotated webhook secret, a payload
  // schema drift, or a sustained gateway outage therefore piles up `failed`
  // rows in complete silence, while the customer's money is captured and the
  // order never leaves "placed".
  //
  // Unlike the five metrics above this is a COUNT, not a rate, and it is not
  // baseline-relative: the correct number of unprocessed webhooks is zero, so
  // there is no "normal level" to learn. floor 0 + direction high + minSamples
  // 1 means a single stuck row in the hour fires, which is the intent.
  webhook_inbox_failed: {
    key: "webhook_inbox_failed",
    label: "Unprocessed payment webhooks",
    minSamples: 1,
    floor: 0,
    k: 2,
    direction: "high",
    unit: "",
    summaryTemplate: (s) =>
      `${fmt(s.value)} Razorpay webhook${s.value === 1 ? "" : "s"} between ${fmtTime(s.windowStart)}–${fmtTime(s.windowEnd)} are still unprocessed (failed or pending). Each one is a capture whose order may never have been confirmed.`,
    suggestedAction: () =>
      "Run `pnpm --filter @workspace/scripts run audit-webhook-inbox` for the backlog and the stranded captures behind it, then check the webhook secret and the gateway's delivery log before replaying.",
  },
};

export function listMetrics(): MetricSpec[] {
  return Object.values(METRICS);
}

// ─── Sampling primitives ───────────────────────────────────────────────────

interface WindowBucket {
  start: Date;
  end: Date;
  value: number;
  sampleSize: number;
}

// Refund rate from orders.status='refunded' over total orders created in window.
async function sampleRefundRate(start: Date, end: Date): Promise<WindowBucket> {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      refunded: sql<number>`sum(case when ${ordersTable.status} = 'refunded' then 1 else 0 end)::int`,
    })
    .from(ordersTable)
    .where(
      and(
        gte(ordersTable.createdAt, start),
        lt(ordersTable.createdAt, end),
      ),
    );
  const total = row?.total ?? 0;
  const refunded = row?.refunded ?? 0;
  return {
    start,
    end,
    value: total > 0 ? refunded / total : 0,
    sampleSize: total,
  };
}

// Kitchen time = createdAt → first 'ready' delivery_event.
async function sampleKitchenReady(
  start: Date,
  end: Date,
): Promise<WindowBucket> {
  const rows = await db.execute<{ minutes: number }>(sql`
    select extract(epoch from (min(de.created_at) - o.created_at)) / 60.0 as minutes
    from ${ordersTable} o
    join ${deliveryEventsTable} de on de.order_id = o.id and de.event = 'ready'
    where o.created_at >= ${start} and o.created_at < ${end}
    group by o.id
  `);
  const samples = rows.rows
    .map((r) => Number(r.minutes))
    .filter((n) => Number.isFinite(n) && n > 0 && n < 240);
  return {
    start,
    end,
    value: samples.length > 0 ? avg(samples) : 0,
    sampleSize: samples.length,
  };
}

// Rider acceptance = rider_assigned → out_for_delivery, per order.
async function sampleRiderAcceptance(
  start: Date,
  end: Date,
): Promise<WindowBucket> {
  const rows = await db.execute<{ minutes: number }>(sql`
    select extract(epoch from (min(d2.created_at) - min(d1.created_at))) / 60.0 as minutes
    from ${deliveryEventsTable} d1
    join ${deliveryEventsTable} d2
      on d2.order_id = d1.order_id and d2.event = 'out_for_delivery'
    where d1.event = 'rider_assigned'
      and d1.created_at >= ${start} and d1.created_at < ${end}
    group by d1.order_id
  `);
  const samples = rows.rows
    .map((r) => Number(r.minutes))
    .filter((n) => Number.isFinite(n) && n >= 0 && n < 120);
  return {
    start,
    end,
    value: samples.length > 0 ? avg(samples) : 0,
    sampleSize: samples.length,
  };
}

// Payment failure rate from delivery_events event='payment_failed'
// versus total orders in window.
async function samplePaymentFailures(
  start: Date,
  end: Date,
): Promise<WindowBucket> {
  const [orderRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(ordersTable)
    .where(
      and(gte(ordersTable.createdAt, start), lt(ordersTable.createdAt, end)),
    );
  const [failRow] = await db
    .select({ failed: sql<number>`count(*)::int` })
    .from(deliveryEventsTable)
    .where(
      and(
        eq(deliveryEventsTable.event, "payment_failed"),
        gte(deliveryEventsTable.createdAt, start),
        lt(deliveryEventsTable.createdAt, end),
      ),
    );
  const total = orderRow?.total ?? 0;
  const failed = failRow?.failed ?? 0;
  return {
    start,
    end,
    value: total > 0 ? failed / total : 0,
    sampleSize: total,
  };
}

// Low ratings: delivery_events event='order_rated' meta.rating <= 2.
async function sampleLowRatings(
  start: Date,
  end: Date,
): Promise<WindowBucket> {
  const rows = await db.execute<{ rating: number }>(sql`
    select (meta->>'rating')::numeric as rating
    from ${deliveryEventsTable}
    where event = 'order_rated'
      and created_at >= ${start} and created_at < ${end}
      and meta ? 'rating'
  `);
  const ratings = rows.rows
    .map((r) => Number(r.rating))
    .filter((n) => Number.isFinite(n));
  if (ratings.length === 0) {
    return { start, end, value: 0, sampleSize: 0 };
  }
  const low = ratings.filter((r) => r <= 2).length;
  return {
    start,
    end,
    value: low / ratings.length,
    sampleSize: ratings.length,
  };
}


// F-4: unprocessed Razorpay webhooks in the window. "sampleSize" is the total
// razorpay rows written in that hour, so the alert can say "3 of 40 stuck"
// rather than a bare count; the VALUE is the stuck count itself.
async function sampleWebhookInboxFailed(
  start: Date,
  end: Date,
): Promise<WindowBucket> {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      stuck: sql<number>`count(*) filter (where ${webhookInboxTable.status} <> 'processed' and ${webhookInboxTable.status} <> 'duplicate')::int`,
    })
    .from(webhookInboxTable)
    .where(
      and(
        eq(webhookInboxTable.source, "razorpay"),
        gte(webhookInboxTable.createdAt, start),
        lt(webhookInboxTable.createdAt, end),
      ),
    );
  const stuck = row?.stuck ?? 0;
  return {
    start,
    end,
    value: stuck,
    // minSamples is 1 and a stuck row is itself the evidence, so the sample
    // size must be the stuck count — keying it to total rows would mute the
    // alarm in exactly the outage where NO webhook is being processed.
    sampleSize: stuck,
  };
}

const SAMPLERS: Record<
  MetricKey,
  (start: Date, end: Date) => Promise<WindowBucket>
> = {
  refund_rate: sampleRefundRate,
  kitchen_ready_minutes: sampleKitchenReady,
  rider_acceptance_minutes: sampleRiderAcceptance,
  payment_failure_rate: samplePaymentFailures,
  low_rating_rate: sampleLowRatings,
  webhook_inbox_failed: sampleWebhookInboxFailed,
};

// ─── Batch (grouped-by-hour) samplers for buildBaseline ────────────────────
//
// buildBaseline used to call a single-window SAMPLER once per hour across a
// 168-hour lookback — 168 sequential round trips per metric, up to 840 per
// scan. These batch variants fetch the WHOLE lookback window in one grouped
// query (date_trunc('hour', ...) GROUP BY) and return a Map keyed by each
// bucket's start-hour epoch ms, so buildBaseline can look up 168 buckets
// from one already-fetched result instead of issuing 168 queries. Each one
// mirrors its single-window counterpart's exact filtering/aggregation
// logic — only the fetch is batched, not the semantics.

type BucketMap = Map<number, WindowBucket>;

function bucketOf(start: Date, sampleSize: number, value: number): WindowBucket {
  return {start, end: new Date(start.getTime() + HOUR_MS), value, sampleSize};
}

async function batchRefundRate(lookbackStart: Date, windowEnd: Date): Promise<BucketMap> {
  const rows = await db.execute<{bucket: Date; total: number; refunded: number}>(sql`
    select date_trunc('hour', created_at) as bucket,
           count(*)::int as total,
           sum(case when status = 'refunded' then 1 else 0 end)::int as refunded
    from ${ordersTable}
    where created_at >= ${lookbackStart} and created_at < ${windowEnd}
    group by bucket
  `);
  const map: BucketMap = new Map();
  for (const r of rows.rows) {
    const start = new Date(r.bucket);
    const total = Number(r.total);
    const refunded = Number(r.refunded);
    map.set(start.getTime(), bucketOf(start, total, total > 0 ? refunded / total : 0));
  }
  return map;
}

async function batchKitchenReady(lookbackStart: Date, windowEnd: Date): Promise<BucketMap> {
  // Same per-order shape as sampleKitchenReady: one row per order whose
  // 'ready' event falls after its creation, bucketed by the ORDER's hour
  // (matching the original's o.created_at-based windowing).
  const rows = await db.execute<{bucket: Date; minutes: number}>(sql`
    select date_trunc('hour', o.created_at) as bucket,
           extract(epoch from (min(de.created_at) - o.created_at)) / 60.0 as minutes
    from ${ordersTable} o
    join ${deliveryEventsTable} de on de.order_id = o.id and de.event = 'ready'
    where o.created_at >= ${lookbackStart} and o.created_at < ${windowEnd}
    group by o.id, bucket
  `);
  const grouped = new Map<number, number[]>();
  for (const r of rows.rows) {
    const minutes = Number(r.minutes);
    if (!Number.isFinite(minutes) || minutes <= 0 || minutes >= 240) continue;
    const bucketMs = new Date(r.bucket).getTime();
    const arr = grouped.get(bucketMs);
    if (arr) arr.push(minutes);
    else grouped.set(bucketMs, [minutes]);
  }
  const map: BucketMap = new Map();
  for (const [bucketMs, minutesArr] of grouped) {
    map.set(bucketMs, bucketOf(new Date(bucketMs), minutesArr.length, avg(minutesArr)));
  }
  return map;
}

async function batchRiderAcceptance(lookbackStart: Date, windowEnd: Date): Promise<BucketMap> {
  // d2 (out_for_delivery) is intentionally NOT window-filtered here, exactly
  // as sampleRiderAcceptance doesn't filter it either — only the d1
  // (rider_assigned) event determines which bucket a handoff belongs to.
  const rows = await db.execute<{bucket: Date; minutes: number}>(sql`
    select date_trunc('hour', d1.created_at) as bucket,
           extract(epoch from (min(d2.created_at) - min(d1.created_at))) / 60.0 as minutes
    from ${deliveryEventsTable} d1
    join ${deliveryEventsTable} d2
      on d2.order_id = d1.order_id and d2.event = 'out_for_delivery'
    where d1.event = 'rider_assigned'
      and d1.created_at >= ${lookbackStart} and d1.created_at < ${windowEnd}
    group by d1.order_id, bucket
  `);
  const grouped = new Map<number, number[]>();
  for (const r of rows.rows) {
    const minutes = Number(r.minutes);
    if (!Number.isFinite(minutes) || minutes < 0 || minutes >= 120) continue;
    const bucketMs = new Date(r.bucket).getTime();
    const arr = grouped.get(bucketMs);
    if (arr) arr.push(minutes);
    else grouped.set(bucketMs, [minutes]);
  }
  const map: BucketMap = new Map();
  for (const [bucketMs, minutesArr] of grouped) {
    map.set(bucketMs, bucketOf(new Date(bucketMs), minutesArr.length, avg(minutesArr)));
  }
  return map;
}

async function batchPaymentFailures(lookbackStart: Date, windowEnd: Date): Promise<BucketMap> {
  const [orderRows, failRows] = await Promise.all([
    db.execute<{bucket: Date; total: number}>(sql`
      select date_trunc('hour', created_at) as bucket, count(*)::int as total
      from ${ordersTable}
      where created_at >= ${lookbackStart} and created_at < ${windowEnd}
      group by bucket
    `),
    db.execute<{bucket: Date; failed: number}>(sql`
      select date_trunc('hour', created_at) as bucket, count(*)::int as failed
      from ${deliveryEventsTable}
      where event = 'payment_failed' and created_at >= ${lookbackStart} and created_at < ${windowEnd}
      group by bucket
    `),
  ]);
  const totals = new Map<number, number>();
  for (const r of orderRows.rows) totals.set(new Date(r.bucket).getTime(), Number(r.total));
  const failed = new Map<number, number>();
  for (const r of failRows.rows) failed.set(new Date(r.bucket).getTime(), Number(r.failed));

  const map: BucketMap = new Map();
  for (const [bucketMs, total] of totals) {
    const failedCount = failed.get(bucketMs) ?? 0;
    map.set(bucketMs, bucketOf(new Date(bucketMs), total, total > 0 ? failedCount / total : 0));
  }
  return map;
}

async function batchLowRatings(lookbackStart: Date, windowEnd: Date): Promise<BucketMap> {
  const rows = await db.execute<{bucket: Date; rating: number}>(sql`
    select date_trunc('hour', created_at) as bucket, (meta->>'rating')::numeric as rating
    from ${deliveryEventsTable}
    where event = 'order_rated'
      and created_at >= ${lookbackStart} and created_at < ${windowEnd}
      and meta ? 'rating'
  `);
  const grouped = new Map<number, number[]>();
  for (const r of rows.rows) {
    const rating = Number(r.rating);
    if (!Number.isFinite(rating)) continue;
    const bucketMs = new Date(r.bucket).getTime();
    const arr = grouped.get(bucketMs);
    if (arr) arr.push(rating);
    else grouped.set(bucketMs, [rating]);
  }
  const map: BucketMap = new Map();
  for (const [bucketMs, ratings] of grouped) {
    const low = ratings.filter((r) => r <= 2).length;
    map.set(bucketMs, bucketOf(new Date(bucketMs), ratings.length, low / ratings.length));
  }
  return map;
}


async function batchWebhookInboxFailed(lookbackStart: Date, windowEnd: Date): Promise<BucketMap> {
  const rows = await db.execute<{ bucket: Date; stuck: number }>(sql`
    select date_trunc('hour', created_at) as bucket,
           count(*) filter (where status <> 'processed' and status <> 'duplicate')::int as stuck
    from ${webhookInboxTable}
    where source = 'razorpay' and created_at >= ${lookbackStart} and created_at < ${windowEnd}
    group by bucket
  `);
  const map: BucketMap = new Map();
  for (const r of rows.rows) {
    const stuck = Number(r.stuck);
    map.set(new Date(r.bucket).getTime(), bucketOf(new Date(r.bucket), stuck, stuck));
  }
  return map;
}

const BATCH_SAMPLERS: Record<
  MetricKey,
  (lookbackStart: Date, windowEnd: Date) => Promise<BucketMap>
> = {
  refund_rate: batchRefundRate,
  kitchen_ready_minutes: batchKitchenReady,
  rider_acceptance_minutes: batchRiderAcceptance,
  payment_failure_rate: batchPaymentFailures,
  low_rating_rate: batchLowRatings,
  webhook_inbox_failed: batchWebhookInboxFailed,
};

// ─── Detector ──────────────────────────────────────────────────────────────

function avg(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stdDev(xs: number[], mean: number): number {
  if (xs.length < 2) return 0;
  const variance =
    xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(variance);
}

// Trailing baseline = same metric over the last `lookbackHours` hourly buckets,
// excluding the current window. We additionally weight by hour-of-day to be
// gently seasonality-aware: prefer same-hour samples from the lookback window
// when we have ≥3 of them, otherwise fall back to the full mean.
const LOOKBACK_HOURS = 24 * 7;

async function buildBaseline(
  metric: MetricKey,
  windowEnd: Date,
): Promise<{ baseline: number | null; std: number | null }> {
  // The original per-hour loop produced buckets [windowEnd-2h, windowEnd-1h)
  // (h=1, newest) through [windowEnd-169h, windowEnd-168h) (h=168, oldest) —
  // 168 hours, deliberately EXCLUDING the current [windowEnd-1h, windowEnd)
  // window (see the "excluding the current window" comment above). The
  // batch fetch must use the same bounds: up to windowEnd-1h, not windowEnd.
  const baselineEnd = new Date(windowEnd.getTime() - HOUR_MS);
  const lookbackStart = new Date(baselineEnd.getTime() - LOOKBACK_HOURS * HOUR_MS);
  const bucketMap = await BATCH_SAMPLERS[metric](lookbackStart, baselineEnd);

  const samples: WindowBucket[] = [];
  for (let h = 1; h <= LOOKBACK_HOURS; h++) {
    const start = new Date(windowEnd.getTime() - (h + 1) * HOUR_MS);
    samples.push(bucketMap.get(start.getTime()) ?? bucketOf(start, 0, 0));
  }
  const valid = samples.filter((s) => s.sampleSize > 0);
  if (valid.length < 3) return { baseline: null, std: null };
  const targetHour = new Date(windowEnd.getTime() - HOUR_MS).getUTCHours();
  const seasonal = valid.filter((s) => s.start.getUTCHours() === targetHour);
  const pool = seasonal.length >= 3 ? seasonal : valid;
  const values = pool.map((s) => s.value);
  const mean = avg(values);
  return { baseline: mean, std: stdDev(values, mean) };
}

function severityOf(deviation: number): "low" | "medium" | "high" {
  if (deviation >= 4) return "high";
  if (deviation >= 2.5) return "medium";
  return "low";
}

function fingerprintOf(metric: MetricKey, windowEnd: Date): string {
  // One alert per metric per hour bucket; guarantees idempotency if the
  // detector runs multiple times within a window.
  return `${metric}:${windowEnd.toISOString().slice(0, 13)}`;
}

export interface DetectionResult {
  metric: MetricKey;
  alertId: number | null;
  fired: boolean;
  reason: string;
  value: number;
  baseline: number | null;
  threshold: number;
  severity: "low" | "medium" | "high" | null;
  sampleSize: number;
}

async function evaluateMetric(
  metric: MetricKey,
  now: Date,
): Promise<DetectionResult> {
  const spec = METRICS[metric];
  const windowEnd = new Date(
    Math.floor(now.getTime() / HOUR_MS) * HOUR_MS,
  );
  const windowStart = new Date(windowEnd.getTime() - HOUR_MS);
  const sampler = SAMPLERS[metric];
  const current = await sampler(windowStart, windowEnd);

  if (current.sampleSize < spec.minSamples) {
    return {
      metric,
      alertId: null,
      fired: false,
      reason: `sample size ${current.sampleSize} < min ${spec.minSamples}`,
      value: current.value,
      baseline: null,
      threshold: spec.floor,
      severity: null,
      sampleSize: current.sampleSize,
    };
  }

  const { baseline, std } = await buildBaseline(metric, windowEnd);
  // Dynamic threshold = baseline ± k*std, but never below the absolute floor.
  let threshold: number;
  if (baseline == null || std == null || std === 0) {
    threshold = spec.floor;
  } else {
    threshold =
      spec.direction === "high"
        ? Math.max(spec.floor, baseline + spec.k * std)
        : Math.min(spec.floor, baseline - spec.k * std);
  }

  const breaches =
    spec.direction === "high"
      ? current.value > threshold && current.value >= spec.floor
      : current.value < threshold && current.value <= spec.floor;

  if (!breaches) {
    return {
      metric,
      alertId: null,
      fired: false,
      reason: `within bounds (value=${current.value.toFixed(3)} threshold=${threshold.toFixed(3)})`,
      value: current.value,
      baseline,
      threshold,
      severity: null,
      sampleSize: current.sampleSize,
    };
  }

  const deviation =
    baseline != null && std && std > 0
      ? Math.abs((current.value - baseline) / std)
      : (current.value - threshold) / Math.max(1e-6, threshold);
  const severity = severityOf(deviation);
  const summary = spec.summaryTemplate({
    value: current.value,
    baseline,
    threshold,
    windowStart,
    windowEnd,
    sampleSize: current.sampleSize,
  });
  const suggestedAction = spec.suggestedAction({
    value: current.value,
    baseline,
    threshold,
    windowStart,
    windowEnd,
    sampleSize: current.sampleSize,
  });

  const fingerprint = fingerprintOf(metric, windowEnd);
  // Optionally enrich the explanation with the AI explainer. The function
  // never throws — on any failure it returns null and we keep the template.
  const enriched = await explainAnomalyWithAI({
    metric,
    label: spec.label,
    severity,
    value: current.value,
    baseline,
    threshold,
    sampleSize: current.sampleSize,
    windowStart,
    windowEnd,
    templateSummary: summary,
    templateAction: suggestedAction,
  });
  const finalSummary = enriched?.summary ?? summary;
  const finalAction = enriched?.suggestedAction ?? suggestedAction;

  // Idempotent insert via DB-level UNIQUE(fingerprint) — concurrent scans
  // race onto onConflictDoNothing and at most one row is created.
  const inserted = await db
    .insert(anomalyAlertsTable)
    .values({
      metric,
      severity,
      status: "open",
      windowStart,
      windowEnd,
      value: current.value,
      baseline,
      threshold,
      deviation,
      dimensions: {
        sampleSize: current.sampleSize,
        label: spec.label,
        aiExplained: enriched != null,
      },
      summary: finalSummary,
      suggestedAction: finalAction,
      fingerprint,
    })
    .onConflictDoNothing({ target: anomalyAlertsTable.fingerprint })
    .returning({ id: anomalyAlertsTable.id });

  if (inserted.length === 0) {
    const [existing] = await db
      .select({ id: anomalyAlertsTable.id })
      .from(anomalyAlertsTable)
      .where(eq(anomalyAlertsTable.fingerprint, fingerprint))
      .limit(1);
    return {
      metric,
      alertId: existing?.id ?? null,
      fired: false,
      reason: "already raised this hour",
      value: current.value,
      baseline,
      threshold,
      severity,
      sampleSize: current.sampleSize,
    };
  }

  return {
    metric,
    alertId: inserted[0]?.id ?? null,
    fired: true,
    reason: "alert raised",
    value: current.value,
    baseline,
    threshold,
    severity,
    sampleSize: current.sampleSize,
  };
}

export async function runAnomalyScan(
  now: Date = new Date(),
): Promise<DetectionResult[]> {
  // The 5 metrics are independent — no reason to serialize them. Each still
  // gets the same per-metric error isolation the old try/catch-in-a-loop
  // gave: one metric throwing must not abort the others, so Promise.allSettled
  // (not Promise.all) with Object.keys(METRICS) order preserved.
  const settled = await Promise.allSettled(
    (Object.keys(METRICS) as MetricKey[]).map((metric) => evaluateMetric(metric, now)),
  );
  return settled.map((result, i) => {
    if (result.status === "fulfilled") return result.value;
    const metric = (Object.keys(METRICS) as MetricKey[])[i]!;
    logger.error({ err: result.reason, metric }, "anomaly evaluator failed");
    return {
      metric,
      alertId: null,
      fired: false,
      reason: `error: ${(result.reason as Error).message}`,
      value: 0,
      baseline: null,
      threshold: 0,
      severity: null,
      sampleSize: 0,
    };
  });
}

// ─── Alert lifecycle ──────────────────────────────────────────────────────

export interface ListAlertsOpts {
  status?: "open" | "ack" | "snoozed" | "closed" | "active";
  limit?: number;
}

export async function listAlerts(
  opts: ListAlertsOpts = {},
): Promise<AnomalyAlert[]> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const status = opts.status ?? "active";
  const now = new Date();
  const conditions = [];
  if (status === "active") {
    // Open OR ack'd-but-not-closed OR snooze expired.
    conditions.push(
      or(
        eq(anomalyAlertsTable.status, "open"),
        and(
          eq(anomalyAlertsTable.status, "snoozed"),
          or(
            isNull(anomalyAlertsTable.snoozedUntil),
            lt(anomalyAlertsTable.snoozedUntil, now),
          ),
        ),
      ),
    );
  } else {
    conditions.push(eq(anomalyAlertsTable.status, status));
  }
  return db
    .select()
    .from(anomalyAlertsTable)
    .where(and(...conditions))
    .orderBy(desc(anomalyAlertsTable.createdAt))
    .limit(limit);
}

export async function ackAlert(
  id: number,
  operatorId: string | null,
): Promise<AnomalyAlert | null> {
  const [row] = await db
    .update(anomalyAlertsTable)
    .set({ status: "ack", ackedBy: operatorId, ackedAt: new Date() })
    .where(eq(anomalyAlertsTable.id, id))
    .returning();
  return row ?? null;
}

export async function snoozeAlert(
  id: number,
  minutes: number,
  operatorId: string | null,
): Promise<AnomalyAlert | null> {
  const until = new Date(Date.now() + minutes * 60_000);
  const [row] = await db
    .update(anomalyAlertsTable)
    .set({
      status: "snoozed",
      snoozedUntil: until,
      ackedBy: operatorId,
      ackedAt: new Date(),
    })
    .where(eq(anomalyAlertsTable.id, id))
    .returning();
  return row ?? null;
}

export async function closeAlert(
  id: number,
  operatorId: string | null,
): Promise<AnomalyAlert | null> {
  const [row] = await db
    .update(anomalyAlertsTable)
    .set({
      status: "closed",
      closedAt: new Date(),
      ackedBy: operatorId,
      ackedAt: new Date(),
    })
    .where(eq(anomalyAlertsTable.id, id))
    .returning();
  return row ?? null;
}

// Daily digest = alerts raised in the last 24h, grouped by metric+severity.
export interface DigestRow {
  metric: MetricKey;
  severity: "low" | "medium" | "high";
  count: number;
  latestSummary: string;
  latestSuggestedAction: string;
}

export async function buildDailyDigest(): Promise<{
  windowStart: Date;
  windowEnd: Date;
  rows: DigestRow[];
  total: number;
}> {
  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - 24 * HOUR_MS);
  const rows = await db
    .select()
    .from(anomalyAlertsTable)
    .where(
      and(
        gte(anomalyAlertsTable.createdAt, windowStart),
        lt(anomalyAlertsTable.createdAt, windowEnd),
      ),
    )
    .orderBy(desc(anomalyAlertsTable.createdAt));
  const grouped = new Map<string, DigestRow>();
  for (const r of rows) {
    const key = `${r.metric}:${r.severity}`;
    const cur = grouped.get(key);
    if (cur) {
      cur.count += 1;
    } else {
      grouped.set(key, {
        metric: r.metric as MetricKey,
        severity: r.severity as "low" | "medium" | "high",
        count: 1,
        latestSummary: r.summary,
        latestSuggestedAction: r.suggestedAction,
      });
    }
  }
  return {
    windowStart,
    windowEnd,
    rows: Array.from(grouped.values()).sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 } as const;
      return order[a.severity] - order[b.severity] || b.count - a.count;
    }),
    total: rows.length,
  };
}

// ─── Test-only golden-comparison exports ───────────────────────────────────
//
// OA-DEEP-1.2: buildBaseline was rewritten from 168 sequential single-hour
// queries into 1-2 grouped queries per metric. __buildBaselineOldForTest is
// a FROZEN copy of the pre-optimization algorithm (unreachable from any
// production code path) that anomalies.golden.test.ts uses to assert the
// optimized buildBaseline produces identical output against real seeded
// data. Do not call these from application code.

export async function __buildBaselineOldForTest(
  metric: MetricKey,
  windowEnd: Date,
): Promise<{ baseline: number | null; std: number | null }> {
  const sampler = SAMPLERS[metric];
  const samples: WindowBucket[] = [];
  for (let h = 1; h <= LOOKBACK_HOURS; h++) {
    const end = new Date(windowEnd.getTime() - h * HOUR_MS);
    const start = new Date(end.getTime() - HOUR_MS);
    samples.push(await sampler(start, end));
  }
  const valid = samples.filter((s) => s.sampleSize > 0);
  if (valid.length < 3) return { baseline: null, std: null };
  const targetHour = new Date(windowEnd.getTime() - HOUR_MS).getUTCHours();
  const seasonal = valid.filter((s) => s.start.getUTCHours() === targetHour);
  const pool = seasonal.length >= 3 ? seasonal : valid;
  const values = pool.map((s) => s.value);
  const mean = avg(values);
  return { baseline: mean, std: stdDev(values, mean) };
}

export async function __buildBaselineForTest(
  metric: MetricKey,
  windowEnd: Date,
): Promise<{ baseline: number | null; std: number | null }> {
  return buildBaseline(metric, windowEnd);
}
