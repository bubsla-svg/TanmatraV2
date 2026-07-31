import { Queue, Worker, type Processor } from "bullmq";
import IORedis, { type Redis, type RedisOptions } from "ioredis";
import { logger } from "./logger";
import { db, deliveryEventsTable, ordersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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

const orderPipelineProcessor: Processor<OrderPipelineJob> = async (job) => {
  const { orderId, step } = job.data;
  const eventName =
    step === "preparing"
      ? "order_preparing"
      : step === "ready"
        ? "rider_at_kitchen"
        : step === "out_for_delivery"
          ? "order_picked_up"
          : "delivered";
  await db.insert(deliveryEventsTable).values({ orderId, event: eventName });
  await db.update(ordersTable).set({ status: step }).where(eq(ordersTable.id, orderId));
  logger.info({ orderId, step }, "order pipeline step advanced");
  // Auto-run smart dispatch when an order becomes ready and has no rider yet.
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
    }
  }
  // Auto-log nutrition for the user's wellness dashboard on delivery.
  if (step === "delivered") {
    try {
      const { autoLogDeliveredOrder } = await import("./wellnessAutoLog");
      await autoLogDeliveredOrder(orderId);
    } catch (err) {
      logger.error({ err, orderId }, "wellness auto-log failed");
    }
    try {
      const { recordActualDelivery } = await import("./etaModel");
      await recordActualDelivery(orderId);
    } catch (err) {
      logger.error({ err, orderId }, "eta actual record failed");
    }
  }
  // Hook for socket fanout — late-bound to avoid import cycle.
  try {
    const { emitDeliveryEvent } = await import("./realtime");
    emitDeliveryEvent(orderId, { event: eventName });
  } catch {
    /* realtime module not initialized yet */
  }
};

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
