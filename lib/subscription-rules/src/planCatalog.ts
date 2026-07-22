// ─────────────────────────────────────────────────────────────────────────────
// Plan catalog — the corpus 02e plan-configuration spine (PURE, DB-free).
//
// This is the authoritative source for plan *configuration values* (ids, prices
// in paise, cycle shape, diet tracks, pool queries, RD gates, add-ons, trial
// credit math), transcribed from docs/spec/tanmatra-plan-config-02e.md. Every
// number here has a §-citation to that file. Dish *prices* are NOT hardcoded —
// plans reference SKU pools and the server prices them (IMP §10.1); pool
// membership is computed from the live catalog by the predicates below.
//
// STATUS: this layer supersedes the legacy cadence model (pricing.ts) and the
// 8 condition-named RD plans (web rdPlans.ts) per the "replace the live model"
// decision (2026-07-22). It is introduced additively first; the quote/create
// routes and web surfaces are re-pointed at it in subsequent slices (see
// IMPLEMENTATION-PLAN.md). Nothing here bills money on its own.
//
// INFERRED-VALUE FLAGS (per the "proceed on existing tokens" decision, because
// IMPECCABLE.md / Amendment 02 / 02a are not yet in the repo):
//   • Pool queries run against whatever macro set the caller passes. The
//     customer-facing app consumes the DISHES overlay (estimated macros for
//     105/117 SKUs); raw seed macros give different counts. Pass DISHES.
//   • 02e §3.2 writes the RD gate as `rdReviewState = 'signed'`; the repo enum
//     is `'pending_review' | 'reviewed' | 'blocked'` with absence = reviewed
//     (legacy curated catalog). We map corpus-'signed' → repo-'reviewed'.
//   • glp1_companion's "60 meals + 30 snacks" cycle and ₹5,999-intro/₹6,999
//     flat pricing are captured as far as the 02e §1 schema allows; the snack
//     sub-cycle is noted, not modelled, pending Amendment 02.
// ─────────────────────────────────────────────────────────────────────────────

import type { DishData } from "@workspace/menu-catalog";
import { GST_RATE } from "./pricing.js";

/** 02e §1. */
export type PlanId =
  | "desk_fuel"
  | "steady"
  | "glp1_companion"
  | "protein_build"
  | "teams"
  | "trial_3day";

/** Diet tracks a plan can actually serve. Deliberately narrowed to what the
 *  kitchen can fill — never widen in code to make a UI look symmetrical
 *  (02e §2: a track that can't be filled is a §2.6 violation → refund). */
export type DietTrack = "veg" | "egg" | "nonveg";

export type PlanCycle = "weekly" | "monthly" | "one_off";
export type PlanSlot = "lunch" | "dinner" | "snack";
export type AddOnId = "rd_bump" | "evening_add";

/** Publish/launch status (02e §2 status row). */
export type PlanStatus = "live" | "blocked_pending_skus" | "sales_led";

/** A pool query kind (02e §3). The predicate lives in POOL_PREDICATES. */
export type PoolQueryId =
  | "desk_fuel"
  | "steady"
  | "glp1_meal"
  | "glp1_snack"
  | "protein_build"
  | "trial_fixed";

export interface PlanConfig {
  id: PlanId;
  /** 02d §2 router answer; null = not router-reachable. */
  routerAnswer: string | null;
  /** null = flat-priced plan. */
  pricePerMealPaise: number | null;
  flatPricePaise: number | null;
  mealsPerCycle: number;
  cycle: PlanCycle;
  slots: PlanSlot[];
  dietTracks: DietTrack[];
  poolQuery: PoolQueryId;
  requiresRdSignoff: boolean;
  customizable: boolean;
  trialEligible: boolean;
  addOnsAllowed: AddOnId[];
  status: PlanStatus;
  blockers: string[];
}

// ── §2 Plan table ────────────────────────────────────────────────────────────
// Prices in paise. desk_fuel ₹199/meal × 22 = ₹4,378/mo (437800). Weekly entry
// tier ₹1,199 (119900) is offered as an alternate duration, never the default
// (02e §5) — represented in PRICING helpers below, not as a separate plan.

