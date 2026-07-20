import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";

// Nightly funnel_events → funnel_daily rollup (playbook Part 8, A1).
//
// Mirrors the analyticsScheduler pattern: a plain interval timer with a
// delayed first tick, env-gated off via FUNNEL_ROLLUP_DISABLED=1, interval
// override via FUNNEL_ROLLUP_INTERVAL_MS. Idempotency is per (day, name):
// each tick recomputes the last FUNNEL_ROLLUP_LOOKBACK_DAYS days (default 3,
// so late beacons and the in-progress day are re-aggregated) and upserts on
// the unique (day, name) index — running twice in one day is safe.
const DEFAULT_INTERVAL_MS = Number(
  process.env["FUNNEL_ROLLUP_INTERVAL_MS"] ?? 24 * 60 * 60 * 1000,
);
const LOOKBACK_DAYS = clampLookback(
  Number(process.env["FUNNEL_ROLLUP_LOOKBACK_DAYS"] ?? 3),
);

function clampLookback(n: number): number {
  if (!Number.isFinite(n)) return 3;
  return Math.min(90, Math.max(1, Math.floor(n)));
}

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

/**
 * Recompute per-day per-event aggregates for the trailing window and upsert
 * them into funnel_daily. Day boundaries are UTC (matching the loyalty
 * sweep's day-key convention). distinct counts ignore NULL session/user ids
 * (count(distinct ...) skips NULLs), so server-emitted events contribute to
 * event_count only.
 */
export async function runFunnelRollup(
  lookbackDays: number = LOOKBACK_DAYS,
): Promise<{ daysUpserted: number }> {
  const days = clampLookback(lookbackDays);
  // Window start: midnight UTC, (days - 1) days ago — interpreted back as a
  // timestamptz IN UTC so the comparison is exact regardless of the server's
  // TimeZone setting.
  const result = await db.execute(
    sql`insert into funnel_daily (day, name, event_count, distinct_sessions, distinct_users)
        select (created_at at time zone 'utc')::date as day,
               name,
               count(*)::int as event_count,
               count(distinct session_id)::int as distinct_sessions,
               count(distinct user_id)::int as distinct_users
        from funnel_events
        where created_at >= (((now() at time zone 'utc')::date - (${days - 1} * interval '1 day')) at time zone 'utc')
        group by 1, 2
        on conflict (day, name) do update set
          event_count = excluded.event_count,
          distinct_sessions = excluded.distinct_sessions,
          distinct_users = excluded.distinct_users,
          updated_at = now()`,
  );
  return { daysUpserted: result.rowCount ?? 0 };
}

async function tick(): Promise<void> {
  if (running) return;
  running = true;
  const start = Date.now();
  try {
    const out = await runFunnelRollup();
    logger.info(
      { ...out, lookbackDays: LOOKBACK_DAYS, durationMs: Date.now() - start },
      "funnel rollup tick complete",
    );
  } catch (err) {
    logger.error({ err }, "funnel rollup tick failed");
  } finally {
    running = false;
  }
}

export function startFunnelRollupScheduler(intervalMs = DEFAULT_INTERVAL_MS): void {
  if (timer) return;
  if (process.env["FUNNEL_ROLLUP_DISABLED"] === "1") {
    logger.info("funnel rollup scheduler disabled via env");
    return;
  }
  // Delay the first tick so boot isn't slammed; the 3-day lookback means a
  // restart never leaves a gap.
  setTimeout(() => void tick(), 120_000);
  timer = setInterval(() => void tick(), intervalMs);
  if (typeof timer.unref === "function") timer.unref();
  logger.info({ intervalMs, lookbackDays: LOOKBACK_DAYS }, "funnel rollup scheduler started");
}

export function stopFunnelRollupScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
