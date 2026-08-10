import type { DishData } from "@workspace/menu-catalog";
import {
  evaluateDishForPreferences,
  type PreferencesForMatch,
  type DietaryStyle,
} from "@workspace/preferences-match";
import type {
  PlanDraft,
  PlanDraftDay,
  PlanDraftGenerationCode,
  PlanDraftMealPeriod,
  PlanDraftMealSlot,
} from "@workspace/db";
import {
  PLAN_CATALOG,
  computePlanQuote,
  planIsSelfServiceLaunchable,
  planServesTrack,
  poolForPlan,
  type DietTrack,
  type PlanId,
} from "@workspace/subscription-rules";

// ─────────────────────────────────────────────────────────────────────────────
// PlanDraft lineup generation (PR A2.2 — DEFECT-PLAN-GEN-001).
//
// Turns a draft's collected preferences into a day-by-day lineup of real,
// orderable dishes. Deliberately DETERMINISTIC — no model call. The weekly
// meal-planner (lib/mealPlanner.ts) asks a model to pick from a pre-filtered
// pool and falls back to a greedy picker when the model is unavailable or
// returns a constraint-violating plan; this engine is that proven greedy
// picker without the model leg, because a pre-purchase configuration screen
// must produce the same lineup for the same inputs every time (it is what the
// customer reviews, edits, and later buys) and because nothing here needs
// prose the model would be generating.
//
// What this engine does NOT do, by design:
//   • It never prices anything. `priceAdjustmentPaise` is written as 0 on
//     generation and only ever moves via a SERVER-resolved accompaniment
//     modifier (see planDraftAccompaniments.ts). A PLAN_CATALOG plan charges
//     its per-meal price regardless of which in-pool dish fills a slot, and a
//     custom (Journey 4) plan has no price at all until the quote step
//     (A2.3, DEFECT-PLAN-CONVERT-001).
//   • It never picks real delivery dates. `deliveryDate` here is a provisional
//     consecutive-day sequence so the lineup has stable slot keys to edit
//     against; eligible dates, windows, serviceability and capacity are A2.3
//     (DEFECT-PLAN-SCHEDULE-001). `deliveryWindow`/`addressId` stay null.
// ─────────────────────────────────────────────────────────────────────────────

/** Bounds the JSONB lineup a single draft row can carry. A quarterly custom
 *  plan at 7 days/week is 84 days, so this only ever clamps nonsense. */
export const MAX_LINEUP_DAYS = 92;

/** How many times one dish may repeat across the whole lineup, by the draft's
 *  declared variety appetite. Relaxed automatically (and reported) when the
 *  safe pool is too small to fill the lineup at the requested cap. */
const MAX_REPETITIONS_BY_VARIETY: Record<string, number> = {
  low: 6,
  standard: 3,
  high: 2,
};
const DEFAULT_MAX_REPETITIONS = 3;

const WEEKS_PER_CYCLE: Record<string, number> = {
  weekly: 1,
  monthly: 4,
  quarterly: 12,
};

/** Category buckets per meal period, for Journey 4 (custom) drafts which have
 *  no PLAN_CATALOG pool query to inherit. Mirrors mealPlanner's
 *  SLOT_CATEGORY_BUCKETS and extends it with the "snack" period PlanDraft
 *  supports and MealPlan does not. */
const PERIOD_CATEGORY_BUCKETS: Record<PlanDraftMealPeriod, ReadonlySet<string>> = {
  breakfast: new Set(["breakfast", "beverages", "snacks"]),
  lunch: new Set(["bowls", "wraps", "mains", "salads", "soups", "pasta"]),
  dinner: new Set(["mains", "bowls", "wraps", "salads", "pasta", "soups"]),
  snack: new Set(["snacks", "beverages", "salads", "soups"]),
};

/** Stable order so a lineup's slots always read breakfast → snack. */
const PERIOD_ORDER: PlanDraftMealPeriod[] = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
];

export class PlanDraftGenerationError extends Error {
  readonly code: PlanDraftGenerationCode;
  readonly details: Record<string, unknown>;

