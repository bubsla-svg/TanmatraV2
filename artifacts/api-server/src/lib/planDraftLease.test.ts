/**
 * Generation-lease and retention tests (PR A2.2H). Real Postgres.
 *
 * Run with:
 *   node --test --import tsx ./src/lib/planDraftLease.test.ts
 *
 * These drive the store primitives directly rather than through HTTP, because
 * the scenarios they cover — an attempt stalling past its lease, a crashed
 * worker returning after another attempt took over — cannot be expressed as a
 * sequence of API calls. A timing-based approximation would be flaky; taking
 * and expiring leases explicitly is deterministic.
 */

import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db, planDraftsTable, type PlanDraft } from "@workspace/db";
import {
  GENERATION_LEASE_MS,
  acquireGenerationLease,
  casUpdateDraft,
  finalizeGenerationAttempt,
  loadLiveDraft,
  releaseGenerationAttempt,
  sweepExpiredGenerationLeases,
} from "./planDraftStore";
import { runPlanDraftMaintenance } from "./planDraftMaintenanceScheduler";
import { PLAN_DRAFT_TTL_MS } from "./planDraftAuth";

const CREATED: string[] = [];

after(async () => {
  if (CREATED.length > 0) {
    await db.delete(planDraftsTable).where(inArray(planDraftsTable.id, CREATED));
  }
});

async function makeDraft(
  overrides: Partial<typeof planDraftsTable.$inferInsert> = {},
): Promise<PlanDraft> {
  const id = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
  const [row] = await db
    .insert(planDraftsTable)
    .values({
      id,
      journey: "custom",
      status: "ready_to_generate",
      routine: { mealPeriods: ["lunch"], daysPerWeek: 3, deliveryContext: "home" },
      duration: { cycle: "weekly", renewal: "decide_later" },
      expiresAt: new Date(Date.now() + PLAN_DRAFT_TTL_MS),
      ...overrides,
    })
    .returning();
  assert.ok(row);
  CREATED.push(row.id);
  return row;
}

/** Forces a held lease into the past, standing in for "the worker holding it
 *  died / stalled" without waiting out a real timeout. */
async function expireLease(id: string): Promise<void> {
  await db
    .update(planDraftsTable)
    .set({ generationLeaseExpiresAt: new Date(Date.now() - 1000) })
    .where(eq(planDraftsTable.id, id));
}

test("acquiring a lease stamps an attempt id, a start and a bounded expiry", async () => {
  const draft = await makeDraft();
  const lease = await acquireGenerationLease(draft.id, draft, draft.version);

  assert.equal(lease.kind, "acquired");
  if (lease.kind !== "acquired") return;
  assert.equal(lease.reclaimed, false);
  assert.equal(lease.draft.status, "generating");
  assert.equal(lease.draft.generationAttemptId, lease.attemptId);
  assert.ok(lease.draft.generationStartedAt);
  assert.ok(lease.draft.generationLeaseExpiresAt);

  const window =
    lease.draft.generationLeaseExpiresAt!.getTime() -
    lease.draft.generationStartedAt!.getTime();
  assert.equal(window, GENERATION_LEASE_MS, "the lease must be bounded");
});

test("a stale version cannot acquire the lease", async () => {
  const draft = await makeDraft();
  const lease = await acquireGenerationLease(draft.id, draft, draft.version - 1);
  assert.equal(lease.kind, "stale_version");

  const after = await loadLiveDraft(draft.id);
  assert.equal(after?.status, "ready_to_generate", "a lost CAS must not claim");
  assert.equal(after?.generationAttemptId, null);
});

test("an ACTIVE lease cannot be reclaimed — the second caller sees progress", async () => {
  const draft = await makeDraft();
  const first = await acquireGenerationLease(draft.id, draft, draft.version);
  assert.equal(first.kind, "acquired");
  if (first.kind !== "acquired") return;

  const current = await loadLiveDraft(draft.id);
  assert.ok(current);
  const second = await acquireGenerationLease(draft.id, current, current.version);

  assert.equal(second.kind, "in_progress");
  if (second.kind !== "in_progress") return;
  assert.equal(
    second.attemptId,
    first.attemptId,
    "the live attempt keeps ownership",
  );
});

test("an EXPIRED lease can be reclaimed by a new attempt", async () => {
  const draft = await makeDraft();
  const first = await acquireGenerationLease(draft.id, draft, draft.version);
  assert.equal(first.kind, "acquired");
  if (first.kind !== "acquired") return;

  await expireLease(draft.id);
  const stalled = await loadLiveDraft(draft.id);
  assert.ok(stalled);

  const second = await acquireGenerationLease(draft.id, stalled, stalled.version);
  assert.equal(second.kind, "acquired");
  if (second.kind !== "acquired") return;
  assert.equal(second.reclaimed, true);
  assert.notEqual(
    second.attemptId,
    first.attemptId,
    "a reclaim must mint a NEW attempt id",
  );
});

