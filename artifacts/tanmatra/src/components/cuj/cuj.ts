// ─────────────────────────────────────────────────────────────────────────────
// Subscription CUJ v2 pure logic (roadmap slice S8, spec 02d). JSX-free and
// unit-testable: the goal-router destination map, the configure-by-exception
// builder defaults (02e §5) that respect each plan's honest track narrowing,
// and the next-weekday start date. No inferred copy here — router answer text
// comes from PLAN_CATALOG.routerAnswer; the escape-hatch label is fixed by 02d.
// ─────────────────────────────────────────────────────────────────────────────

import {
  PLAN_CATALOG,
  ROUTER_ANSWER_TO_PLAN,
  BUILDER_DEFAULTS,
  type PlanId,
  type DietTrack,
} from "@workspace/subscription-rules";

export type RouterDestination =
  | { kind: "plan"; planId: PlanId }
  | { kind: "menu" };

export interface RouterAnswer {
  answer: string;
  destination: RouterDestination;
}

/** The escape hatch (02d §2) — browsers are never trapped in the quiz. */
export const MENU_ESCAPE_ANSWER = "Just show me the food";

/**
 * The router's five answers, in order: the four plan-reachable goals (from
 * PLAN_CATALOG.routerAnswer) plus the menu escape hatch last.
 */
export const ROUTER_ANSWERS: RouterAnswer[] = [
  ...ROUTER_ANSWER_TO_PLAN.map((r) => ({
    answer: r.answer,
    destination: { kind: "plan", planId: r.planId } as RouterDestination,
  })),
  { answer: MENU_ESCAPE_ANSWER, destination: { kind: "menu" } },
];

/** Where a tapped answer routes. Unknown answers fall through to the menu. */
export function routerDestination(answer: string): RouterDestination {
  return (
    ROUTER_ANSWERS.find((a) => a.answer === answer)?.destination ?? {
      kind: "menu",
    }
  );
}

/**
 * The honest default diet track for a plan: 'veg' when the plan serves it, else
 * the first track it DOES serve (steady → nonveg, glp1 → egg). Never returns a
 * track the plan can't fill (02e §2 — narrowing is a §2.6 rule, not a UI knob).
 */
export function defaultTrackForPlan(planId: PlanId): DietTrack {
  const tracks = PLAN_CATALOG[planId].dietTracks;
  return tracks.includes("veg") ? "veg" : tracks[0];
}

export interface BuilderDefaults {
  planId: PlanId;
  duration: "monthly";
  mealsPerDay: number;
  track: DietTrack;
  rdBump: boolean;
}

/**
 * Configure-by-exception defaults (02e §5): everything pre-selected to the
 * honest modal choice so the builder asks the user to APPROVE, not assemble.
 */
export function resolveBuilderDefaults(planId: PlanId): BuilderDefaults {
  return {
    planId,
    duration: "monthly",
    mealsPerDay: BUILDER_DEFAULTS.mealsPerDay,
    track: defaultTrackForPlan(planId),
    rdBump: BUILDER_DEFAULTS.rdBumpPreselected,
  };
}

/**
 * The next weekday on/after the given date (Mon–Fri). Pure — `from` is
 * injectable. Returns a new Date; never mutates the input. Sat → Mon, Sun → Mon.
 */
export function nextWeekday(from: Date): Date {
  const d = new Date(from.getTime());
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay(); // 0 Sun … 6 Sat
  if (day === 6) d.setUTCDate(d.getUTCDate() + 2);
  else if (day === 0) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}