  constructor(
    code: PlanDraftGenerationCode,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "PlanDraftGenerationError";
    this.code = code;
    this.details = details;
  }
}

export interface GeneratedLineup {
  lineup: PlanDraftDay[];
  /** Machine-readable notes about compromises the engine had to make.
   *  Surfaced to the customer rather than hidden. */
  notes: string[];
}

/**
 * Map the draft's free-form `dietaryPattern` onto the narrow DietTrack the
 * plan catalog serves. Unknown/absent patterns fall to "nonveg", matching
 * planCatalog's own dishTrack() convention of failing toward the widest
 * track — a customer who declared nothing is not silently constrained to veg.
 */
export function resolveDietTrack(dietaryPattern: string | null): DietTrack {
  const p = (dietaryPattern ?? "").trim().toLowerCase();
  if (p === "veg" || p === "vegetarian" || p === "vegan") return "veg";
  if (p === "egg" || p === "eggetarian") return "egg";
  return "nonveg";
}

function dietaryStyleFromPattern(dietaryPattern: string | null): DietaryStyle {
  const p = (dietaryPattern ?? "").trim().toLowerCase();
  if (p === "vegan") return "vegan";
  if (p === "veg" || p === "vegetarian") return "vegetarian";
  if (p === "pescatarian") return "pescatarian";
  if (p === "keto") return "keto";
  return "omnivore";
}

/**
 * The HARD safety screen: allergens the customer flagged and exclusions they
 * declared, evaluated in strict mode so both become blocks (strict promotes
 * `dislikedIngredients` to `ingredient_block`, which is exactly what a
 * declared hard exclusion means). Soft dislikes are deliberately NOT here —
 * they only reorder candidates. That distinction is the Journey 4 gap the
 * contract-gap doc records as unimplemented server-side.
 */
export function hardPreferencesFromDraft(draft: PlanDraft): PreferencesForMatch {
  return {
    allergens: draft.hardAllergens ?? [],
    dislikedIngredients: draft.hardExclusions ?? [],
    cuisines: [],
    dietaryStyle: dietaryStyleFromPattern(draft.dietaryPattern),
  };
}

/** The SOFT screen: same profile plus the customer's dislikes, evaluated
 *  non-strict so a match is a ranking signal, never a block. */
function softPreferencesFromDraft(draft: PlanDraft): PreferencesForMatch {
  return {
    allergens: draft.hardAllergens ?? [],
    dislikedIngredients: draft.softDislikes ?? [],
    cuisines: [],
    dietaryStyle: dietaryStyleFromPattern(draft.dietaryPattern),
    goal: (draft.goal as PreferencesForMatch["goal"]) ?? null,
  };
}

/** True when the dish clears every hard rule for this draft. */
export function isDishSafeForDraft(draft: PlanDraft, dish: DishData): boolean {
  return !evaluateDishForPreferences(dish, hardPreferencesFromDraft(draft), {
    strict: true,
  }).blocked;
}

/**
 * Which meal periods this draft's lineup covers.
 *  - Journey 2: the plan's own slots, narrowed by the customer's Mealtime
 *    Preference answer when that answer overlaps them. A mealtime answer that
 *    overlaps nothing the plan serves is ignored rather than producing an
 *    empty lineup — the plan's slots are the contract.
 *  - Journey 4: the routine's meal periods verbatim.
 */
export function mealPeriodsForDraft(draft: PlanDraft): PlanDraftMealPeriod[] {
  if (draft.journey === "custom") {
    const requested = draft.routine?.mealPeriods ?? [];
    return sortPeriods(requested);
  }

  const planId = draft.planId as PlanId | null;
  if (!planId || !PLAN_CATALOG[planId]) return [];
  const planPeriods = PLAN_CATALOG[planId].slots as PlanDraftMealPeriod[];
  const requested = draft.mealtime?.periods ?? [];
  const overlap = planPeriods.filter((p) => requested.includes(p));
  return sortPeriods(overlap.length > 0 ? overlap : planPeriods);
}