test("only one of two racing reclaimers wins an expired lease", async () => {
  const draft = await makeDraft();
  const first = await acquireGenerationLease(draft.id, draft, draft.version);
  assert.equal(first.kind, "acquired");
  await expireLease(draft.id);

  const stalled = await loadLiveDraft(draft.id);
  assert.ok(stalled);
  // Both reclaimers start from the same stale read — exactly the race.
  const [a, b] = await Promise.all([
    acquireGenerationLease(draft.id, stalled, stalled.version),
    acquireGenerationLease(draft.id, stalled, stalled.version),
  ]);

  const acquired = [a, b].filter((r) => r.kind === "acquired");
  assert.equal(acquired.length, 1, "exactly one reclaimer may win");
});

test("an old worker cannot FINALIZE after being superseded", async () => {
  const draft = await makeDraft();
  const attemptA = await acquireGenerationLease(draft.id, draft, draft.version);
  assert.equal(attemptA.kind, "acquired");
  if (attemptA.kind !== "acquired") return;

  // A stalls; its lease lapses; B takes over.
  await expireLease(draft.id);
  const stalled = await loadLiveDraft(draft.id);
  assert.ok(stalled);
  const attemptB = await acquireGenerationLease(draft.id, stalled, stalled.version);
  assert.equal(attemptB.kind, "acquired");
  if (attemptB.kind !== "acquired") return;

  // A wakes up and tries to persist the lineup it built from stale answers.
  const stolen = await finalizeGenerationAttempt(draft.id, attemptA.attemptId, {
    status: "lineup_ready",
    lineup: [
      {
        deliveryDate: "2026-01-01",
        deliveryWindow: null,
        addressId: null,
        slots: [],
      },
    ],
  });
  assert.equal(stolen, null, "the superseded attempt must be refused");

  const after = await loadLiveDraft(draft.id);
  assert.equal(after?.status, "generating", "B still owns the draft");
  assert.equal(after?.generationAttemptId, attemptB.attemptId);
  assert.equal(after?.lineup, null, "no stale lineup was persisted");
});

test("an old worker cannot RELEASE after being superseded", async () => {
  const draft = await makeDraft();
  const attemptA = await acquireGenerationLease(draft.id, draft, draft.version);
  assert.equal(attemptA.kind, "acquired");
  if (attemptA.kind !== "acquired") return;

  await expireLease(draft.id);
  const stalled = await loadLiveDraft(draft.id);
  assert.ok(stalled);
  const attemptB = await acquireGenerationLease(draft.id, stalled, stalled.version);
  assert.equal(attemptB.kind, "acquired");
  if (attemptB.kind !== "acquired") return;

  const released = await releaseGenerationAttempt(draft.id, attemptA.attemptId, {
    code: "internal_error",
    message: "should not apply",
    details: {},
  });
  assert.equal(released, null, "A must not be able to fail B's generation");

  const after = await loadLiveDraft(draft.id);
  assert.equal(after?.status, "generating");
  assert.equal(after?.generationAttemptId, attemptB.attemptId);
  assert.equal(after?.generationError, null, "B's lease is untouched");
});

test("the NEW worker can complete normally after a reclaim", async () => {
  const draft = await makeDraft();
  const attemptA = await acquireGenerationLease(draft.id, draft, draft.version);
  assert.equal(attemptA.kind, "acquired");
  await expireLease(draft.id);

  const stalled = await loadLiveDraft(draft.id);
  assert.ok(stalled);
  const attemptB = await acquireGenerationLease(draft.id, stalled, stalled.version);
  assert.equal(attemptB.kind, "acquired");
  if (attemptB.kind !== "acquired") return;

  const done = await finalizeGenerationAttempt(draft.id, attemptB.attemptId, {
    status: "lineup_ready",
    lineup: [
      {
        deliveryDate: "2026-02-02",
        deliveryWindow: null,
        addressId: null,
        slots: [],
      },
    ],
  });
  assert.ok(done, "the owning attempt must be able to finish");
  assert.equal(done.status, "lineup_ready");
  assert.equal(done.lineup?.[0]?.deliveryDate, "2026-02-02");
  assert.equal(done.generationAttemptId, null, "finalize clears the lease");
  assert.equal(done.generationLeaseExpiresAt, null);
});

