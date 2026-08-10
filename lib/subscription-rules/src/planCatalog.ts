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

export type PlanCycle = "weekly" | "monthly" | "quarterly" | "one_off";
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
  /** null = flat-priced plan. Holds the default/veg base price. */
  pricePerMealPaise: number | null;
  /** Per-variant meal pricing in paise, when variant deltas apply. */
  variantPrices?: Partial<Record<DietTrack, number>>;
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

// ── §2 Plan table & Canonical Price Table ─────────────────────────────────────
export interface PlanPriceCycleAmounts {
  perMealPaise: number | null;
  weeklyTotalPaise: number | null;
  monthlyTotalPaise: number | null;
  quarterlyTotalPaise: number | null;
  flatPricePaise: number | null;
}

/**
 * THE single source of truth for all plan pricing across cycles and diet tracks
 * per Catalog Pricing Specification Table II.1. All amounts GST-inclusive in paise.
 * One table to review, one to diff, one for the storefront to read.
 */
export const PLAN_PRICE_TABLE = {
  desk_fuel: {
    veg: { perMealPaise: 19900, weeklyTotalPaise: 119900, monthlyTotalPaise: 437800, quarterlyTotalPaise: 1199900, flatPricePaise: null },
    egg: { perMealPaise: 20900, weeklyTotalPaise: 124900, monthlyTotalPaise: 459800, quarterlyTotalPaise: 1259900, flatPricePaise: null },
    nonveg: { perMealPaise: 21900, weeklyTotalPaise: 129900, monthlyTotalPaise: 481800, quarterlyTotalPaise: 1319900, flatPricePaise: null },
  },
  protein_build: {
    veg: { perMealPaise: 24900, weeklyTotalPaise: 149900, monthlyTotalPaise: 547800, quarterlyTotalPaise: 1499900, flatPricePaise: null },
    egg: { perMealPaise: 25900, weeklyTotalPaise: 154900, monthlyTotalPaise: 569800, quarterlyTotalPaise: 1559900, flatPricePaise: null },
    nonveg: { perMealPaise: 27900, weeklyTotalPaise: 164900, monthlyTotalPaise: 613800, quarterlyTotalPaise: 1679900, flatPricePaise: null },
  },
  steady: {
    nonveg: { perMealPaise: 22900, weeklyTotalPaise: null, monthlyTotalPaise: 503800, quarterlyTotalPaise: null, flatPricePaise: null },
  },
  glp1_companion: {
    intro: { perMealPaise: null, weeklyTotalPaise: null, monthlyTotalPaise: 599900, quarterlyTotalPaise: null, flatPricePaise: 599900 },
    regular: { perMealPaise: null, weeklyTotalPaise: null, monthlyTotalPaise: 699900, quarterlyTotalPaise: null, flatPricePaise: 699900 },
  },
  teams: {
    default: { perMealPaise: 18900, weeklyTotalPaise: null, monthlyTotalPaise: null, quarterlyTotalPaise: null, flatPricePaise: null },
  },
  trial_3day: {
    one_off: { perMealPaise: null, weeklyTotalPaise: 39900, monthlyTotalPaise: null, quarterlyTotalPaise: null, flatPricePaise: 39900 },
  },
} as const;

