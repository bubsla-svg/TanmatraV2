import { poolForPlan, type PlanId } from "@workspace/subscription-rules";
import type { DishData } from "@workspace/menu-catalog";
import type { DietTrack } from "./api";
import { buildSharedMacroKeys, macroTrust } from "./dishTrust";

/**
 * What the customer is being offered, stated before they are asked for
 * anything (Laws 1, 8).
 *
 * The plan checkout's first ask is now the PIN code. Above it there was the
 * plan's NAME and nothing else — so the first question came before any of the
 * three facts that decide whether the answer is worth giving: which dishes
 * actually arrive, when they arrive, and what the whole thing costs.
 *
 * Every figure here is read, not authored. The dishes come from the plan's own
 * rotation (`poolForPlan` — the same function that decides what really gets
 * cooked), the macros are the dishes' own, the window is the same constant the
 * create call books with, and the price is the spine quote the host page
 * already computes. Nothing on this screen is a marketing approximation of
 * something the system does differently.
 */

export interface PlanOfferDish {
  slug: string;
  name: string;
  /** Catalog photo for the 40px thumbnail (T-16). Optional so a host that
   *  has none renders the row without a frame rather than a broken image. */
  image?: string;
  /** Absent when the catalog has nothing trustworthy to say — the row then
   *  carries a name only, never a filled-in number (Law 8). */
  macros?: { calories: number; protein: number };
  /** The dish's own flag — the UI prefixes an estimate with "≈". */
  macrosEstimated: boolean;
}

export interface PlanOffer {
  /** A sample of the plan's real rotation. Empty is a legitimate answer. */
  dishes: PlanOfferDish[];
  /** True when the rotation is larger than the sample shown. */
  more: number;
  mealsPerCycle: number;
  cycleTotalPaise: number;
  cadence: string;
}

/**
 * A sample of the dishes a plan actually rotates, across the tracks it serves.
 *
 * Evidence-grade only, judged by `macroTrust` over the dishes actually being
 * shown — not by `macrosProvisional` alone, which is what this used to test.
 *
 * That flag was the weaker check. F-1 (#50) established that the duplication
 * lives in the DB payload rather than the static catalog: 93 live dishes share
 * macros drawn from 32 tuples, and only 15 of them carried a flag the old
 * gate could see. #57 then fixed the merge so a DB-supplied number and its
 * trust flag travel together — but the render guard is still the belt to that
 * braces, and `buildSharedMacroKeys` is the half that catches a copied tuple no
 * flag has been set on. Passing the RENDERED set is load-bearing: duplication
 * is a property of the payload in hand, so a set built from anywhere else
 * finds nothing.
 *
 * The screen exists to be checked. Showing a number nothing stands behind, to
 * someone deciding whether to hand over a PIN code, is worse than showing one
 * dish fewer.
 *
 * Deterministic — same catalog, same sample — so the screen is stable across
 * renders and the test can assert on it.
 */
export function planOfferDishes(
  planId: PlanId,
  tracks: readonly DietTrack[],
  dishes: readonly DishData[],
  limit: number,
): { dishes: PlanOfferDish[]; more: number } {
  const seen = new Set<string>();
  const rotation: DishData[] = [];
  // Built once from the catalog being rendered — see the note above on why the
  // set must come from the payload in hand.
  const sharedMacroKeys = buildSharedMacroKeys(dishes);
  for (const track of tracks) {
    for (const dish of poolForPlan(planId, track, dishes)) {
      if (seen.has(dish.slug)) continue;
      if (macroTrust(dish, sharedMacroKeys) === "unverified") continue;
      seen.add(dish.slug);
      rotation.push(dish);
    }
  }
  return {
    dishes: rotation.slice(0, limit).map((d) => ({
      slug: d.slug,
      name: d.name,
      image: d.image,
      macros: { calories: d.macros.calories, protein: d.macros.protein },
      // Absent means reviewed in the catalog's convention, so the hedge is
      // opt-in — same reading as planCardDish.
      macrosEstimated: d.macrosEstimated === true,
    })),
    more: Math.max(0, rotation.length - limit),
  };
}
