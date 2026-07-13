// ─────────────────────────────────────────────────────────────────────────────
// Checkout safety decisions (pure, DB-free — unit-testable without a database).
//
// The server-side allergen/RD-review safety gate must run on EVERY checkout,
// including guest (unauthenticated) orders — the primary anonymous path. This
// module holds the pure decision logic so it can be exercised in isolation; the
// `POST /orders` route wires it to the request/DB. Keeping it here (importing
// only the pure `@workspace/preferences-match` + `@workspace/menu-catalog`
// packages, never `@workspace/db`) is what lets the test run without Postgres.
// ─────────────────────────────────────────────────────────────────────────────

import {
  evaluateDishForPreferences,
  type BlockReason,
  type DietaryStyle,
  type PreferencesForMatch,
} from "@workspace/preferences-match";
import type { DishData } from "@workspace/menu-catalog";

/** Optional dietary-safety declaration a guest can send with their order. */
export interface GuestPrefsInput {
  allergens?: string[];
  dislikedIngredients?: string[];
  medicalConditions?: string[];
  cuisines?: string[];
  dietaryStyle?: DietaryStyle;
}

/**
 * Normalize a guest's declared preferences into the evaluator's shape, or null
 * when the guest declared nothing. `dietaryStyle` defaults to "omnivore" so an
 * undeclared style never accidentally triggers a diet block.
 */
export function normalizeGuestPrefs(input?: GuestPrefsInput | null): PreferencesForMatch | null {
  if (!input) return null;
  return {
    allergens: input.allergens ?? [],
    dislikedIngredients: input.dislikedIngredients ?? [],
    medicalConditions: input.medicalConditions ?? [],
    cuisines: input.cuisines ?? [],
    dietaryStyle: input.dietaryStyle ?? "omnivore",
  };
}

/**
 * Strict per-dish safety evaluation. Returns the blocking reasons when the dish
 * must be refused, or null when it is clear. Passing `effectivePrefs === null`
 * still enforces the strict RD-review gate (an unreviewed/blocked dish is
 * refused even for a guest who declared nothing).
 */
export function findDishSafetyBlock(
  dish: DishData,
  effectivePrefs: PreferencesForMatch | null,
): BlockReason[] | null {
  const match = evaluateDishForPreferences(dish, effectivePrefs, { strict: true });
  return match.blocked ? match.blockReasons : null;
}

export interface AllergenAckDecision {
  /** True when the order must be resubmitted with an explicit acknowledgement. */
  required: boolean;
  /** Union of the allergens present across the flagged cart dishes. */
  allergens: string[];
  /** Names of the dishes that carry allergens/contraindications. */
  dishes: string[];
}

/**
 * Decide whether a guest who declared no allergens/conditions must explicitly
 * acknowledge allergen risk before the order is accepted. This closes the gap
 * where an anonymous buyer silently skips all dietary screening: if the cart
 * contains any dish with declared allergens or contraindications and the buyer
 * neither declared safety info nor acknowledged the risk, the order is held.
 *
 * The ack is only forced for guests. Authenticated users and guests who
 * declared any allergen/medical-condition have made an informed choice and are
 * not interrupted (their declarations are enforced by `findDishSafetyBlock`).
 */
export function assessAllergenAck(opts: {
  isGuest: boolean;
  effectivePrefs: PreferencesForMatch | null;
  cartDishes: DishData[];
  allergenAck?: boolean;
}): AllergenAckDecision {
  const empty: AllergenAckDecision = { required: false, allergens: [], dishes: [] };
  const declaredSafety =
    (opts.effectivePrefs?.allergens.length ?? 0) > 0 ||
    (opts.effectivePrefs?.medicalConditions?.length ?? 0) > 0;
  if (!opts.isGuest || declaredSafety || opts.allergenAck === true) return empty;

  const flagged = opts.cartDishes.filter(
    (d) => (d.allergens?.length ?? 0) > 0 || (d.contraindications?.length ?? 0) > 0,
  );
  if (flagged.length === 0) return empty;

  const allergens = [...new Set(flagged.flatMap((d) => d.allergens ?? []))];
  return { required: true, allergens, dishes: flagged.map((d) => d.name) };
}