test("finalize succeeds even when the version moved, as long as the attempt still owns it", async () => {
  // The version legitimately advances when a customer edits a preference mid-
  // generation. That must not, on its own, invalidate the owning attempt —
  // ownership is the attempt id, not the version.
  const draft = await makeDraft();
  const lease = await acquireGenerationLease(draft.id, draft, draft.version);
  assert.equal(lease.kind, "acquired");
  if (lease.kind !== "acquired") return;

  const bumped = await casUpdateDraft(draft.id, lease.draft.version, {
    spicePreference: "hot",
  });
  assert.ok(bumped, "a concurrent edit lands");

  const done = await finalizeGenerationAttempt(draft.id, lease.attemptId, {
    status: "lineup_ready",
    lineup: [],
  });
  assert.ok(done, "the owning attempt still owns the draft");
  assert.equal(done.spicePreference, "hot", "the concurrent edit survives");
});

test("the sweeper fails out an expired lease with a retryable reason", async () => {
  const draft = await makeDraft();
  const lease = await acquireGenerationLease(draft.id, draft, draft.version);
  assert.equal(lease.kind, "acquired");
  await expireLease(draft.id);

  const swept = await sweepExpiredGenerationLeases();
  assert.ok(swept.some((d) => d.id === draft.id));

  const after = await loadLiveDraft(draft.id);
  assert.equal(after?.status, "generation_failed");
  assert.equal(after?.generationError?.code, "generation_lease_expired");
  assert.equal(after?.generationAttemptId, null, "the dead lease is cleared");
});

test("the sweeper leaves an ACTIVE lease alone", async () => {
  const draft = await makeDraft();
  const lease = await acquireGenerationLease(draft.id, draft, draft.version);
  assert.equal(lease.kind, "acquired");
  if (lease.kind !== "acquired") return;

  const swept = await sweepExpiredGenerationLeases();
  assert.equal(
    swept.some((d) => d.id === draft.id),
    false,
    "work in flight must never be swept",
  );

  const after = await loadLiveDraft(draft.id);
  assert.equal(after?.status, "generating");
  assert.equal(after?.generationAttemptId, lease.attemptId);
});

test("retention collects an abandoned pre-quote draft", async () => {
  const draft = await makeDraft({
    status: "collecting_preferences",
    expiresAt: new Date(Date.now() - 60_000),
  });

  const result = await runPlanDraftMaintenance();
  assert.ok(result.draftsCollected >= 1);

  const [row] = await db
    .select()
    .from(planDraftsTable)
    .where(eq(planDraftsTable.id, draft.id));
  assert.equal(row, undefined, "an abandoned draft is collected");
});

test("retention NEVER collects a quoted or converted draft", async () => {
  // These are referenced by quotes (A2.3) and orders/subscriptions (A2.4).
  // Deleting one would orphan a record a customer paid against.
  const quoted = await makeDraft({
    status: "quoted",
    expiresAt: new Date(Date.now() - 60_000),
  });
  const converted = await makeDraft({
    status: "converted",
    expiresAt: new Date(Date.now() - 60_000),
  });

  await runPlanDraftMaintenance();

  const rows = await db
    .select({ id: planDraftsTable.id })
    .from(planDraftsTable)
    .where(inArray(planDraftsTable.id, [quoted.id, converted.id]));
  assert.equal(rows.length, 2, "quoted and converted drafts must be retained");
});

test("retention NEVER collects a draft holding a live generation lease", async () => {
  // Expired by TTL but actively being generated: deleting it would destroy work
  // in flight and strand the worker.
  const draft = await makeDraft({ expiresAt: new Date(Date.now() - 60_000) });
  const lease = await acquireGenerationLease(draft.id, draft, draft.version);
  assert.equal(lease.kind, "acquired");

  // The lease acquisition refreshes the TTL, so force it back into the past to
  // isolate the lease guard as the only thing protecting this row.
  await db
    .update(planDraftsTable)
    .set({ expiresAt: new Date(Date.now() - 60_000) })
    .where(eq(planDraftsTable.id, draft.id));

  await runPlanDraftMaintenance();

  const [row] = await db
    .select({ id: planDraftsTable.id })
    .from(planDraftsTable)
    .where(eq(planDraftsTable.id, draft.id));
  assert.ok(row, "a draft with work in flight must survive collection");
});

test("retention keeps a recently superseded draft for audit", async () => {
  const draft = await makeDraft({
    status: "superseded",
    expiresAt: new Date(Date.now() - 60_000),
  });

  await runPlanDraftMaintenance();

  const [row] = await db
    .select({ id: planDraftsTable.id })
    .from(planDraftsTable)
    .where(eq(planDraftsTable.id, draft.id));
  assert.ok(row, "superseded drafts are kept for the audit window");
});
