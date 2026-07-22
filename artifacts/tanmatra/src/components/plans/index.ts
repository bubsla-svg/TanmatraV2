// ─────────────────────────────────────────────────────────────────────────────
// 02f §2 plan surfaces (roadmap slice S7) — page-level compositions assembled
// from the S2 primitives. No shared <Card> base (02f §6).
//
// Presentational only: these take server-quoted prices (S4 computePlanQuote) and
// display copy (planDisplay, INFERRED pending Amendment 02) as props. Wiring
// them into routes + the plan-v2 quote fetch is a later slice (the goal router
// and plan page live in S8).
// ─────────────────────────────────────────────────────────────────────────────

export { PlanCard } from "./PlanCard";
export { OrderBump } from "./OrderBump";
export { TrialCard } from "./TrialCard";
export {
  PLAN_DISPLAY,
  planDisplay,
  type PlanDisplay,
  type PlanChip,
} from "./planDisplay";