function sortPeriods(
  periods: readonly PlanDraftMealPeriod[],
): PlanDraftMealPeriod[] {
  const unique = Array.from(new Set(periods));
  return PERIOD_ORDER.filter((p) => unique.includes(p));
}

/** How many delivery days the lineup spans. */
export function lineupDayCount(draft: PlanDraft, periodCount: number): number {
  if (periodCount <= 0) return 0;

  if (draft.journey === "custom") {
    const daysPerWeek = draft.routine?.daysPerWeek ?? 0;
    const weeks = WEEKS_PER_CYCLE[draft.duration?.cycle ?? "weekly"] ?? 1;
    return Math.min(daysPerWeek * weeks, MAX_LINEUP_DAYS);
  }

  const planId = draft.planId as PlanId | null;
  if (!planId || !PLAN_CATALOG[planId]) return 0;
  const track = resolveDietTrack(draft.dietaryPattern);
  // computePlanQuote is used here ONLY for its cycle-resolved mealsPerCycle.
  // No amount it returns is read — a lineup carries no money.
  const { mealsPerCycle } = computePlanQuote(
    planId,
    track,
    draft.duration?.cycle ?? PLAN_CATALOG[planId].cycle,
  );
  return Math.min(Math.ceil(mealsPerCycle / periodCount), MAX_LINEUP_DAYS);
}

