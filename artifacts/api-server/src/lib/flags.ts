// ─────────────────────────────────────────────────────────────────────────────
// Server feature flags (env-driven). Read at call time (not module load) so
// tests and per-request contexts can toggle without a reimport.
//
// FLAG_PLAN_V2 gates the 02-series commercial rebuild (the corpus 4-plan
// architecture in @workspace/subscription-rules `PLAN_CATALOG`). While OFF —
// the default — every money path behaves exactly as before: the legacy
// cadence/RD-plan model prices and bills. When ON, requests that carry a
// `planId` are priced and gated by the new plan spine. The legacy model is
// removed only at cut-over (roadmap slice S10), never before this flag has
// proven green in staging.
// ─────────────────────────────────────────────────────────────────────────────

function envTrue(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === "1" || v === "true" || v === "on" || v === "yes";
}

/** True when the 02-series 4-plan commercial model is enabled. Default: false. */
export function isPlanV2Enabled(): boolean {
  return envTrue(process.env.FLAG_PLAN_V2);
}

/**
 * Owner containment gate (2026-08-09, docs/MONEY-PATH-VERIFICATION.md §5):
 * while set, POST /subscriptions rejects NEW plan purchases with a typed 503
 * so production plan checkout cannot accept money until the plan money path
 * passes its own controlled verification. Default (unset) = OPEN, so tests,
 * dev and staging are unaffected; production closes it via deploy.yml env.
 * Existing subscriptions are untouched — only the create route is gated.
 */
export function isPlanCheckoutDisabled(): boolean {
  return envTrue(process.env.PLAN_CHECKOUT_DISABLED);
}