export const PLAN_CATALOG: Record<PlanId, PlanConfig> = {
  desk_fuel: {
    id: "desk_fuel",
    routerAnswer: "Get me through the workday",
    pricePerMealPaise: 19900, // ₹199
    flatPricePaise: null,
    mealsPerCycle: 22,
    cycle: "monthly",
    slots: ["lunch"],
    dietTracks: ["veg", "egg", "nonveg"],
    poolQuery: "desk_fuel",
    requiresRdSignoff: false,
    customizable: true,
    trialEligible: true,
    addOnsAllowed: ["rd_bump", "evening_add"],
    status: "live",
    blockers: [],
  },
  steady: {
    id: "steady",
    routerAnswer: "Keep my sugar steady",
    pricePerMealPaise: 22900, // ₹229
    flatPricePaise: null,
    mealsPerCycle: 22,
    cycle: "monthly",
    slots: ["lunch"], // (+dinner opt) — 02e §2
    dietTracks: ["nonveg"], // nonveg only today: veg GI-low pool = 0 (02e §2)
    poolQuery: "steady",
    requiresRdSignoff: true,
    customizable: true,
    trialEligible: true,
    addOnsAllowed: ["rd_bump", "evening_add"],
    status: "blocked_pending_skus",
    blockers: [
      "veg GI-low pool = 0; needs millets pasta import + millet khichdi SKU",
    ],
  },
  glp1_companion: {
    id: "glp1_companion",
    routerAnswer: "I'm on a GLP-1",
    pricePerMealPaise: null,
    flatPricePaise: 599900, // ₹5,999 intro (regular ₹6,999 = 699900) — 02e §2
    mealsPerCycle: 60, // "60 meals + 30 snacks" — snack sub-cycle noted, not modelled (see header)
    cycle: "monthly",
    slots: ["lunch", "dinner", "snack"], // 2 meals + snack — 02e §2
    dietTracks: ["egg", "nonveg"], // egg, nonveg only (02e §2)
    poolQuery: "glp1_meal", // snack slot uses glp1_snack (POOL_PREDICATES)
    requiresRdSignoff: true,
    customizable: true,
    trialEligible: false,
    addOnsAllowed: ["rd_bump"], // bundled
    status: "blocked_pending_skus",
    blockers: [
      "needs tofu/soy bowl for veg; RD sign-off; sattu shake SKU",
    ],
  },
  protein_build: {
    id: "protein_build",
    routerAnswer: "Build muscle",
    pricePerMealPaise: 24900, // ₹249
    flatPricePaise: null,
    mealsPerCycle: 22,
    cycle: "monthly",
    slots: ["lunch"], // (+PM meal) — 02e §2
    dietTracks: ["veg", "nonveg"],
    poolQuery: "protein_build",
    requiresRdSignoff: false,
    customizable: true,
    trialEligible: true,
    addOnsAllowed: ["evening_add"],
    status: "live",
    blockers: [],
  },
  teams: {
    id: "teams",
    routerAnswer: null,
    pricePerMealPaise: 18900, // ₹189 @ 25+ seats
    flatPricePaise: null,
    mealsPerCycle: 22,
    cycle: "monthly",
    slots: ["lunch"],
    dietTracks: ["veg", "nonveg"],
    poolQuery: "desk_fuel", // = desk_fuel pool (02e §2)
    requiresRdSignoff: false,
    customizable: false, // batch
    trialEligible: false,
    addOnsAllowed: [],
    status: "sales_led",
    blockers: ["Pluxee onboarding"],
  },
  trial_3day: {
    id: "trial_3day",
    routerAnswer: null, // secondary CTA
    pricePerMealPaise: null,
    flatPricePaise: 39900, // ₹399
    mealsPerCycle: 3,
    cycle: "one_off",
    slots: ["lunch"],
    dietTracks: ["veg", "nonveg"],
    poolQuery: "trial_fixed",
    requiresRdSignoff: false,
    customizable: false, // fixed trio, no swaps (02e §3.5)
    trialEligible: false,
    addOnsAllowed: [],
    status: "live",
    blockers: [],
  },
};