/** Provisional consecutive UTC dates. Real delivery dates are A2.3's job. */
export function provisionalDeliveryDates(
  dayCount: number,
  startDate: Date,
): string[] {
  const out: string[] = [];
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(startDate);
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() + i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export function slotKey(
  deliveryDate: string,
  mealPeriod: PlanDraftMealPeriod,
): string {
  return `${deliveryDate}:${mealPeriod}`;
}

/**
 * The safe, ranked candidate list for one meal period.
 *
 * Journey 2 starts from the plan's own pool query (poolForPlan) so a
 * PLAN_CATALOG plan can only ever be filled with dishes that plan actually
 * sells, then layers the customer's hard safety screen on top — poolForPlan
 * knows nothing about who is ordering. Journey 4 has no catalog plan, so the
 * pool is the live catalog filtered by period-appropriate categories.
 */
export function candidatesForPeriod(
  draft: PlanDraft,
  period: PlanDraftMealPeriod,
  dishes: readonly DishData[],
): DishData[] {
  let base: DishData[];

  if (draft.journey === "custom") {
    const buckets = PERIOD_CATEGORY_BUCKETS[period];
    base = dishes.filter((d) => d.isAvailable && buckets.has(d.category));
    // A period whose categories are all sold out must not silently borrow
    // another period's dishes without saying so — fall back to the whole
    // available catalog, still hard-screened below.
    if (base.length === 0) {
      base = dishes.filter((d) => d.isAvailable);
    }
  } else {
    const planId = draft.planId as PlanId | null;
    if (!planId || !PLAN_CATALOG[planId]) return [];
    base = poolForPlan(planId, resolveDietTrack(draft.dietaryPattern), dishes);
  }

  const safe = base.filter((d) => isDishSafeForDraft(draft, d));
  return rankCandidates(draft, safe);
}

/**
 * Deterministic ranking. Soft dislikes sink to the bottom (never removed —
 * a dislike is a preference, not a safety rule), then the draft's declared
 * intensity directions, then its goal, then name for a stable tiebreak.
 */
export function rankCandidates(
  draft: PlanDraft,
  dishes: readonly DishData[],
): DishData[] {
  const softPrefs = softPreferencesFromDraft(draft);
  const dislikedIds = new Set(
    dishes
      .filter(
        (d) =>
          evaluateDishForPreferences(d, softPrefs).matchedDislikes.length > 0,
      )
      .map((d) => d.id),
  );

  const intensity = draft.intensity;
  const goal = (draft.goal ?? "").trim().toLowerCase();

  return [...dishes].sort((a, b) => {
    const aDis = dislikedIds.has(a.id) ? 1 : 0;
    const bDis = dislikedIds.has(b.id) ? 1 : 0;
    if (aDis !== bDis) return aDis - bDis;

    if (intensity && intensity.proteinDirection !== "standard") {
      const diff =
        intensity.proteinDirection === "higher"
          ? b.macros.protein - a.macros.protein
          : a.macros.protein - b.macros.protein;
      if (diff !== 0) return diff;
    }
    if (intensity && intensity.carbDirection !== "standard") {
      const diff =
        intensity.carbDirection === "lower"
          ? a.macros.carbs - b.macros.carbs
          : b.macros.carbs - a.macros.carbs;
      if (diff !== 0) return diff;
    }
    if (intensity && intensity.portionProfile !== "standard") {
      const diff =
        intensity.portionProfile === "hearty"
          ? b.macros.calories - a.macros.calories
          : a.macros.calories - b.macros.calories;
      if (diff !== 0) return diff;
    }
    if (!intensity) {
      if (goal === "gain_muscle") {
        const diff = b.macros.protein - a.macros.protein;
        if (diff !== 0) return diff;
      } else if (goal === "lose_weight") {
        const diff = a.macros.calories - b.macros.calories;
        if (diff !== 0) return diff;
      }
    }
    return a.name.localeCompare(b.name);
  });
}

/**
 * Why this dish is in this slot. Composed ONLY from facts the evaluator
 * actually returned plus the dish's own macros — never invented copy. Returns
 * null when there is nothing truthful to say beyond "it passed the screen",
 * which the UI can render generically rather than being handed filler.
 */
export function explainCompatibility(
  draft: PlanDraft,
  dish: DishData,
): string | null {
  const match = evaluateDishForPreferences(dish, softPreferencesFromDraft(draft));
  if (match.reasons.length > 0) {
    return match.reasons.slice(0, 2).join(". ");
  }
  const allergens = draft.hardAllergens ?? [];
  if (allergens.length > 0) {
    return `Avoids ${allergens.join(", ")} and fits your ${dietaryStyleFromPattern(draft.dietaryPattern)} profile.`;
  }
  const intensity = draft.intensity;
  if (intensity?.proteinDirection === "higher") {
    return `${dish.macros.protein}g protein per serving.`;
  }
  if (intensity?.portionProfile === "light") {
    return `${dish.macros.calories} kcal per serving.`;
  }
  return null;
}

export function buildMealSlot(
  draft: PlanDraft,
  period: PlanDraftMealPeriod,
  dish: DishData,
): PlanDraftMealSlot {
  return {
    mealPeriod: period,
    dishId: dish.id,
    dishVersionId: null,
    slug: dish.slug,
    name: dish.name,
    image: dish.image,
    portionId: draft.intensity?.portionProfile ?? null,
    accompanimentSelections: [],
    addOns: [],
    locked: false,
    compatibilityExplanation: explainCompatibility(draft, dish),
    // Generation never moves money. See this file's header.
    priceAdjustmentPaise: 0,
    nutrition: {
      calories: dish.macros.calories,
      protein: dish.macros.protein,
      carbs: dish.macros.carbs,
      fat: dish.macros.fat,
    },
  };
}

/** Throws PlanDraftGenerationError when the draft can't produce a lineup. */
function assertGeneratable(draft: PlanDraft, periods: PlanDraftMealPeriod[]): void {
  if (draft.journey === "recommended") {
    const planId = draft.planId as PlanId | null;
    if (!planId || !PLAN_CATALOG[planId]) {
      throw new PlanDraftGenerationError(
        "missing_plan",
        "This draft has no plan selected yet.",
      );
    }
    // 02e §7 / 02d §8 zero-dead-end: a plan that isn't self-service launchable
    // routes to a waitlist, never to a builder that pretends to work.
    if (!planIsSelfServiceLaunchable(planId)) {
      throw new PlanDraftGenerationError(
        "plan_not_launchable",
        "This plan is not open for self-service sign-up yet.",
        { planId, blockers: PLAN_CATALOG[planId].blockers },
      );
    }
    const track = resolveDietTrack(draft.dietaryPattern);
    if (!planServesTrack(planId, track)) {
      throw new PlanDraftGenerationError(
        "plan_does_not_serve_track",
        "This plan does not serve your selected dietary track.",
        { planId, track, servedTracks: PLAN_CATALOG[planId].dietTracks },
      );
    }
  } else if (!draft.routine) {
    throw new PlanDraftGenerationError(
      "missing_routine",
      "This draft has no routine configured yet.",
    );
  }

  if (periods.length === 0) {
    throw new PlanDraftGenerationError(
      "no_meal_periods",
      "No meal periods have been selected for this plan.",
    );
  }
}

interface FillOptions {
  /** Slots to leave exactly as they are (Keep-protected). Keyed by slotKey. */
  keep?: Map<string, PlanDraftMealSlot>;
  /** Rotation seed so a re-shuffle lands somewhere different from the first
   *  pass rather than regenerating the identical lineup. */
  rotationSeed?: number;
}

/**
 * Fill `dates` × `periods` from each period's ranked candidate pool, honouring
 * the repetition cap, avoiding same-day duplicates, and preserving any kept
 * slots. Never falls outside the safe pool — an unfillable slot is an explicit
 * failure, matching mealPlanner's "never persist a partial plan" rule.
 */
function fillLineup(
  draft: PlanDraft,
  dates: string[],
  periods: PlanDraftMealPeriod[],
  poolByPeriod: Map<PlanDraftMealPeriod, DishData[]>,
  opts: FillOptions,
): GeneratedLineup {
  const notes: string[] = [];
  const keep = opts.keep ?? new Map<string, PlanDraftMealSlot>();
  const rotationSeed = opts.rotationSeed ?? 0;

  const requestedCap =
    MAX_REPETITIONS_BY_VARIETY[
      (draft.varietyPreference ?? "").trim().toLowerCase()
    ] ?? DEFAULT_MAX_REPETITIONS;

  // A cap the pool physically cannot satisfy would fail every generation for a
  // small catalog. Relax it deterministically and SAY SO rather than either
  // failing or silently ignoring the customer's variety preference.
  const capByPeriod = new Map<PlanDraftMealPeriod, number>();
  let relaxed = false;
  for (const period of periods) {
    const poolSize = poolByPeriod.get(period)?.length ?? 0;
    if (poolSize === 0) continue;
    const needed = dates.length;
    const cap = Math.max(requestedCap, Math.ceil(needed / poolSize));
    if (cap > requestedCap) relaxed = true;
    capByPeriod.set(period, cap);
  }
  if (relaxed) notes.push("variety_relaxed_for_pool_size");

  const counts = new Map<number, number>();
  for (const slot of keep.values()) {
    counts.set(slot.dishId, (counts.get(slot.dishId) ?? 0) + 1);
  }

  const lineup: PlanDraftDay[] = [];
  for (let dayIndex = 0; dayIndex < dates.length; dayIndex++) {
    const deliveryDate = dates[dayIndex]!;
    const usedToday = new Set<number>();
    const slots: PlanDraftMealSlot[] = [];

    for (let periodIndex = 0; periodIndex < periods.length; periodIndex++) {
      const period = periods[periodIndex]!;
      const kept = keep.get(slotKey(deliveryDate, period));
      if (kept) {
        slots.push(kept);
        usedToday.add(kept.dishId);
        continue;
      }

      const pool = poolByPeriod.get(period) ?? [];
      if (pool.length === 0) {
        throw new PlanDraftGenerationError(
          "empty_safe_pool",
          "No dishes match your dietary requirements for one of your meal times.",
          { mealPeriod: period },
        );
      }
      const cap = capByPeriod.get(period) ?? requestedCap;
      const offset =
        (dayIndex * periods.length + periodIndex + rotationSeed) % pool.length;

      let picked: DishData | null = null;
      for (let step = 0; step < pool.length; step++) {
        const dish = pool[(offset + step) % pool.length]!;
        if (usedToday.has(dish.id)) continue;
        if ((counts.get(dish.id) ?? 0) >= cap) continue;
        picked = dish;
        break;
      }
      // Second pass: allow a same-day repeat before giving up, but never
      // exceed the (already pool-aware) repetition cap.
      if (!picked) {
        for (let step = 0; step < pool.length; step++) {
          const dish = pool[(offset + step) % pool.length]!;
          if ((counts.get(dish.id) ?? 0) >= cap) continue;
          picked = dish;
          break;
        }
      }
      if (!picked) {
        throw new PlanDraftGenerationError(
          "incomplete_lineup",
          "Could not fill every meal from the dishes that match your requirements.",
          { deliveryDate, mealPeriod: period, poolSize: pool.length },
        );
      }

      counts.set(picked.id, (counts.get(picked.id) ?? 0) + 1);
      usedToday.add(picked.id);
      slots.push(buildMealSlot(draft, period, picked));
    }

    lineup.push({
      deliveryDate,
      // A2.3 owns delivery windows, addresses, serviceability and capacity.
      deliveryWindow: null,
      addressId: null,
      slots,
    });
  }

  return { lineup, notes };
}

/** Generate a fresh lineup for a draft. Throws PlanDraftGenerationError. */
export function generateLineup(
  draft: PlanDraft,
  dishes: readonly DishData[],
  startDate: Date,
): GeneratedLineup {
  const periods = mealPeriodsForDraft(draft);
  assertGeneratable(draft, periods);

  const dayCount = lineupDayCount(draft, periods.length);
  if (dayCount <= 0) {
    throw new PlanDraftGenerationError(
      "incomplete_lineup",
      "This plan's configuration does not cover any delivery days.",
      { dayCount },
    );
  }

  const poolByPeriod = new Map<PlanDraftMealPeriod, DishData[]>();
  for (const period of periods) {
    poolByPeriod.set(period, candidatesForPeriod(draft, period, dishes));
  }

  return fillLineup(
    draft,
    provisionalDeliveryDates(dayCount, startDate),
    periods,
    poolByPeriod,
    {},
  );
}

/**
 * Re-roll every UNLOCKED slot of an existing lineup. Locked (Keep-protected)
 * slots survive by construction — they are handed to the filler as fixed
 * points, so no shuffle can replace one.
 */
export function shuffleLineup(
  draft: PlanDraft,
  lineup: readonly PlanDraftDay[],
  lockedKeys: readonly string[],
  dishes: readonly DishData[],
  rotationSeed: number,
): GeneratedLineup {
  const periods = mealPeriodsForDraft(draft);
  assertGeneratable(draft, periods);

  const locked = new Set(lockedKeys);
  const keep = new Map<string, PlanDraftMealSlot>();
  for (const day of lineup) {
    for (const slot of day.slots) {
      const key = slotKey(day.deliveryDate, slot.mealPeriod);
      if (slot.locked || locked.has(key)) keep.set(key, slot);
    }
  }

  const poolByPeriod = new Map<PlanDraftMealPeriod, DishData[]>();
  for (const period of periods) {
    poolByPeriod.set(period, candidatesForPeriod(draft, period, dishes));
  }

  return fillLineup(
    draft,
    lineup.map((d) => d.deliveryDate),
    periods,
    poolByPeriod,
    { keep, rotationSeed },
  );
}

/** Find one slot in a lineup by its date + period. */
export function findSlot(
  lineup: readonly PlanDraftDay[],
  deliveryDate: string,
  mealPeriod: PlanDraftMealPeriod,
): { day: PlanDraftDay; slot: PlanDraftMealSlot } | null {
  for (const day of lineup) {
    if (day.deliveryDate !== deliveryDate) continue;
    for (const slot of day.slots) {
      if (slot.mealPeriod === mealPeriod) return { day, slot };
    }
  }
  return null;
}

/** Immutably replace one slot, returning a new lineup. */
export function withSlotReplaced(
  lineup: readonly PlanDraftDay[],
  deliveryDate: string,
  mealPeriod: PlanDraftMealPeriod,
  next: PlanDraftMealSlot,
): PlanDraftDay[] {
  return lineup.map((day) =>
    day.deliveryDate === deliveryDate
      ? {
          ...day,
          slots: day.slots.map((s) => (s.mealPeriod === mealPeriod ? next : s)),
        }
      : day,
  );
}
