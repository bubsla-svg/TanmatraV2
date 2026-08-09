import { Queue, Worker, type Processor } from "bullmq";
import IORedis, { type Redis, type RedisOptions } from "ioredis";
import { logger } from "./logger";
import { db, deliveryEventsTable, ordersTable } from "@workspace/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { isPaidLive } from "./paidGate";

export const QUEUE_NAMES = {
  orderPipeline: "order-pipeline",
  riderAssignment: "rider-assignment",
} as const;

export interface OrderPipelineJob {
  orderId: number;
  step: "preparing" | "ready" | "out_for_delivery" | "delivered";
}

let connection: Redis | null = null;
let orderPipelineQueue: Queue<OrderPipelineJob> | null = null;
let workersStarted = false;
let activeWorker: Worker<OrderPipelineJob> | null = null;

type RedisTarget =
  | { kind: "url"; url: string }
  | { kind: "options"; options: RedisOptions };

let warnedBadRedisUrl = false;
let warnedBadRedisPort = false;

/**
 * Optional BullMQ key prefix so multiple environments (dev workspace,
 * Cloud Run prod) can share one Redis instance without stealing each
 * other's jobs. Unset -> BullMQ default ("bull").
 */
function bullPrefix(): string | undefined {
  const p = process.env["BULLMQ_PREFIX"]?.trim();
  return p || undefined;
}

/**
 * Resolve Redis connection config from either REDIS_URL (a full redis:// or
 * rediss:// URL) or the component vars REDIS_HOST / REDIS_PORT /
 * REDIS_PASSWORD (plus optional REDIS_USERNAME, REDIS_TLS="true").
 * Component config exists because providers like Redis Cloud surface
 * host/port/password as separate fields and hand-assembling a URL has
 * proven error-prone during setup.
 */
export function resolveRedisTarget(): RedisTarget | null {
  const raw = process.env["REDIS_URL"]?.trim();
  if (raw && /^rediss?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      if (parsed.hostname) {
        return { kind: "url", url: raw };
      }
      // no hostname (e.g. "redis://") — fall through to component config
    } catch {
      // invalid despite the scheme — fall through to component config
    }
  }
  if (raw && !warnedBadRedisUrl) {
    warnedBadRedisUrl = true;
    logger.warn(
      "REDIS_URL is set but is not a valid redis:// or rediss:// URL — ignoring it and using REDIS_HOST/REDIS_PORT/REDIS_PASSWORD if present",
    );
  }
  const host = process.env["REDIS_HOST"]?.trim();
  if (!host) return null;
  const portRaw = process.env["REDIS_PORT"]?.trim();
  const parsedPort = portRaw ? Number(portRaw) : 6379;
  if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
    if (!warnedBadRedisPort) {
      warnedBadRedisPort = true;
      logger.warn({ portRaw }, "REDIS_PORT is not a valid port (1-65535) — treating Redis as not configured");
    }
    return null;
  }
  const username = process.env["REDIS_USERNAME"]?.trim() || "default";
  const password = process.env["REDIS_PASSWORD"] || undefined;
  const options: RedisOptions = {
    host,
    port: parsedPort,
    ...(password ? { username, password } : {}),
    ...(process.env["REDIS_TLS"] === "true" ? { tls: {} } : {}),
  };
  return { kind: "options", options };
}

export function isRedisConfigured(): boolean {
  return resolveRedisTarget() !== null;
}

function getConnection(): Redis | null {
  if (connection) return connection;
  const target = resolveRedisTarget();
  if (!target) return null;
  connection =
    target.kind === "url"
      ? new IORedis(target.url, { maxRetriesPerRequest: null })
      : new IORedis({ ...target.options, maxRetriesPerRequest: null });
  connection.on("error", (err) => logger.error({ err }, "redis connection error"));
  return connection;
}

/**
 * Probe BullMQ's Redis connection. Returns "ok" when a `PING` succeeds,
 * "down" when the client errors out, and "disabled" when Redis was
 * never configured (dev-only path — production refuses to boot without
 * Redis config; see `assertRedisAvailableInProduction`).
 */