export const PLAN_CATALOG: Record<PlanId, PlanConfig> = {
  desk_fuel: {
    id: "desk_fuel",
    routerAnswer: "Get me through the workday",
    pricePerMealPaise: PLAN_PRICE_TABLE.desk_fuel.veg.perMealPaise, // ₹199 base
    variantPrices: {
      veg: PLAN_PRICE_TABLE.desk_fuel.veg.perMealPaise,
      egg: PLAN_PRICE_TABLE.desk_fuel.egg.perMealPaise,
      nonveg: PLAN_PRICE_TABLE.desk_fuel.nonveg.perMealPaise,
    },
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
    pricePerMealPaise: PLAN_PRICE_TABLE.steady.nonveg.perMealPaise, // ₹229 (nonveg only)
    variantPrices: {
      nonveg: PLAN_PRICE_TABLE.steady.nonveg.perMealPaise,
    },
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
    flatPricePaise: PLAN_PRICE_TABLE.glp1_companion.intro.flatPricePaise, // ₹5,999 intro
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
    pricePerMealPaise: PLAN_PRICE_TABLE.protein_build.veg.perMealPaise, // ₹249 base
    variantPrices: {
      veg: PLAN_PRICE_TABLE.protein_build.veg.perMealPaise,
      egg: PLAN_PRICE_TABLE.protein_build.egg.perMealPaise,
      nonveg: PLAN_PRICE_TABLE.protein_build.nonveg.perMealPaise,
    },
    flatPricePaise: null,
    mealsPerCycle: 22,
    cycle: "monthly",
    slots: ["lunch"], // (+PM meal) — 02e §2
    dietTracks: ["veg", "egg", "nonveg"],
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
    pricePerMealPaise: PLAN_PRICE_TABLE.teams.default.perMealPaise, // ₹189 @ 25+ seats
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
    flatPricePaise: PLAN_PRICE_TABLE.trial_3day.one_off.flatPricePaise, // ₹399
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

// RECONCILIATION FLAG (Chandan-owned, PLAN-CROSSCHECK §3.2 H3): rd_bump
// (+₹499/mo, plan-attached RD touch) overlaps the existing ₹999/mo premium
// membership, which already bundles ~1 RD consult/period. Default here: keep
// them DISTINCT — rd_bump is the lighter, subscription-attached option offered
// at plan review; premium remains the broader standalone membership. Revisit
// (merge / retire premium) when Amendment 02 §5 lands.

export interface AddOnLineItem {
  id: AddOnId;
  pricePaise: number;
  cadence: "monthly" | "weekly";
  attachPoint: "plan_review" | "post_purchase";
}

/** The add-on ids a plan permits (02e §2 addOnsAllowed). */
export function attachableAddOns(planId: PlanId): AddOnId[] {
  return PLAN_CATALOG[planId].addOnsAllowed;
}

/**
 * Validate requested add-ons against a plan's allow-list and return their line
 * items. Deduplicates, preserves request order, and reports any add-on the plan
 * does not permit in `rejected` (the caller decides whether to 422). Pure.
 */
export function resolveAddOns(
  planId: PlanId,
  requested: readonly AddOnId[],
): { items: AddOnLineItem[]; rejected: AddOnId[] } {
  const allowed = new Set(PLAN_CATALOG[planId].addOnsAllowed);
  const items: AddOnLineItem[] = [];
  const rejected: AddOnId[] = [];
  const seen = new Set<AddOnId>();
  for (const id of requested) {
    if (seen.has(id)) continue;
    seen.add(id);
    if (!allowed.has(id)) {
      rejected.push(id);
      continue;
    }
    const cfg = ADD_ONS[id];
    items.push({
      id,
      pricePaise: cfg.pricePaise,
      cadence: cfg.cadence,
      attachPoint: cfg.attachPoint,
    });
  }
  return { items, rejected };
}

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

/**
 * Expiry instant for a trial credit lot: TRIAL_CREDIT_VALIDITY_DAYS (7) after
 * the trial ends (02b conversion window). `trialEndsAt` is injectable so the
 * calculation stays pure and testable. Returns a new Date (no mutation).
 */
export function trialCreditExpiry(trialEndsAt: Date): Date {
  const ms = trialEndsAt.getTime();
  return new Date(ms + TRIAL_CREDIT_VALIDITY_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * The credit lot to grant when a 3-Day Taste Test is PAID (02b/02e §6).
 * Pure descriptor — the caller passes this to the DB grant (`issueCredit`) at
 * the trial-paid confirmation point (see IMPLEMENTATION-PLAN slice S5b).
 */
export interface TrialCreditGrant {
  deltaPaise: number;
  reason: "trial_creditback";
  expiresAt: Date;
}

export function trialCreditGrant(trialEndsAt: Date): TrialCreditGrant {
  return {
    deltaPaise: TRIAL_CREDIT_PAISE,
    reason: "trial_creditback",
    expiresAt: trialCreditExpiry(trialEndsAt),
  };
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

export function computePlanQuote(
  planId: PlanId,
  track: DietTrack = "veg",
  requestedCycle?: PlanCycle,
): PlanQuote {
  const p = PLAN_CATALOG[planId];
  const cycle = requestedCycle ?? p.cycle;
  let mealsPerCycle = p.mealsPerCycle;
  let pricePerMeal: number | null = p.variantPrices?.[track] ?? p.pricePerMealPaise;
  let cycleTotalPaise: number;

  const tableEntry = (PLAN_PRICE_TABLE as any)[planId]?.[track];

  if (cycle === "quarterly" && tableEntry?.quarterlyTotalPaise != null) {
    mealsPerCycle = p.mealsPerCycle * 3; // 66 meals for 22-meal monthly plans
    cycleTotalPaise = tableEntry.quarterlyTotalPaise;
    pricePerMeal = Math.round(cycleTotalPaise / mealsPerCycle);
  } else if (cycle === "weekly" && tableEntry?.weeklyTotalPaise != null) {
    mealsPerCycle = Math.round(p.mealsPerCycle / 4); // 5 or 6 meals per week
    cycleTotalPaise = tableEntry.weeklyTotalPaise;
    if (tableEntry.perMealPaise != null) pricePerMeal = tableEntry.perMealPaise;
  } else {
    cycleTotalPaise =
      pricePerMeal != null
        ? pricePerMeal * mealsPerCycle
        : (p.flatPricePaise ?? 0);
  }

  const preTaxPaise = Math.round(cycleTotalPaise / (1 + GST_RATE));
  const gstPaise = cycleTotalPaise - preTaxPaise;
  return {
    planId,
    cycle,
    mealsPerCycle,
    pricePerMealPaise: pricePerMeal,
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

/**
 * Condition-slug → PlanId (D-04B, TNM-CRO-01 owner ruling 2026-08-11:
 * `/quick-setup?condition=<slug>` must exit deterministically to "the plan
 * the condition page recommends"). No such mapping existed anywhere in the
 * corpus before this — `/care/[condition]` is a free-text catch-all with no
 * fixed condition list — so this is a first-cut, INFERRED mapping onto the
 * two condition-relevant plans the catalog actually has: `steady` (low-GI /
 * blood-sugar) and `glp1_companion` (GLP-1 medication support). Every other
 * plan is goal-based, not condition-based, and stays unmapped. Unknown slugs
 * return null — callers fall back to the trial, never a dead end.
 */
const CONDITION_PLAN_MAP: Readonly<Record<string, PlanId>> = {
  pcos: "steady",
  "insulin-resistance": "steady",
  prediabetes: "steady",
  diabetes: "steady",
  "type-2-diabetes": "steady",
  glp1: "glp1_companion",
  "glp-1": "glp1_companion",
  ozempic: "glp1_companion",
  wegovy: "glp1_companion",
};

/** Normalizes a condition slug (case/space/underscore-insensitive) and looks
 *  it up in CONDITION_PLAN_MAP. null when there's no mapped plan. */
export function planForCondition(conditionSlug: string): PlanId | null {
  const key = conditionSlug.trim().toLowerCase().replace(/[\s_]+/g, "-");
  return CONDITION_PLAN_MAP[key] ?? null;
}

// ── Corporate Teams Seat Tiers (Table II.2) ──────────────────────────────────
export interface B2BSeatTier {
  tier: 1 | 2 | 3;
  minSeats: number;
  maxSeats: number | null;
  pricesPaise: Record<DietTrack, number>;
}

export const TEAMS_SEAT_TIERS: readonly B2BSeatTier[] = [
  { tier: 1, minSeats: 10, maxSeats: 24, pricesPaise: { veg: 20900, egg: 21900, nonveg: 22900 } },
  { tier: 2, minSeats: 25, maxSeats: 49, pricesPaise: { veg: 19900, egg: 20900, nonveg: 21900 } },
  { tier: 3, minSeats: 50, maxSeats: null, pricesPaise: { veg: 18900, egg: 19900, nonveg: 20900 } },
] as const;

export interface CorporateInvoiceQuote {
  seats: number;
  mealsPerCycle: number;
  tier: 1 | 2 | 3;
  track: DietTrack;
  pricePerMealPaise: number;
  totalMeals: number;
  cycleTotalPaise: number;
  preTaxPaise: number;
  gstPaise: number;
  discountSource: string;
}

export function computeCorporateTeamsQuote(
  seats: number,
  track: DietTrack = "veg",
  mealsPerCycle: number = 22,
): CorporateInvoiceQuote {
  if (!Number.isInteger(seats) || seats < 10) {
    throw new Error("minimum 10 seats required for corporate Teams tiers");
  }
  let selectedTier: B2BSeatTier = TEAMS_SEAT_TIERS[0]!;
  if (seats >= 50) {
    selectedTier = TEAMS_SEAT_TIERS[2]!;
  } else if (seats >= 25) {
    selectedTier = TEAMS_SEAT_TIERS[1]!;
  }

  const pricePerMealPaise = selectedTier.pricesPaise[track];
  const totalMeals = seats * mealsPerCycle;
  const cycleTotalPaise = totalMeals * pricePerMealPaise;
  const preTaxPaise = Math.round(cycleTotalPaise / (1 + GST_RATE));
  const gstPaise = cycleTotalPaise - preTaxPaise;
  const discountSource = `Corporate Teams Tier ${selectedTier.tier} (${selectedTier.minSeats}${selectedTier.maxSeats ? "-" + selectedTier.maxSeats : "+"} seats: ₹${pricePerMealPaise / 100}/meal)`;

  return {
    seats,
    mealsPerCycle,
    tier: selectedTier.tier,
    track,
    pricePerMealPaise,
    totalMeals,
    cycleTotalPaise,
    preTaxPaise,
    gstPaise,
    discountSource,
  };
}

