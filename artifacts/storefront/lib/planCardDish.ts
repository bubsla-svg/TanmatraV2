import { poolForPlan, type PlanId } from "@workspace/subscription-rules";
import type { DishData } from "@workspace/menu-catalog";
import { DIET_TRACKS } from "./plans";

/**
 * The real dish behind each landing-page plan card.
 *
 * The three protocol cards on `/` used to invent their own contents: a
 * random-image-API photo under alt text asserting a subject the picture did
 * not have ("Weight Loss Meal"), and — on the middle card's "Interactive Macro
 * Spec" — a whole fictional dish, a US salmon bowl shown to Noida lunch
 * buyers, with invented macros, an invented glycemic classification, an
 * invented dietitian's note, and a price borrowed from a DIFFERENT plan's
 * table when its own lookup missed. On a page whose copy claims ISO 22000,
 * FSSAI licensing and ±2 g weighing precision, that is the one set of claims a
 * sceptical visitor can actually check.
 *
 * None of it needed inventing. `poolForPlan()` already knows which dishes a
 * plan rotates, and each dish carries real photography, real macros, its real
 * price and its real veg/RD status. This module picks one such dish per plan;
 * the cards render what it returns and nothing else.
 *
 * Three rules keep it honest, all tested:
 *
 *  1. NO SUBSTITUTES. A plan with no usable dish yields `null` and the card
 *     renders no photo and no spec at all. Filling the hole with a
 *     "close enough" picture or a neighbouring plan's number is precisely the
 *     habit being removed here.
 *  2. NO REPEATS. A dish claimed by an earlier card is skipped, so three
 *     plans never illustrate themselves with one dish.
 *  3. ONLY EVIDENCE-GRADE DISHES. A dish qualifies only with a real image and
 *     macros that are not `macrosProvisional` — that flag means the numbers
 *     are an unresolved placeholder, and a card presenting a dish AS the
 *     evidence for a plan cannot be built on numbers we do not stand behind.
 */
export interface PlanCardDish {
  slug: string;
  name: string;
  /** Proxied catalog path (`/images/dishes/…`) — never an external host. */
  image: string;
  isVeg: boolean;
  /** The dish's own price, in paise. Never another plan's. */
  pricePaise: number;
  macros: { calories: number; protein: number; carbs: number; fat: number; fiber: number };
  /**
   * Macros are ingredient-derived estimates rather than lab values, so the UI
   * prefixes them with "~". Read from the dish; never assumed either way.
   */
  macrosEstimated: boolean;
  /** Only ever `true` for a dish the catalog actually marks RD-verified. */
  rdVerified: boolean;
  /**
   * The dish's own dietitian note, when it has one. No catalog dish carries
   * one today, which is exactly why the card must render nothing rather than
   * fall back to a house sentence that would then appear under every dish.
   */
  rdNote?: string;
  category: string;
}

export type PlanDishMap = Partial<Record<PlanId, PlanCardDish | null>>;

/**
 * Dishes a plan actually rotates, across every diet track.
 *
 * Track order is DIET_TRACKS' own (veg first). A plan card is not track-
 * specific — the buyer picks their track later in the builder — so any dish in
 * the plan's rotation is a truthful illustration of it.
 */
function planRotation(planId: PlanId, dishes: readonly DishData[]): DishData[] {
  const seen = new Set<string>();
  const rotation: DishData[] = [];
  for (const track of DIET_TRACKS) {
    for (const dish of poolForPlan(planId, track, dishes)) {
      if (seen.has(dish.slug)) continue;
      seen.add(dish.slug);
      rotation.push(dish);
    }
  }
  return rotation;
}

function isEvidenceGrade(dish: DishData): boolean {
  return dish.image.trim() !== "" && !dish.macrosProvisional;
}

function project(dish: DishData): PlanCardDish {
  return {
    slug: dish.slug,
    name: dish.name,
    image: dish.image,
    isVeg: dish.isVeg,
    pricePaise: dish.price,
    macros: dish.macros,
    // Absent means reviewed/exact in the catalog's own convention, so the "~"
    // is opt-IN. Defaulting the other way would stamp a hedge on numbers that
    // do not need one.
    macrosEstimated: dish.macrosEstimated === true,
    // Fail closed: only an explicit `true` earns the Verified badge.
    rdVerified: dish.rdVerified === true,
    ...(dish.rdNote ? { rdNote: dish.rdNote } : {}),
    category: dish.category,
  };
}

/**
 * Pick one real dish per plan, in the order given.
 *
 * Deterministic: the same catalog always yields the same dishes, so the page
 * is stable across renders and testable. Earlier plans claim their dish first.
 */
export function pickPlanCardDishes(
  planIds: readonly PlanId[],
  dishes: readonly DishData[],
): PlanDishMap {
  const used = new Set<string>();
  const picked: PlanDishMap = {};

  for (const planId of planIds) {
    const dish = planRotation(planId, dishes).find(
      (d) => !used.has(d.slug) && isEvidenceGrade(d),
    );
    if (dish) {
      used.add(dish.slug);
      picked[planId] = project(dish);
    } else {
      picked[planId] = null;
    }
  }

  return picked;
}