// ── §4 Add-ons ───────────────────────────────────────────────────────────────
export interface AddOnConfig {
  id: AddOnId;
  pricePaise: number;
  cadence: "monthly" | "weekly";
  attachPoint: "plan_review" | "post_purchase";
}

export const ADD_ONS: Record<AddOnId, AddOnConfig> = {
  rd_bump: {
    id: "rd_bump",
    pricePaise: 49900, // +₹499/mo
    cadence: "monthly",
    attachPoint: "plan_review", // 02 §5
  },
  evening_add: {
    id: "evening_add",
    pricePaise: 59900, // +₹599/week
    cadence: "weekly",
    attachPoint: "post_purchase", // 02a §4
  },
};

// ── §5 Builder defaults ──────────────────────────────────────────────────────
export const BUILDER_DEFAULTS = {
  duration: "monthly" as PlanCycle,
  mealsPerDay: 1,
  /** preference = router answer ?? 'veg' (resolved at call time). */
  defaultPreference: "veg" as DietTrack,
  /** Weekly entry tier offered as the *alternate* duration, never the default. */
  weeklyEntryFloorPaise: 119900, // ₹1,199
  weeklyEntryCeilPaise: 149900, // ₹1,499
  rdBumpPreselected: false,
} as const;

// ── §6 Trial credit logic (implement exactly) ───────────────────────────────
/** Credit granted on a paid trial, redeemable against any plan start. */
export const TRIAL_CREDIT_PAISE = 39900; // ₹399
/** Credit validity from trial end. */
export const TRIAL_CREDIT_VALIDITY_DAYS = 7;
/** Corpus reference prices for the credit-applied worked examples (02e §6). */
export const WEEKLY_PRICE_PAISE = 119900; // ₹1,199
export const MONTHLY_PRICE_PAISE = 437800; // ₹4,378 (desk_fuel ₹199 × 22)

/**
 * Amount charged when the trial credit is applied to a plan start.
 * 02e §6: weekly 119900-39900 = 80000; monthly 437800-39900 = 397900.
 * Never returns negative (a credit larger than the plan is clamped to 0).
 */
export function applyTrialCreditPaise(
  planPricePaise: number,
  creditPaise: number = TRIAL_CREDIT_PAISE,
): number {
  return Math.max(0, planPricePaise - creditPaise);
}

// ── Plan pricing (server-authoritative quote for one cycle) ──────────────────
// Corpus plan prices are the GST-inclusive charged figures (02c: "server-quoted,
// GST-inclusive — the number that gets charged"). A per-meal plan's cycle total
// is pricePerMealPaise × mealsPerCycle; a flat plan uses flatPricePaise. The GST
// component is split out for display (never a second 5% on top), matching how
// the legacy quote treats computeDeliveryPricePaise output.

export interface PlanQuote {
  planId: PlanId;
  cycle: PlanCycle;
  mealsPerCycle: number;
  pricePerMealPaise: number | null;
  /** GST-inclusive total charged for one cycle. */
  cycleTotalPaise: number;
  preTaxPaise: number;
  gstPaise: number;
}

export function computePlanQuote(planId: PlanId): PlanQuote {
  const p = PLAN_CATALOG[planId];
  const cycleTotalPaise =
    p.pricePerMealPaise != null
      ? p.pricePerMealPaise * p.mealsPerCycle
      : (p.flatPricePaise ?? 0);
  const preTaxPaise = Math.round(cycleTotalPaise / (1 + GST_RATE));
  const gstPaise = cycleTotalPaise - preTaxPaise;
  return {
    planId,
    cycle: p.cycle,
    mealsPerCycle: p.mealsPerCycle,
    pricePerMealPaise: p.pricePerMealPaise,
    cycleTotalPaise,
    preTaxPaise,
    gstPaise,
  };
}

