import type { PlanDraftStatus } from "@workspace/db";

// ─────────────────────────────────────────────────────────────────────────────
// PlanDraft status state machine (PR A2.1). The rebuild spec calls for
// "shared state machines and server-authoritative contracts" rather than a
// client that can set any status string it likes — this is the enforcement
// point for that requirement.
//
// A2.1 only builds the domain/persistence layer, so only the first two
// statuses are reachable via a client PATCH today. Every status from
// "generating" onward belongs to an engine that doesn't exist yet
// (generation = A2.2, delivery/quote = A2.3, origination = A2.4); the table
// below documents the FULL intended graph so those PRs extend it rather than
// re-deriving it, but CLIENT_SETTABLE_STATUSES is what routes/planDrafts.ts
// actually allows a caller to request right now.
// ─────────────────────────────────────────────────────────────────────────────

const TRANSITIONS: Record<PlanDraftStatus, readonly PlanDraftStatus[]> = {
  collecting_preferences: ["ready_to_generate"],
  ready_to_generate: ["collecting_preferences", "generating"],
  generating: ["lineup_ready", "generation_failed"],
  generation_failed: ["collecting_preferences", "ready_to_generate"],
  lineup_ready: ["schedule_required", "collecting_preferences"],
  schedule_required: ["ready_for_quote", "lineup_ready"],
  ready_for_quote: ["quoted", "schedule_required"],
  quoted: ["converted", "ready_for_quote", "superseded"],
  superseded: [],
  converted: [],
  abandoned: [],
};

/** Statuses a client PATCH may request directly. Every later status is
 *  written only by the generation/schedule/quote/origination engines.
 *  Kept as a `const` tuple (not just `readonly PlanDraftStatus[]`) so
 *  `z.enum(CLIENT_SETTABLE_STATUS_VALUES)` can use it directly. */
export const CLIENT_SETTABLE_STATUS_VALUES = [
  "collecting_preferences",
  "ready_to_generate",
] as const satisfies readonly PlanDraftStatus[];

export const CLIENT_SETTABLE_STATUSES: readonly PlanDraftStatus[] =
  CLIENT_SETTABLE_STATUS_VALUES;

/** `from === to` is treated as a legal no-op so a retried PATCH with an
 *  unchanged status doesn't 409. */
export function canTransitionPlanDraftStatus(
  from: PlanDraftStatus,
  to: PlanDraftStatus,
): boolean {
  if (from === to) return true;
  return TRANSITIONS[from].includes(to);
}

export function isPlanDraftStatusTerminal(status: PlanDraftStatus): boolean {
  return (
    status === "converted" ||
    status === "abandoned" ||
    status === "superseded"
  );
}
