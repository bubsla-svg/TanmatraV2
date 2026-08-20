import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Task #7: Manual-Mode bulkhead. We split the connection budget into
// two named pools so the staff override path can never queue behind
// the auto-dispatcher's long-running transactions:
//
//   - `pool` / `db`         : main pool, ~16 connections, used by
//                             every route except the override path.
//   - `overridePool` /
//     `overrideDb`          : carve-out, 4 connections, used ONLY by
//                             `/delivery/dispatch/override`. Even
//                             when the main pool is fully saturated
//                             by background dispatch work, the
//                             override path always has connections
//                             available.
//
// The two budgets sum to 20, well under typical Postgres connection
// limits. The carve-out is intentionally small — override traffic is
// human-driven and bursty, not high-throughput.
const MAIN_POOL_MAX = Number(process.env.PG_POOL_MAX ?? 16);
const OVERRIDE_POOL_MAX = Number(process.env.PG_OVERRIDE_POOL_MAX ?? 4);

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: MAIN_POOL_MAX,
});
export const db = drizzle(pool, { schema });

export const overridePool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: OVERRIDE_POOL_MAX,
  // Hard ceiling on how long an override request will wait for a
  // connection — well under the 2s SLO for the route as a whole.
  connectionTimeoutMillis: 1_000,
});
export const overrideDb = drizzle(overridePool, { schema });

// node-postgres emits an `error` event on the Pool when an *idle* client
// in the pool errors out (e.g. the backend dropped the connection, a Cloud
// SQL socket blip, or a failover). If nothing is listening, Node escalates
// that EventEmitter `error` into an uncaughtException — which crashes the
// whole process. On Cloud Run that turns a single dropped idle connection
// into a crash loop: the container binds the port (passing the TCP startup
// probe) and is then killed ~seconds later, so every request 503s. Attach a
// no-throw listener so idle-connection failures are logged and the pool can
// transparently re-establish on the next checkout instead of taking down
// the server. (Per-query errors are still surfaced to their callers.)
for (const [name, p] of [
  ["pool", pool],
  ["overridePool", overridePool],
] as const) {
  p.on("error", (err) => {
    console.error(`[db] idle client error on ${name}:`, err);
  });
}

/**
 * Concrete drizzle-pg type for both `db` and `overrideDb` so callers
 * can accept either pool. Inferred from the export to avoid drift if
 * the schema set ever changes.
 */
export type DrizzleDb = typeof db;

/** A point-in-time read of one pg Pool's occupancy. */
export interface PoolSnapshot {
  name: string;
  /** Connections currently open (busy + idle). */
  total: number;
  /** Open and unused. */
  idle: number;
  /** Callers blocked waiting for a connection. Non-zero means the pool is
   *  already the bottleneck — this is the number that matters. */
  waiting: number;
  /** Configured ceiling. */
  max: number;
  /** busy / max, 0..1. */
  utilisation: number;
  /** True once the pool is at its ceiling with callers queued behind it. */
  saturated: boolean;
}

/**
 * Read both pools' occupancy.
 *
 * Nothing in this codebase reported connection-pool state, which made
 * exhaustion invisible: it surfaces as unrelated timeouts scattered across
 * whichever routes happened to ask for a connection, with nothing naming the
 * actual cause. `waiting > 0` names it directly.
 *
 * Cheap enough to call on every health probe — these are plain counters on the
 * Pool object, not a query.
 */
export function poolSnapshots(): PoolSnapshot[] {
  return ([
    ["main", pool, MAIN_POOL_MAX],
    ["override", overridePool, OVERRIDE_POOL_MAX],
  ] as const).map(([name, p, max]) => {
    const total = p.totalCount ?? 0;
    const idle = p.idleCount ?? 0;
    const waiting = p.waitingCount ?? 0;
    const busy = Math.max(0, total - idle);
    return {
      name,
      total,
      idle,
      waiting,
      max,
      // Guard the divide: max comes from an env var and a malformed value
      // must not turn telemetry into NaN or a crash.
      utilisation: max > 0 ? busy / max : 0,
      // Busy-at-ceiling ALONE is not saturation — a pool running full with
      // nobody queued is a pool being used correctly. Saturation is when the
      // ceiling is reached AND callers are blocked behind it.
      saturated: waiting > 0,
    };
  });
}

export * from "./schema";
export * from "./crypto";
export * from "./operationalDate";
export * from "./applyNonDrizzleDdl";
