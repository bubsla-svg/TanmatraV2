import { and, eq, sql } from "drizzle-orm";
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

/**
 * Move a draft out of `generating` and into `generation_failed`, guarded on
 * the STATUS rather than the version.
 *
 * This is the one write in the PlanDraft surface that must not be a version
 * CAS. `generating` is a status no client transition can leave, so if the
 * generate route's final write loses its version CAS — which an ordinary
 * concurrent PATCH from a second tab is enough to cause — the row would sit in
 * `generating` forever with no way for the customer to retry. The version has
 * legitimately moved on in that case, so guarding on it again would fail for
 * the same reason; guarding on `status = 'generating'` is correct because only
 * this route's own claim could have put it there, and it releases exactly the
 * claim we took.
 *
 * The version is bumped with a DB-side increment so this never rolls a
 * concurrent writer's counter backwards.
 */
export async function releaseGeneratingClaim(
  id: string,
  failure: PlanDraftGenerationFailure,
): Promise<PlanDraft | null> {
  const [row] = await db
    .update(planDraftsTable)
    .set({
      status: "generation_failed",
      generationError: failure,
      version: sql`${planDraftsTable.version} + 1`,
    })
    .where(
      and(
        eq(planDraftsTable.id, id),
        eq(planDraftsTable.status, "generating"),
      ),
    )
    .returning();
  return row ?? null;
}
