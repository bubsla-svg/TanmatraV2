import { createServer } from "node:http";
import app from "./app";
import { logger } from "./lib/logger";
import { initRealtime } from "./lib/realtime";
import {
  assertRedisAvailableInProduction,
  startWorkers,
  stopWorkers,
} from "./lib/queue";
import { startLoyaltyScheduler } from "./lib/loyaltyScheduler";
import { startAnomalyScheduler } from "./lib/anomalyScheduler";
import { startAnomalyDigestSender } from "./lib/anomalyDigestSender";
import { startReviewSummarizerScheduler } from "./lib/menuEngineeringScheduler";
import { startMealPlanScheduler } from "./lib/mealPlanScheduler";
import { startAnalyticsScheduler } from "./lib/analyticsScheduler";
import { startFunnelRollupScheduler } from "./lib/funnelRollupScheduler";
import { startPreDebitScheduler, stopPreDebitScheduler } from "./lib/preDebitScheduler";
import { startTrialLifecycleScheduler, stopTrialLifecycleScheduler } from "./lib/trialLifecycleScheduler";
import { startChargeMandateScheduler, stopChargeMandateScheduler } from "./lib/chargeMandateScheduler";
import {
  startSubscriptionAbandonmentScheduler,
  stopSubscriptionAbandonmentScheduler,
} from "./lib/subscriptionAbandonmentScheduler";
import { ensureSafeViews } from "./lib/safeSql";
import { resumeActiveSimulations } from "./lib/riderSim";
import { purgeExpiredRateLimits } from "./lib/rateLimit";
import { purgeExpiredSessions, purgeDeletedAccountsJob } from "./lib/auth";
import { sweepExpiredIdempotencyKeys } from "./middlewares/idempotency";
import { sweepOrphanSlotReservations } from "./routes/fulfillment";
import { drainOpsAuditOutbox } from "./lib/opsAudit";
import { pool, overridePool } from "@workspace/db";
import { validateEnv } from "./lib/validateEnv";
import { ensureRectificationSchema } from "./lib/ensureRectificationSchema";

// Fail-fast on missing critical env + warn on degraded config before binding.
validateEnv();

const rawPort = process.env["PORT"];
let port = 8080;

if (!rawPort) {
  if (process.env["NODE_ENV"] === "production") {
    logger.fatal("PORT environment variable is required in production but was not provided. Exiting.");
    process.exit(1);
  } else {
    logger.info("PORT environment variable not provided. Defaulting to 8080.");
  }
} else {
  const parsed = Number(rawPort);
  if (Number.isNaN(parsed) || parsed <= 0) {
    logger.fatal({ rawPort }, "Invalid PORT environment variable provided. Exiting.");
    process.exit(1);
  }
  port = parsed;
}

const schedulersDisabled = process.env["DISABLE_SCHEDULERS"] === "true";

// The order-pipeline worker is core infrastructure: fail closed in
// production whenever Redis is missing, even when the periodic
// schedulers are disabled.
assertRedisAvailableInProduction();

const httpServer = createServer(app);
initRealtime(httpServer);
// startWorkers self-guards (warns and no-ops when Redis is not
// configured); only the periodic schedulers honor DISABLE_SCHEDULERS.
startWorkers();
if (!schedulersDisabled) {
  startLoyaltyScheduler();
  startAnomalyScheduler();
  startAnomalyDigestSender();
  startReviewSummarizerScheduler();
  startMealPlanScheduler();
  startPreDebitScheduler();
  startTrialLifecycleScheduler();
  startChargeMandateScheduler();
  startSubscriptionAbandonmentScheduler();
  // Nightly funnel_events → funnel_daily aggregation (Part 8 A1). The table
  // is ensured by ensureRectificationSchema() before the port binds, and the
  // scheduler's first tick is delayed past that. FUNNEL_ROLLUP_DISABLED=1
  // gates it off individually.
  startFunnelRollupScheduler();
  void resumeActiveSimulations();
}

// Bootstrap the curated safe_* views and reader role BEFORE we start
// listening, so the very first /analytics/* request can never race view
// creation. We then start the scheduler and bind the port.
async function start(): Promise<void> {
 // Properly catch port-binding errors
 httpServer.on("error", (err: NodeJS.ErrnoException) => {
 logger.error({ err }, "Error listening on port");
 process.exit(1);
 });

 // Additive, idempotent schema ensure (vendor batch + wearable ingestion).
 // Runs BEFORE the port binds so new tables/columns exist before any request
 // (e.g. the Wellness page querying wearable_links) is served.
 await ensureRectificationSchema();

 // Explicitly bind to 0.0.0.0 for Cloud Run compatibility
 httpServer.listen(port, "0.0.0.0", () => {
 logger.info({ port }, "Server listening on 0.0.0.0");
 ensureSafeViews()
 .then(() => {
   startAnalyticsScheduler();
 })
 .catch((err) => {
   logger.error({ err }, "ensureSafeViews failed (continuing without safe layer)");
   startAnalyticsScheduler();
 });
 });
}
void start();

// --- Background hygiene -----------------------------------------------------
//
// `rateLimitsTable` and `sessionsTable` rows are only deleted as a side effect
// of the next request that hits the same key. Without a sweeper, expired rows
// accumulate forever under attack. Run a low-frequency cleanup on every node;
// concurrent purges are safe.
const HOUR = 60 * 60 * 1000;
const purgeTimer = setInterval(() => {
 Promise.all([
 purgeExpiredRateLimits().catch((err) =>
 logger.error({ err }, "purgeExpiredRateLimits failed"),
 ),
 purgeExpiredSessions().catch((err) =>
 logger.error({ err }, "purgeExpiredSessions failed"),
 ),
 // Idempotency cache rows have a 24h TTL but nothing deletes them on
 // their own — the middleware only cleans the specific row it tried
 // to insert. Sweep here so the table doesn't grow unbounded under
 // sustained order traffic.
 sweepExpiredIdempotencyKeys().catch((err) =>
 logger.error({ err }, "sweepExpiredIdempotencyKeys failed"),
 ),
 ]).catch(() => {
 /* swallowed above */
 });
}, HOUR);
purgeTimer.unref();

