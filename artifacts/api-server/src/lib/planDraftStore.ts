import { and, eq } from "drizzle-orm";
import { db, planDraftsTable, type PlanDraft } from "@workspace/db";
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