export async function probeRedis(): Promise<"ok" | "down" | "disabled"> {
  if (!isRedisConfigured()) return "disabled";
  const conn = getConnection();
  if (!conn) return "disabled";
  try {
    const reply = await conn.ping();
    return reply === "PONG" ? "ok" : "down";
  } catch (err) {
    logger.error({ err }, "redis ping failed");
    return "down";
  }
}

/**
 * Fail-closed boot check for production. The order pipeline (preparing
 * → ready → out_for_delivery → delivered transitions, auto-dispatch,
 * wellness auto-log, ETA actuals) ALL run inside the BullMQ worker. A
 * production node booted without Redis would silently accept orders that
 * never advance, never dispatch, and never log nutrition — a clinical
 * data integrity issue, not just a reliability one. Refuse to boot.
 */
const LOCAL_REDIS_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function assertRedisAvailableInProduction(): void {
  if (process.env["NODE_ENV"] !== "production") return;
  const target = resolveRedisTarget();
  if (!target) {
    throw new Error(
      "Redis must be configured in production (set REDIS_URL, or REDIS_HOST + REDIS_PORT + REDIS_PASSWORD): order pipeline worker would otherwise be silently disabled.",
    );
  }
  if (
    target.kind === "options" &&
    !target.options.password &&
    !LOCAL_REDIS_HOSTS.has(String(target.options.host))
  ) {
    throw new Error(
      "REDIS_HOST points at a remote Redis but REDIS_PASSWORD is not set — refusing to boot production with unauthenticated remote Redis config.",
    );
  }
}

export function getOrderPipelineQueue(): Queue<OrderPipelineJob> | null {
  if (orderPipelineQueue) return orderPipelineQueue;
  const conn = getConnection();
  if (!conn) return null;
  orderPipelineQueue = new Queue<OrderPipelineJob>(QUEUE_NAMES.orderPipeline, {
    connection: conn,
    ...(bullPrefix() ? { prefix: bullPrefix() } : {}),
  });
  return orderPipelineQueue;
}

/**
 * The delivery ladder, in order. Used to keep the pipeline's status write
 * monotonic — see `advanceStatus` below. Terminal/settlement states
 * (cancelled, failed, refunded, billed) are deliberately absent: a pipeline
 * step must never overwrite one, and leaving them unranked is what makes the
 * `inArray` guard exclude them.
 */
const DELIVERY_LADDER = [
  "placed",
  "preparing",
  "ready",
  "rider_assigned",
  "out_for_delivery",
  "delivered",
] as const;

/** Statuses a given pipeline step is allowed to advance FROM. */
function statusesBelow(step: OrderPipelineJob["step"]): string[] {
  const target = DELIVERY_LADDER.indexOf(step as (typeof DELIVERY_LADDER)[number]);
  return DELIVERY_LADDER.slice(0, target) as unknown as string[];
}

