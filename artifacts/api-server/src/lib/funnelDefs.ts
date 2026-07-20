// Named funnel definitions — playbook Part 8 §8.3 (A2).
//
// Each funnel is an ordered list of steps; each step matches one or MORE
// event names (a union — e.g. F1's entry step is view_home OR
// landing_viewed). Steps that the playbook expresses with a per-step `step`
// property (checkout steps 1–3, subscribe steps 0–6, quiz steps 1–6) are
// modelled here at event-name granularity, because the funnel_daily rollup
// aggregates by name only; per-`step` breakdowns stay answerable ad hoc via
// safe_funnel_events.
//
// Counting basis: `events` (sum of event_count) is the primary number used
// for drop-off math. Server-truth money events (order_created,
// payment_succeeded, subscription_started, trial_started — A4) carry no
// session_id, so session-based counting would zero out the terminal steps.
// sessions/users are still reported per step as directional context.
// This module is pure (no DB imports) so it is unit-testable with node:test.

export interface FunnelStepDef {
  /** Human label shown in the AdminAnalytics Funnels tab. */
  label: string;
  /** Event names whose counts are summed into this step (union). */
  events: string[];
}

export interface FunnelDef {
  id: string;
  name: string;
  /** Primary KPI phrasing from §8.3. */
  kpi: string;
  steps: FunnelStepDef[];
}

export const FUNNEL_DEFS: FunnelDef[] = [
  {
    id: "f1_discovery",
    name: "F1 Discovery",
    kpi: "Visit → cart %",
    steps: [
      { label: "Visit (home / landing)", events: ["view_home", "landing_viewed"] },
      { label: "Menu viewed", events: ["view_menu"] },
      { label: "Dish viewed", events: ["pdp_viewed"] },
      { label: "Added to cart", events: ["add_to_cart"] },
    ],
  },
  {
    id: "f2_checkout",
    name: "F2 Checkout",
    kpi: "Cart → paid %",
    steps: [
      { label: "Checkout started", events: ["checkout_start"] },
      { label: "Checkout step completed", events: ["checkout_step_completed"] },
      { label: "Payment attempted", events: ["payment_attempted"] },
      { label: "Order created", events: ["order_created"] },
    ],
  },
  {
    id: "f3_subscribe",
    name: "F3 Subscribe",
    kpi: "Step 0 → paid %",
    steps: [
      { label: "Wizard step viewed", events: ["subscribe_step_viewed"] },
      { label: "Wizard step completed", events: ["subscribe_step_completed"] },
      { label: "Subscription started", events: ["subscription_started"] },
    ],
  },
  {
    id: "f4_profiling",
    name: "F4 Profiling",
    kpi: "Quiz → cart lift",
    steps: [
      { label: "Soft gate shown", events: ["softgate_shown"] },
      { label: "Quiz opened", events: ["quiz_opened"] },
      { label: "Quiz step completed", events: ["quiz_step_completed"] },
      { label: "Quiz completed", events: ["quiz_completed"] },
      { label: "Added to cart", events: ["add_to_cart"] },
    ],
  },
  {
    id: "f5_trial_sub",
    name: "F5 Trial → Sub",
    kpi: "Trial conversion %",
    steps: [
      { label: "Trial started", events: ["trial_started"] },
      { label: "Trial recap viewed", events: ["trial_recap_viewed"] },
      { label: "Trial converted", events: ["trial_converted"] },
    ],
  },
];

/** Every event name referenced by any funnel step (deduplicated). */
export function allFunnelEventNames(defs: FunnelDef[] = FUNNEL_DEFS): string[] {
  const names = new Set<string>();
  for (const def of defs) {
    for (const step of def.steps) {
      for (const ev of step.events) names.add(ev);
    }
  }
  return [...names];
}

export interface EventTotals {
  events: number;
  sessions: number;
  users: number;
}

export interface ComputedFunnelStep extends FunnelStepDef {
  count: number;
  sessions: number;
  users: number;
  /** % lost vs the previous step (null on the first step or when prev is 0). */
  dropOffPct: number | null;
  /** % of the first step's count that reached this step (null when entry is 0). */
  conversionPct: number | null;
}

export interface ComputedFunnel {
  id: string;
  name: string;
  kpi: string;
  steps: ComputedFunnelStep[];
  /** Entry → final-step conversion (null when the entry step has 0 events). */
  overallConversionPct: number | null;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Pure funnel math over pre-aggregated per-event totals (from funnel_daily).
 * Abandonment for step N = step N-1 count − step N count (paired-event
 * model, §8.3); percentages are null (not 0) when the denominator is 0 so
 * the UI can render "—" instead of a misleading 0%.
 */
export function computeFunnel(
  def: FunnelDef,
  totalsByEvent: ReadonlyMap<string, EventTotals>,
): ComputedFunnel {
  const steps: ComputedFunnelStep[] = def.steps.map((stepDef) => {
    let count = 0;
    let sessions = 0;
    let users = 0;
    for (const ev of stepDef.events) {
      const t = totalsByEvent.get(ev);
      if (!t) continue;
      count += t.events;
      sessions += t.sessions;
      users += t.users;
    }
    return {
      ...stepDef,
      count,
      sessions,
      users,
      dropOffPct: null,
      conversionPct: null,
    };
  });

  const entry = steps[0]?.count ?? 0;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    if (entry > 0) {
      step.conversionPct = round1((step.count / entry) * 100);
    }
    if (i > 0) {
      const prev = steps[i - 1]!.count;
      if (prev > 0) {
        step.dropOffPct = round1(Math.max(0, ((prev - step.count) / prev) * 100));
      }
    }
  }

  const last = steps[steps.length - 1];
  return {
    id: def.id,
    name: def.name,
    kpi: def.kpi,
    steps,
    overallConversionPct:
      entry > 0 && last ? round1((last.count / entry) * 100) : null,
  };
}

export function computeAllFunnels(
  totalsByEvent: ReadonlyMap<string, EventTotals>,
  defs: FunnelDef[] = FUNNEL_DEFS,
): ComputedFunnel[] {
  return defs.map((def) => computeFunnel(def, totalsByEvent));
}