/**
 * Self-service bookable = the plan is `live`. `blocked_pending_skus` (steady,
 * glp1) and `sales_led` (teams) plans route to a waitlist / sales motion, never
 * to a self-serve builder (02e §7, 02d §8 zero-dead-end).
 */
export function planIsSelfServiceLaunchable(planId: PlanId): boolean {
  return PLAN_CATALOG[planId].status === "live";
}

/** Whether a plan serves a given diet track (never widen this in callers). */
export function planServesTrack(planId: PlanId, track: DietTrack): boolean {
  return PLAN_CATALOG[planId].dietTracks.includes(track);
}

// ── §3.5 Fixed trial trios (no query, no swaps) ──────────────────────────────
export const TRIAL_TRIOS: Record<"veg" | "nonveg", readonly string[]> = {
  // BBQ Paneer Fiesta Bowl → Paneer Tikka Burrito Wrap → Alfredo Veg
  veg: [
    "barbeque-paneer-fiesta-rice-bowl",
    "paneer-tikka-burrito-wrap",
    "alfredo-pasta-veg",
  ],
  // BBQ Grilled Chicken Bowl → Chipotle Chicken Wrap → Alfredo Chicken
  nonveg: [
    "barbeque-grilled-chicken-rice-bowl",
    "chipotle-chicken-burrito-wrap",
    "alfredo-pasta-chicken",
  ],
} as const;

// ── §3 Pool queries (how a week gets filled) ─────────────────────────────────
// Field-name translation from the 02e shorthand to the repo schema:
//   kcal → macros.calories ; gi → glycaemicIndex ; "signed" → "reviewed".

const CORE_CATEGORIES: ReadonlySet<DishData["category"]> = new Set([
  "bowls",
  "wraps",
  "pasta",
  "mains",
  "salads",
]);

/** A dish is servable in a plan only if available and RD-cleared.
 *  Absent rdReviewState = legacy curated = treated as reviewed (schema doc). */
export function isServable(dish: DishData): boolean {
  const state = dish.rdReviewState;
  const rdOk = !state || state === "reviewed";
  return dish.isAvailable && rdOk;
}

/**
 * Classify a dish's diet track using the same rule the pool findings used:
 * veg = isVeg; among non-veg, "egg" when it declares Eggs and no meat/fish,
 * else "nonveg". Kept intentionally conservative (fail toward nonveg).
 */
export function dishTrack(dish: DishData): DietTrack {
  if (dish.isVeg) return "veg";
  const hay = (
    dish.allergens.join(" ") +
    " " +
    dish.ingredients.join(" ") +
    " " +
    dish.name
  ).toLowerCase();
  const hasMeatOrFish =
    /chicken|mutton|lamb|beef|pork|prawn|fish|egg-free-meat|tuna|meat/.test(hay);
  const hasEgg = /egg/.test(hay);
  if (hasEgg && !hasMeatOrFish) return "egg";
  return "nonveg";
}

export type PoolPredicate = (dish: DishData) => boolean;

/**
 * Pool predicates (02e §3). Each is `isServable ∧ <query clause>`; the caller
 * additionally filters by track via `poolForPlan`. Rotation ("no repeat within
 * 10 weekdays", 02e §3.1) is a scheduling concern handled by the meal planner,
 * not a membership predicate.
 */
export const POOL_PREDICATES: Record<PoolQueryId, PoolPredicate> = {
  // 3.1 desk_fuel — core categories ∧ 300 ≤ kcal ≤ 650.
  desk_fuel: (d) =>
    isServable(d) &&
    CORE_CATEGORIES.has(d.category) &&
    d.macros.calories >= 300 &&
    d.macros.calories <= 650,
  // 3.2 steady — desk_fuel ∧ gi = low ∧ RD-signed (absence = reviewed = signed).
  steady: (d) =>
    POOL_PREDICATES.desk_fuel(d) && d.glycaemicIndex === "low",
  // 3.3 glp1 meal slot — protein ≥ 25 ∧ kcal ≤ 450.
  glp1_meal: (d) =>
    isServable(d) && d.macros.protein >= 25 && d.macros.calories <= 450,
  // 3.3 glp1 snack slot — protein ≥ 18.
  glp1_snack: (d) => isServable(d) && d.macros.protein >= 18,
  // 3.4 protein_build — protein ≥ 28 (ranking is applied by poolForPlan).
  protein_build: (d) => isServable(d) && d.macros.protein >= 28,
  // 3.5 trial — fixed trio, membership by slug (see TRIAL_TRIOS).
  trial_fixed: (d) =>
    isServable(d) &&
    (TRIAL_TRIOS.veg.includes(d.slug) || TRIAL_TRIOS.nonveg.includes(d.slug)),
};