const orderPipelineProcessor: Processor<OrderPipelineJob> = async (job) => {
  const { orderId, step } = job.data;

  // Paid-liveness gate (lib/paidGate.ts), checked BEFORE any side effect
  // below. The status UPDATE further down already refuses to advance a
  // "placed" row (its WHERE clause excludes it via `below`), but that left
  // every OTHER effect here running unconditionally: the delivery_events
  // insert would fake a progression history, the "ready" step would
  // auto-dispatch a real rider (it keys only on riderId == null, not
  // status), and the "delivered" step would write a clinical nutrition log
  // — all for an order that, as far as payment is concerned, does not
  // exist yet. A job can reach here for an unpaid order via a delayed
  // schedule-advance queued before a payment-failed webhook landed, so this
  // has to be a fresh read, not trust in whatever queued the job.
  const [orderRow] = await db
    .select({ status: ordersTable.status })
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId))
    .limit(1);
  if (!orderRow || !isPaidLive(orderRow.status)) {
    logger.warn(
      { orderId, step, status: orderRow?.status ?? "not_found" },
      "order pipeline step skipped: order not paid-live",
    );
    return;
  }

  const eventName =
    step === "preparing"
      ? "order_preparing"
      : step === "ready"
        ? "rider_at_kitchen"
        : step === "out_for_delivery"
          ? "order_picked_up"
          : "delivered";

  // OA-MED-1.3 (TODO_optimization-auditor.md): the side effects below used to
  // swallow every error, so BullMQ marked the job completed and the configured
  // `attempts: 3` + exponential backoff never applied to them — an
  // auto-dispatch outage was invisible outside log volume. Two of them are now
  // rethrown so the retry actually engages.
  //
  // That is only safe because this prelude is idempotent, and it was NOT
  // before. A rethrown retry re-runs from the top, so previously it would have
  // (a) inserted a duplicate delivery_events row — the exact harm
  // scheduleOrderAdvance's jobId dedup key was added to prevent, just re-opened
  // from the retry side — and (b) blind-overwritten `status`, walking an order
  // that auto-dispatch had already moved to `rider_assigned` BACKWARDS to
  // `ready`. Both are fixed here first; the rethrows come after.

  // Insert-if-absent. delivery_events has no unique constraint (only two plain
  // indexes), so `onConflictDoNothing` has no target to key on — hence the
  // explicit NOT EXISTS. Safe without a lock because the jobId dedup key means
  // retries of a given (order, step) are sequential, never concurrent.
  await db.execute(sql`
    insert into ${deliveryEventsTable} (order_id, event)
    select ${orderId}, ${eventName}
    where not exists (
      select 1 from ${deliveryEventsTable}
      where order_id = ${orderId} and event = ${eventName}
    )
  `);

  // Monotonic: only advance from a status strictly earlier on the ladder.
  // A retry that finds the order already at `rider_assigned` (auto-dispatch
  // succeeded, something after it threw) now leaves it there instead of
  // rewinding it to `ready`.
  // "placed" is stripped from the OUTPUT, never from DELIVERY_LADDER — the
  // ladder's ranking is also the monotonicity guard, and unranking placed
  // would change the terminal-state exclusion semantics. Effect: the
  // pipeline can advance any paid progression, but the placed→preparing
  // edge stays exclusively payment's write (routes/payments.ts,
  // lib/reconciliationScheduler.ts, the verified zero-charge finalize —
  // lib/paidGate.ts). A schedule-advance on an unpaid order is a status
  // no-op.
  const below = statusesBelow(step).filter((s) => s !== "placed");
  if (below.length > 0) {
    await db
      .update(ordersTable)
      .set({ status: step })
      .where(and(eq(ordersTable.id, orderId), inArray(ordersTable.status, below)));
  }
  logger.info({ orderId, step }, "order pipeline step advanced");
  // Auto-run smart dispatch when an order becomes ready and has no rider yet.
  //
  // RETHROWN. A silent failure here leaves the order sitting in `ready` with
  // no rider — this file's own comment calls that class of failure "a clinical
  // data integrity issue, not just a reliability one". Retry-safe: the
  // riderId pre-check below plus dispatchOrder's own `locked.rider_id != null`
  // guard mean a retry can never assign a second rider.
  if (step === "ready") {
    try {
      const [order] = await db
        .select({ riderId: ordersTable.riderId })
        .from(ordersTable)
        .where(eq(ordersTable.id, orderId))
        .limit(1);
      if (order && order.riderId == null) {
        const { dispatchOrder } = await import("./dispatch");
        const result = await dispatchOrder(orderId, { allowBatch: true });
        logger.info(
          { orderId, riderId: result.riderId, batched: result.batched },
          "auto-dispatch on ready",
        );
      }
    } catch (err) {
      logger.error({ err, orderId }, "auto-dispatch failed");
      throw err;
    }
  }
  if (step === "delivered") {
    // Auto-log nutrition for the user's wellness dashboard.
    //
    // RETHROWN. Nutrition rows feed the clinical wellness dashboard; a lost
    // log is silently wrong health data. Retry-safe: autoLogDeliveredOrder
    // inserts with `dedupeKey: order:<id>:<line>` and onConflictDoNothing, so
    // calling it twice is documented as a no-op.
    try {
      const { autoLogDeliveredOrder } = await import("./wellnessAutoLog");
      await autoLogDeliveredOrder(orderId);
    } catch (err) {
      logger.error({ err, orderId }, "wellness auto-log failed");
      throw err;
    }
    // NOT rethrown, deliberately. recordActualDelivery only backfills
    // eta_predictions.actual_minutes for model-accuracy analytics; a missing
    // row degrades a metric and nothing user-facing. Retrying the whole job
    // three times — re-running dispatch and wellness logging with it — to
    // salvage an analytics backfill is a worse trade than losing the row.
    try {
      const { recordActualDelivery } = await import("./etaModel");
      await recordActualDelivery(orderId);
    } catch (err) {
      logger.error({ err, orderId }, "eta actual record failed");
    }
  }
  // NOT rethrown, and correctly so: emitDeliveryEvent is a pure socket.io
  // broadcast with no persistence (`if (!io) return;`). Retrying it 2s later
  // is pointless — the socket room has moved on — and the bare catch is the
  // documented "realtime module not initialized yet" case.
  try {
    const { emitDeliveryEvent } = await import("./realtime");
    emitDeliveryEvent(orderId, { event: eventName });
  } catch {
    /* realtime module not initialized yet */
  }
};

