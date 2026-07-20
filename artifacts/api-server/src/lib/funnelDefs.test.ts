import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FUNNEL_DEFS,
  allFunnelEventNames,
  computeFunnel,
  computeAllFunnels,
  type EventTotals,
} from "./funnelDefs";

function totals(
  entries: Record<string, Partial<EventTotals>>,
): Map<string, EventTotals> {
  return new Map(
    Object.entries(entries).map(([name, t]) => [
      name,
      { events: t.events ?? 0, sessions: t.sessions ?? 0, users: t.users ?? 0 },
    ]),
  );
}

// ── Definition-shape invariants (§8.3 contract) ──────────────────────────────

test("defines exactly the 5 playbook funnels in order", () => {
  assert.deepEqual(
    FUNNEL_DEFS.map((f) => f.id),
    ["f1_discovery", "f2_checkout", "f3_subscribe", "f4_profiling", "f5_trial_sub"],
  );
});

test("every step references at least one snake_case event name", () => {
  for (const def of FUNNEL_DEFS) {
    assert.ok(def.steps.length >= 2, `${def.id} needs >= 2 steps`);
    for (const step of def.steps) {
      assert.ok(step.events.length >= 1, `${def.id}/${step.label} has no events`);
      for (const ev of step.events) {
        // Same contract the POST /events Zod schema enforces at ingest.
        assert.match(ev, /^[a-z0-9_]{2,64}$/, `${def.id}: bad event name ${ev}`);
      }
    }
  }
});

test("F1 entry step is the view_home OR landing_viewed union", () => {
  const f1 = FUNNEL_DEFS[0]!;
  assert.deepEqual(f1.steps[0]!.events, ["view_home", "landing_viewed"]);
});

test("terminal steps are the server-truth money events (A4)", () => {
  const terminalOf = (id: string) => {
    const def = FUNNEL_DEFS.find((f) => f.id === id)!;
    return def.steps[def.steps.length - 1]!.events;
  };
  assert.deepEqual(terminalOf("f2_checkout"), ["order_created"]);
  assert.deepEqual(terminalOf("f3_subscribe"), ["subscription_started"]);
  assert.deepEqual(FUNNEL_DEFS.find((f) => f.id === "f5_trial_sub")!.steps[0]!.events, [
    "trial_started",
  ]);
});

test("allFunnelEventNames deduplicates across funnels", () => {
  const names = allFunnelEventNames();
  assert.equal(new Set(names).size, names.length);
  // add_to_cart appears in both F1 and F4 but must be listed once.
  assert.equal(names.filter((n) => n === "add_to_cart").length, 1);
});

// ── Funnel math ──────────────────────────────────────────────────────────────

test("computes per-step counts, drop-off and conversion", () => {
  const def = FUNNEL_DEFS.find((f) => f.id === "f2_checkout")!;
  const out = computeFunnel(
    def,
    totals({
      checkout_start: { events: 200, sessions: 150, users: 90 },
      checkout_step_completed: { events: 150 },
      payment_attempted: { events: 100 },
      order_created: { events: 80 },
    }),
  );
  assert.deepEqual(
    out.steps.map((s) => s.count),
    [200, 150, 100, 80],
  );
  assert.equal(out.steps[0]!.dropOffPct, null); // first step has no predecessor
  assert.equal(out.steps[0]!.conversionPct, 100);
  assert.equal(out.steps[1]!.dropOffPct, 25); // 200 → 150
  assert.equal(out.steps[2]!.dropOffPct, 33.3); // 150 → 100, rounded to 0.1
  assert.equal(out.steps[3]!.conversionPct, 40); // 80 / 200
  assert.equal(out.overallConversionPct, 40);
  // sessions/users pass through for context columns.
  assert.equal(out.steps[0]!.sessions, 150);
  assert.equal(out.steps[0]!.users, 90);
});

test("union steps sum every member event's totals", () => {
  const def = FUNNEL_DEFS.find((f) => f.id === "f1_discovery")!;
  const out = computeFunnel(
    def,
    totals({
      view_home: { events: 60, sessions: 50 },
      landing_viewed: { events: 40, sessions: 30 },
      view_menu: { events: 70 },
    }),
  );
  assert.equal(out.steps[0]!.count, 100); // 60 + 40
  assert.equal(out.steps[0]!.sessions, 80);
  assert.equal(out.steps[1]!.count, 70);
});

test("returns null percentages (not 0 or NaN) when the entry step is empty", () => {
  const def = FUNNEL_DEFS.find((f) => f.id === "f5_trial_sub")!;
  const out = computeFunnel(def, totals({}));
  assert.equal(out.overallConversionPct, null);
  for (const step of out.steps) {
    assert.equal(step.count, 0);
    assert.equal(step.conversionPct, null);
    assert.equal(step.dropOffPct, null);
  }
});

test("a mid-funnel zero step yields 100% drop and null drop after it", () => {
  const def = FUNNEL_DEFS.find((f) => f.id === "f5_trial_sub")!;
  const out = computeFunnel(
    def,
    totals({ trial_started: { events: 10 }, trial_converted: { events: 3 } }),
  );
  assert.equal(out.steps[1]!.count, 0); // trial_recap_viewed missing
  assert.equal(out.steps[1]!.dropOffPct, 100);
  // Previous step is 0 → drop-off undefined rather than division by zero.
  assert.equal(out.steps[2]!.dropOffPct, null);
  assert.equal(out.steps[2]!.conversionPct, 30);
});

test("drop-off is clamped at 0 when a later step exceeds the previous one", () => {
  // Possible with rollup counting: e.g. many pdp_viewed per view_menu.
  const def = FUNNEL_DEFS.find((f) => f.id === "f1_discovery")!;
  const out = computeFunnel(
    def,
    totals({
      view_home: { events: 10 },
      view_menu: { events: 25 },
    }),
  );
  assert.equal(out.steps[1]!.dropOffPct, 0);
  assert.equal(out.steps[1]!.conversionPct, 250);
});

test("computeAllFunnels returns one computed funnel per definition", () => {
  const out = computeAllFunnels(totals({}));
  assert.equal(out.length, FUNNEL_DEFS.length);
  assert.deepEqual(
    out.map((f) => f.id),
    FUNNEL_DEFS.map((f) => f.id),
  );
});
