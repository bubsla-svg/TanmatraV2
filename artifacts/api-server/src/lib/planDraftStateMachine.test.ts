/**
 * Unit tests for the PlanDraft status state machine (PR A2.1). Pure/DB-free.
 *
 * Run with:
 *   node --test --import tsx ./src/lib/planDraftStateMachine.test.ts
 *
 * The route layer (planDrafts.test.ts) only ever offers a client the two
 * CLIENT_SETTABLE_STATUS_VALUES, both of which legally transition to each
 * other — so it can never exercise an illegal transition. This file
 * exercises the full graph directly, including the statuses only the
 * generation/schedule/quote/origination engines (A2.2-A2.4) will ever set.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canTransitionPlanDraftStatus,
  isPlanDraftStatusTerminal,
  CLIENT_SETTABLE_STATUS_VALUES,
} from "./planDraftStateMachine";

test("collecting_preferences and ready_to_generate transition into each other", () => {
  assert.equal(canTransitionPlanDraftStatus("collecting_preferences", "ready_to_generate"), true);
  assert.equal(canTransitionPlanDraftStatus("ready_to_generate", "collecting_preferences"), true);
});

test("a status transitioning to itself is a legal no-op", () => {
  assert.equal(canTransitionPlanDraftStatus("quoted", "quoted"), true);
  assert.equal(canTransitionPlanDraftStatus("converted", "converted"), true);
});

test("collecting_preferences cannot skip straight to a post-generation status", () => {
  assert.equal(canTransitionPlanDraftStatus("collecting_preferences", "lineup_ready"), false);
  assert.equal(canTransitionPlanDraftStatus("collecting_preferences", "quoted"), false);
  assert.equal(canTransitionPlanDraftStatus("collecting_preferences", "converted"), false);
});

test("terminal statuses have no outbound transitions", () => {
  for (const terminal of ["converted", "abandoned", "superseded"] as const) {
    assert.equal(isPlanDraftStatusTerminal(terminal), true);
    for (const target of [
      "collecting_preferences",
      "ready_to_generate",
      "generating",
      "lineup_ready",
      "quoted",
    ] as const) {
      assert.equal(
        canTransitionPlanDraftStatus(terminal, target),
        false,
        `${terminal} -> ${target} must be illegal`,
      );
    }
  }
});

test("a quoted draft may only advance to converted or back to ready_for_quote, or be superseded", () => {
  assert.equal(canTransitionPlanDraftStatus("quoted", "converted"), true);
  assert.equal(canTransitionPlanDraftStatus("quoted", "ready_for_quote"), true);
  assert.equal(canTransitionPlanDraftStatus("quoted", "superseded"), true);
  assert.equal(canTransitionPlanDraftStatus("quoted", "collecting_preferences"), false);
  assert.equal(canTransitionPlanDraftStatus("quoted", "generating"), false);
});

test("every non-terminal status has at least one legal forward transition", () => {
  const nonTerminal = [
    "collecting_preferences",
    "ready_to_generate",
    "generating",
    "generation_failed",
    "lineup_ready",
    "schedule_required",
    "ready_for_quote",
    "quoted",
  ] as const;
  for (const status of nonTerminal) {
    const hasOutbound = [
      "collecting_preferences",
      "ready_to_generate",
      "generating",
      "generation_failed",
      "lineup_ready",
      "schedule_required",
      "ready_for_quote",
      "quoted",
      "superseded",
      "converted",
      "abandoned",
    ].some((to) => to !== status && canTransitionPlanDraftStatus(status, to as never));
    assert.equal(hasOutbound, true, `${status} has no legal outbound transition`);
  }
});

test("CLIENT_SETTABLE_STATUS_VALUES contains only pre-generation statuses", () => {
  assert.deepEqual(
    [...CLIENT_SETTABLE_STATUS_VALUES].sort(),
    ["collecting_preferences", "ready_to_generate"].sort(),
  );
});
