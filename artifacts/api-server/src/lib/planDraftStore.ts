import { randomUUID } from "node:crypto";
import { and, eq, lte, sql } from "drizzle-orm";
import {
  db,
  planDraftsTable,
  type PlanDraft,
  type PlanDraftGenerationFailure,
} from "@workspace/db";
import { PLAN_DRAFT_TTL_MS } from "./planDraftAuth";

// ─────────────────────────────────────────────────────────────────────────────
// Shared PlanDraft persistence helpers.
//
// Extracted in A2.2 because the generation/lineup router needs the exact same
// expire-on-read and compare-and-swap semantics A2.1's routes/planDrafts.ts
// already established. Two copies of an optimistic-concurrency guard is how
// they drift, so both routers now call these.
// ─────────────────────────────────────────────────────────────────────────────

/** Loads a draft, treating an expired-but-not-yet-purged row as absent —
 *  mirrors getSession()'s expire-on-read handling of sessionsTable. */
export async function loadLiveDraft(id: string): Promise<PlanDraft | null> {
  if (!id) return null;
  const [row] = await db
    .select()
    .from(planDraftsTable)
    .where(eq(planDraftsTable.id, id));
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    await db.delete(planDraftsTable).where(eq(planDraftsTable.id, id));
    return null;
  }
  return row;
}

/**
 * Compare-and-swap update. Applies `patch` only if the row is still at
 * `expectedVersion`, bumping the version and refreshing the TTL. Returns null
 * when the row moved on underneath us — callers report that as 409
 * `stale_version` rather than silently overwriting a concurrent edit.
 */