/**
 * The dishes that can fill a given plan × track from the supplied catalog.
 * Pass the DISHES overlay (estimated macros) for customer-facing parity.
 * protein_build is returned protein-descending (02e §3.4 "ranked desc").
 */
export function poolForPlan(
  planId: PlanId,
  track: DietTrack,
  dishes: readonly DishData[],
): DishData[] {
  const plan = PLAN_CATALOG[planId];
  const predicate = POOL_PREDICATES[plan.poolQuery];
  const filtered = dishes.filter(
    (d) => predicate(d) && dishTrack(d) === track,
  );
  if (plan.poolQuery === "protein_build") {
    return [...filtered].sort((a, b) => b.macros.protein - a.macros.protein);
  }
  return filtered;
}

// ── §7 Launch gates ──────────────────────────────────────────────────────────
export interface TrackLaunchState {
  planId: PlanId;
  track: DietTrack;
  poolSize: number;
  /** True → render the builder; false → route the router answer to a waitlist
   *  capture, never to a broken builder (02e §7, 02d §8 zero-dead-end). */
  canLaunch: boolean;
  reasons: string[];
}

/**
 * A plan × track may launch only when its pool is non-empty AND (if the plan
 * requires RD sign-off) at least one pool dish is RD-cleared. trial_fixed is a
 * special case: it launches when all three fixed SKUs for the track are present.
 */
export function trackLaunchState(
  planId: PlanId,
  track: DietTrack,
  dishes: readonly DishData[],
): TrackLaunchState {
  const plan = PLAN_CATALOG[planId];
  const reasons: string[] = [];

  if (!plan.dietTracks.includes(track)) {
    reasons.push(`track "${track}" is not served by ${planId}`);
    return { planId, track, poolSize: 0, canLaunch: false, reasons };
  }

  if (plan.poolQuery === "trial_fixed") {
    const trio = TRIAL_TRIOS[track as "veg" | "nonveg"] ?? [];
    const present = trio.filter((slug) =>
      dishes.some((d) => d.slug === slug && isServable(d)),
    );
    const ok = present.length === trio.length && trio.length > 0;
    if (!ok) {
      reasons.push(
        `fixed trio incomplete: ${present.length}/${trio.length} SKUs servable`,
      );
    }
    return { planId, track, poolSize: present.length, canLaunch: ok, reasons };
  }

  const pool = poolForPlan(planId, track, dishes);
  if (pool.length === 0) {
    reasons.push("pool is empty for this track");
  }
  if (plan.requiresRdSignoff && pool.length > 0) {
    // Absence of rdReviewState is treated as reviewed; a "pending_review"/
    // "blocked" dish is already excluded by isServable, so a non-empty pool
    // here is RD-cleared by construction. Recorded for auditability.
    reasons.push("rd sign-off satisfied (pool dishes are RD-cleared)");
  }
  const canLaunch = pool.length > 0;
  return { planId, track, poolSize: pool.length, canLaunch, reasons };
}

/** Convenience: the router answer → PlanId map (02d §2). null answers excluded. */
export const ROUTER_ANSWER_TO_PLAN: ReadonlyArray<{
  answer: string;
  planId: PlanId;
}> = (Object.values(PLAN_CATALOG) as PlanConfig[])
  .filter((p): p is PlanConfig & { routerAnswer: string } => p.routerAnswer !== null)
  .map((p) => ({ answer: p.routerAnswer, planId: p.id }));