const DAY = 24 * 60 * 60 * 1000;
const deletedAccountsPurgeTimer = setInterval(() => {
 purgeDeletedAccountsJob().catch((err) =>
  logger.error({ err }, "purgeDeletedAccountsJob failed"),
 );
}, DAY);
deletedAccountsPurgeTimer.unref();

// Reserve-and-create saga (Task #6) compensator runs on a SHORT cadence
// so a connection drop that leaves a phantom slot reservation behind is
// reclaimed within ~SLOT_RECLAIM_INTERVAL_MS + graceMs (≈90s with the
// defaults below), not the hourly hygiene window. This bounds the worst-
// case capacity-starvation latency under load.
const SLOT_RECLAIM_INTERVAL_MS = Number(process.env["SLOT_RECLAIM_INTERVAL_MS"] ?? "30000");
const SLOT_RECLAIM_GRACE_MS = Number(process.env["SLOT_RECLAIM_GRACE_MS"] ?? "60000");
const slotReclaimTimer = setInterval(() => {
 sweepOrphanSlotReservations({ graceMs: SLOT_RECLAIM_GRACE_MS })
 .then((n) => {
 if (n > 0) logger.info({ reclaimed: n }, "sweepOrphanSlotReservations reclaimed");
 })
 .catch((err) =>
 logger.error({ err }, "sweepOrphanSlotReservations failed"),
 );
}, SLOT_RECLAIM_INTERVAL_MS);
slotReclaimTimer.unref();

// Task #7 bulkhead: drain the ops_audit_outbox at a fast cadence so
// staff override actions show up in the audit trail within a couple
// of seconds even though they were committed off the critical path.
// SKIP LOCKED inside the drainer means a second pod is safe; failures
// per-row are caught and recorded inside the worker.
const OPS_AUDIT_DRAIN_INTERVAL_MS = Number(process.env["OPS_AUDIT_DRAIN_INTERVAL_MS"] ?? "2000");
const OPS_AUDIT_DRAIN_BATCH = Number(process.env["OPS_AUDIT_DRAIN_BATCH"] ?? "50");
let opsAuditDrainInFlight = false;
const opsAuditOutboxTimer = setInterval(() => {
 if (opsAuditDrainInFlight) return;
 opsAuditDrainInFlight = true;
 drainOpsAuditOutbox(OPS_AUDIT_DRAIN_BATCH)
 .catch((err) =>
 logger.error({ err }, "drainOpsAuditOutbox failed"),
 )
 .finally(() => {
 opsAuditDrainInFlight = false;
 });
}, OPS_AUDIT_DRAIN_INTERVAL_MS);
opsAuditOutboxTimer.unref();

// --- Process-level safety nets ---------------------------------------------
process.on("unhandledRejection", (reason) => {
 console.error("Unhandled Rejection:", reason);
 logger.error({ reason }, "unhandledRejection");
});
process.on("uncaughtException", (err) => {
 console.error("Uncaught Exception:", err);
 logger.fatal({ err }, "uncaughtException");
 process.exit(1);
});

// --- Graceful shutdown ------------------------------------------------------
//
// SIGTERM is what Cloud Run / Kubernetes / Docker send on rollout.
// Stop accepting connections, drain in-flight work, then exit.
let shuttingDown = false;
async function shutdown(signal: NodeJS.Signals): Promise<void> {
 if (shuttingDown) return;
 shuttingDown = true;
 logger.info({ signal }, "shutdown initiated");
 // Give the load balancer ~10 s to notice the readiness flip before
 // we slam the connection. Tunable per environment.
  const HARD_DEADLINE_MS = Number(process.env["HARD_DEADLINE_MS"] ?? "15000");
 const killer = setTimeout(() => {
 logger.error("hard shutdown deadline reached — exiting");
 process.exit(1);
 }, HARD_DEADLINE_MS);
 killer.unref();

 httpServer.close((err) => {
 if (err) logger.error({ err }, "httpServer.close failed");
 });

 try {
 await stopWorkers();
 } catch (err) {
 logger.error({ err }, "stopWorkers failed");
 }
 stopPreDebitScheduler();
 stopTrialLifecycleScheduler();
 stopChargeMandateScheduler();
 stopSubscriptionAbandonmentScheduler();
 clearInterval(purgeTimer);
 clearInterval(slotReclaimTimer);
 clearInterval(opsAuditOutboxTimer);
 clearInterval(deletedAccountsPurgeTimer);

 // Drain one final tick of the outbox so override actions taken in
 // the last 500 ms still land in ops_actions before we close pools.
 try {
   await drainOpsAuditOutbox(OPS_AUDIT_DRAIN_BATCH);
 } catch (err) {
   logger.error({ err }, "final drainOpsAuditOutbox failed");
 }

 // Close both pools so we don't leak DB connections on rollout. The
 // override pool is small (default 4) but still counts against the
 // server's max_connections budget.
 try {
   await Promise.all([overridePool.end(), pool.end()]);
 } catch (err) {
   logger.error({ err }, "pool shutdown failed");
 }

 logger.info("shutdown complete");
 process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