export async function casUpdateDraft(
  id: string,
  expectedVersion: number,
  patch: Partial<typeof planDraftsTable.$inferInsert>,
): Promise<PlanDraft | null> {
  const [row] = await db
    .update(planDraftsTable)
    .set({
      ...patch,
      version: expectedVersion + 1,
      expiresAt: new Date(Date.now() + PLAN_DRAFT_TTL_MS),
    })
    .where(
      and(
        eq(planDraftsTable.id, id),
        eq(planDraftsTable.version, expectedVersion),
      ),
    )
    .returning();
  return row ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Generation leases (A2.2H).
//
// A2.2a made the generation claim releasable by guarding on
// `status = 'generating'`. That fixed stranding but left the claim ANONYMOUS:
// any holder of the status could release or finalize it, so a worker that
// stalled past its own usefulness — or crashed and came back — could still
// overwrite a newer attempt's result, and a crashed worker left the row
// unreachable until a human intervened.
//
// A lease makes the claim attempt-owned and time-bounded:
//   • acquire   — takes the lease under a version CAS, stamping a fresh
//                 attempt id and an expiry.
//   • reclaim   — takes it from an attempt whose lease has lapsed, atomically,
//                 so only one reclaimer can win.
//   • finalize  — writes the lineup, guarded on "still my attempt".
//   • release   — records a failure, guarded on "still my attempt".
//
// The invariant every one of these enforces: attempt A can complete or release
// only attempt A's claim, and can never touch attempt B's newer one.
// ─────────────────────────────────────────────────────────────────────────────

/** How long an attempt owns generation before another may take over.
 *  Generation is currently synchronous and sub-second; this is sized for a
 *  pathologically slow request, not for the normal case. */
export const GENERATION_LEASE_MS = 60_000;

export function newGenerationAttemptId(): string {
  return randomUUID();
}

export type GenerationLease =
  /** This caller now owns generation and must finalize or release it. */
  | { kind: "acquired"; draft: PlanDraft; attemptId: string; reclaimed: boolean }
  /** Another attempt holds a live lease. Not an error — report progress. */
  | { kind: "in_progress"; draft: PlanDraft; attemptId: string | null }
  /** The version CAS lost: the draft moved on before we could claim it. */
  | { kind: "stale_version" };

function leaseFields(attemptId: string, now: Date) {
  return {
    status: "generating" as const,
    generationAttemptId: attemptId,
    generationStartedAt: now,
    generationLeaseExpiresAt: new Date(now.getTime() + GENERATION_LEASE_MS),
    generationError: null,
  };
}

/**
 * Take the generation lease for `id`.
 *
 * `draft` is the caller's already-loaded row, used only to decide which path to
 * take; every path re-guards in SQL, so a stale read can never win a race.
 */
export async function acquireGenerationLease(
  id: string,
  draft: PlanDraft,
  expectedVersion: number,
): Promise<GenerationLease> {
  const now = new Date();
  const attemptId = newGenerationAttemptId();

  if (draft.status === "generating") {
    const expiresAt = draft.generationLeaseExpiresAt;
    if (expiresAt && expiresAt.getTime() > now.getTime()) {
      return {
        kind: "in_progress",
        draft,
        attemptId: draft.generationAttemptId,
      };
    }
    // The lease lapsed. Reclaim it, guarded on the expiry still being in the
    // past AT WRITE TIME — two concurrent reclaimers race here and exactly one
    // wins, because the winner pushes the expiry into the future.
    const [reclaimed] = await db
      .update(planDraftsTable)
      .set({
        ...leaseFields(attemptId, now),
        version: sql`${planDraftsTable.version} + 1`,
        expiresAt: new Date(now.getTime() + PLAN_DRAFT_TTL_MS),
      })
      .where(
        and(
          eq(planDraftsTable.id, id),
          eq(planDraftsTable.status, "generating"),
          lte(planDraftsTable.generationLeaseExpiresAt, now),
        ),
      )
      .returning();
    if (!reclaimed) {
      // Someone else reclaimed first; their lease is live now.
      const current = await loadLiveDraft(id);
      return {
        kind: "in_progress",
        draft: current ?? draft,
        attemptId: current?.generationAttemptId ?? null,
      };
    }
    return { kind: "acquired", draft: reclaimed, attemptId, reclaimed: true };
  }

  const claimed = await casUpdateDraft(id, expectedVersion, leaseFields(attemptId, now));
  if (!claimed) return { kind: "stale_version" };
  return { kind: "acquired", draft: claimed, attemptId, reclaimed: false };
}

/** Clears the lease columns. Every terminal lease write goes through this so a
 *  released draft never keeps a dangling attempt id. */
const CLEARED_LEASE = {
  generationAttemptId: null,
  generationStartedAt: null,
  generationLeaseExpiresAt: null,
};

/**
 * Persist a completed generation, but ONLY if this attempt still holds the
 * lease. An attempt that stalled past its expiry and was superseded loses here
 * rather than overwriting the newer attempt's lineup.
 */
export async function finalizeGenerationAttempt(
  id: string,
  attemptId: string,
  patch: Partial<typeof planDraftsTable.$inferInsert>,
): Promise<PlanDraft | null> {
  const [row] = await db
    .update(planDraftsTable)
    .set({
      ...patch,
      ...CLEARED_LEASE,
      version: sql`${planDraftsTable.version} + 1`,
      expiresAt: new Date(Date.now() + PLAN_DRAFT_TTL_MS),
    })
    .where(
      and(
        eq(planDraftsTable.id, id),
        eq(planDraftsTable.status, "generating"),
        eq(planDraftsTable.generationAttemptId, attemptId),
      ),
    )
    .returning();
  return row ?? null;
}

/**
 * Move a draft out of `generating` and into `generation_failed`, guarded on
 * BOTH the status and the owning attempt.
 *
 * Deliberately not a version CAS: the version may legitimately have moved while
 * this attempt was generating (that is exactly the concurrent-edit case), so
 * re-guarding on it would fail and re-strand the row. The attempt id is the
 * right guard — it releases precisely the claim this attempt took, and refuses
 * if a newer attempt has since taken over.
 *
 * The version is incremented DB-side so this never rewinds a concurrent
 * writer's counter.
 */
export async function releaseGenerationAttempt(
  id: string,
  attemptId: string,
  failure: PlanDraftGenerationFailure,
): Promise<PlanDraft | null> {
  const [row] = await db
    .update(planDraftsTable)
    .set({
      status: "generation_failed",
      generationError: failure,
      ...CLEARED_LEASE,
      version: sql`${planDraftsTable.version} + 1`,
    })
    .where(
      and(
        eq(planDraftsTable.id, id),
        eq(planDraftsTable.status, "generating"),
        eq(planDraftsTable.generationAttemptId, attemptId),
      ),
    )
    .returning();
  return row ?? null;
}

/**
 * Sweep leases whose owning attempt stopped reporting — the crash case A2.2's
 * status doc left open. Moves them to `generation_failed` with a retryable
 * reason (the state machine already allows generating → generation_failed), so
 * the customer sees why and can retry rather than facing a dead draft.
 *
 * Chosen over `generating → ready_to_generate` deliberately: silently rewinding
 * to "ready" hides that anything went wrong, and the customer would be left
 * wondering why their plan never appeared.
 */
export async function sweepExpiredGenerationLeases(
  now: Date = new Date(),
): Promise<PlanDraft[]> {
  return db
    .update(planDraftsTable)
    .set({
      status: "generation_failed",
      generationError: {
        code: "generation_lease_expired",
        message:
          "Building your plan timed out before it finished. Please try again.",
        details: {},
      },
      ...CLEARED_LEASE,
      version: sql`${planDraftsTable.version} + 1`,
    })
    .where(
      and(
        eq(planDraftsTable.status, "generating"),
        lte(planDraftsTable.generationLeaseExpiresAt, now),
      ),
    )
    .returning();
}
