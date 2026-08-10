/**
 * PlanDraft maintenance sweep (A2.2H).
 *
 * Two jobs, one timer, because both are cheap table scans over `plan_drafts`
 * and neither is worth its own tick:
 *
 * 1. STALE GENERATION LEASES. `status = 'generating'` is a state no client
 *    transition can leave. Every in-process failure path releases its own
 *    attempt (see planDraftStore), but a worker that is killed mid-generation
 *    never runs that code, so its lease just sits there. This sweep ages those
 *    leases out into `generation_failed` with a retryable reason — the crash
 *    case A2.2's status doc recorded as open.
 *
 * 2. ABANDONED GUEST DRAFTS. `POST /plan-drafts` is unauthenticated and writes
 *    a row per call. Without a retention policy that table only ever grows.
 *
 * WHAT THIS SWEEP MUST NEVER DELETE — the whole reason it filters rather than
 * blanket-deleting on `expiresAt`:
 *   • a draft holding a LIVE generation lease (work is in flight);
 *   • a `quoted` draft (a QuoteSnapshot may reference it — A2.3);
 *   • a `converted` draft (an order/subscription references it — A2.4);
 *   • a `superseded` draft inside the audit window (it explains why a customer's
 *     earlier configuration stopped being the live one).
 * Only genuinely abandoned pre-quote drafts are removed. A2.3 and A2.4 add the
 * referencing rows; the status filter here is what keeps this sweep correct
 * once they exist, rather than something to remember to revisit.
 */

import { and, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { db, planDraftsTable, type PlanDraftStatus } from "@workspace/db";
import { logger } from "./logger";
import { sweepExpiredGenerationLeases } from "./planDraftStore";

/** Statuses that are safe to delete once abandoned: nothing downstream can
 *  reference a draft that never reached a quote. */
const COLLECTABLE_STATUSES: PlanDraftStatus[] = [
  "collecting_preferences",
  "ready_to_generate",
  "generation_failed",
  "lineup_ready",
  "schedule_required",
  "ready_for_quote",
  "abandoned",
];

/** How long a superseded draft is kept for audit before collection. It answers
 *  "why did my earlier plan disappear?", which is worth keeping past the
 *  draft's own TTL. */
export const DEFAULT_SUPERSEDED_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SUPERSEDED_RETENTION_MS = Number(
  process.env["PLAN_DRAFT_SUPERSEDED_RETENTION_MS"] ?? DEFAULT_SUPERSEDED_RETENTION_MS,
);

const DEFAULT_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const INTERVAL_MS = Number(
  process.env["PLAN_DRAFT_SWEEP_INTERVAL_MS"] ?? DEFAULT_INTERVAL_MS,
);

export interface PlanDraftMaintenanceResult {
  /** Drafts whose generation lease had lapsed and were failed out. */
  leasesExpired: number;
  /** Abandoned pre-quote drafts deleted. */
  draftsCollected: number;
}

export async function runPlanDraftMaintenance(
  now: Date = new Date(),
): Promise<PlanDraftMaintenanceResult> {
  // Order matters: expire leases FIRST, so a draft whose worker died is moved
  // to generation_failed and becomes collectable in the same tick rather than
  // waiting a full interval.
  const expired = await sweepExpiredGenerationLeases(now);

  const supersededCutoff = new Date(now.getTime() - SUPERSEDED_RETENTION_MS);
  const collected = await db
    .delete(planDraftsTable)
    .where(
      and(
        // Never touch a draft with a live lease, whatever its expiresAt says.
        or(
          isNull(planDraftsTable.generationLeaseExpiresAt),
          lte(planDraftsTable.generationLeaseExpiresAt, now),
        ),
        or(
          and(
            inArray(planDraftsTable.status, COLLECTABLE_STATUSES),
            lte(planDraftsTable.expiresAt, now),
          ),
          and(
            eq(planDraftsTable.status, "superseded"),
            lte(planDraftsTable.updatedAt, supersededCutoff),
          ),
        ),
      ),
    )
    .returning({ id: planDraftsTable.id });

  if (expired.length > 0 || collected.length > 0) {
    logger.info(
      {
        leasesExpired: expired.length,
        draftsCollected: collected.length,
        supersededRetentionMs: SUPERSEDED_RETENTION_MS,
      },
      "plan-draft maintenance: tick complete",
    );
  }

  return { leasesExpired: expired.length, draftsCollected: collected.length };
}

/**
 * How many live drafts one guest/customer already holds. Used by
 * `POST /plan-drafts` to refuse unbounded creation from a single caller — the
 * per-IP rate limit throttles the RATE of creation, this bounds the STOCK.
 */
export async function countLiveDraftsForUser(
  userId: string,
  now: Date = new Date(),
): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(planDraftsTable)
    .where(
      and(
        eq(planDraftsTable.userId, userId),
        gt(planDraftsTable.expiresAt, now),
        inArray(planDraftsTable.status, COLLECTABLE_STATUSES),
      ),
    );
  return row?.count ?? 0;
}

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await runPlanDraftMaintenance();
  } catch (err) {
    logger.error({ err }, "plan-draft maintenance tick failed");
  } finally {
    running = false;
  }
}

export function startPlanDraftMaintenanceScheduler(): void {
  if (timer) return;
  const initialTimer = setTimeout(() => void tick(), 60_000);
  if (typeof initialTimer.unref === "function") initialTimer.unref();
  timer = setInterval(() => void tick(), INTERVAL_MS);
  if (typeof timer.unref === "function") timer.unref();
  logger.info({ intervalMs: INTERVAL_MS }, "plan-draft maintenance scheduler started");
}

export function stopPlanDraftMaintenanceScheduler(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
