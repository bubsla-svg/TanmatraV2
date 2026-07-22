// ─────────────────────────────────────────────────────────────────────────────
// Subscription CUJ v2 (roadmap slice S8, spec 02d) — goal router + configure-
// by-exception builder, consuming the S4 plan-v2 quote and the S7 primitives.
//
// Presentational + a data hook; not yet mounted as routes (that lands with the
// FLAG_PLAN_V2 cut-over so the SSR/prerender money-path gates stay green).
// Funnel events use the cuj_* vocabulary (02d §9) added to lib/analytics.
// ─────────────────────────────────────────────────────────────────────────────

export { GoalRouter } from "./GoalRouter";
export { PlanBuilder } from "./PlanBuilder";
export { usePlanQuote } from "./usePlanQuote";
export type { PlanQuoteResult, PlanQuoteData, PlanWaitlist } from "./usePlanQuote";
export {
  ROUTER_ANSWERS,
  MENU_ESCAPE_ANSWER,
  routerDestination,
  defaultTrackForPlan,
  resolveBuilderDefaults,
  nextWeekday,
  type RouterDestination,
  type RouterAnswer,
  type BuilderDefaults,
} from "./cuj";