/**
 * Test seam for the pipeline processor. The prelude's idempotency is what
 * makes the rethrows above safe, so it needs direct coverage — and driving it
 * through a real BullMQ worker would require Redis for what is purely a
 * Postgres-state assertion.
 */
export const _orderPipelineProcessorForTests = (
  data: OrderPipelineJob,
): Promise<unknown> =>
  (orderPipelineProcessor as (job: { data: OrderPipelineJob }) => Promise<unknown>)({
    data,
  });

export function startWorkers(): void {
  if (workersStarted) return;
  const conn = getConnection();
  if (!conn) {
    logger.warn(
      "Redis not configured (set REDIS_URL or REDIS_HOST/REDIS_PORT/REDIS_PASSWORD) — BullMQ queue and worker disabled. Background jobs will be skipped.",
    );
    return;
  }
  workersStarted = true;
  const concurrency = Number(process.env["ORDER_PIPELINE_CONCURRENCY"] ?? 4);
  const worker = new Worker<OrderPipelineJob>(QUEUE_NAMES.orderPipeline, orderPipelineProcessor, {
    ...(bullPrefix() ? { prefix: bullPrefix() } : {}),
    connection: conn,
    concurrency: Number.isFinite(concurrency) && concurrency > 0 ? concurrency : 4,
  });
  worker.on("failed", (job, err) =>
    logger.error({ err, jobId: job?.id, attemptsMade: job?.attemptsMade }, "order pipeline job failed"),
  );
  worker.on("error", (err) =>
    logger.error({ err }, "order pipeline worker error"),
  );
  activeWorker = worker;
  logger.info({ concurrency }, "BullMQ worker started for order-pipeline");
}

/**
 * Drain the worker so in-flight jobs complete cleanly. Called from the
 * SIGTERM handler in index.ts.
 */
export async function stopWorkers(): Promise<void> {
  if (!activeWorker) return;
  try {
    await activeWorker.close();
  } finally {
    activeWorker = null;
    workersStarted = false;
  }
}

export async function scheduleOrderAdvance(
  orderId: number,
  step: OrderPipelineJob["step"],
  delayMs: number,
): Promise<boolean> {
  const queue = getOrderPipelineQueue();
  if (!queue) return false;
  await queue.add(
    `advance-${orderId}-${step}`,
    { orderId, step },
    {
      // Dedup key. The name above is only a display label — without an
      // explicit jobId, a retry of POST /delivery/schedule-advance (or a
      // second dispatchRoutedFulfillment call) enqueues a SECOND job for
      // the same (order, step), producing a duplicate delivery_events row
      // and a duplicate customer push notification. An order only passes
      // through each step once in its normal lifecycle, so a deliberate
      // ops re-run of an already-completed step needs a fresh jobId (or
      // the prior job removed first) — this is the one intentional
      // behavior change from adding this key.
      jobId: `advance-${orderId}-${step}`,
      delay: delayMs,
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      // Keep the last 1k completed and last 5k failed jobs so we have a
      // visible failure trail without unbounded Redis growth. (Default
      // is unbounded.)
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  );
  return true;
}
