import { poolForPlan, type PlanId } from "@workspace/subscription-rules";
import type { DishData } from "@workspace/menu-catalog";
import { DIET_TRACKS } from "./plans";

/**
 * Real dish photography for the landing page's plan cards.
 *
 * The three protocol cards on `/` illustrated themselves with
 * `picsum.photos/seed/<goal>` — a random-image API — under alt text that
 * asserted a subject the picture did not have ("Weight Loss Meal" over
 * whatever picsum returned that day). On a page whose own copy claims ISO
 * 22000, FSSAI licensing and ±2 g weighing precision, a stock photo captioned
 * as our food is the one thing a sceptical first-time visitor can actually
 * check, and it fails. See scripts/lint-placeholder-assets.ts for the gate
 * that now stops new ones arriving.
 *
 * The fix needs no photo shoot: `poolForPlan()` already knows which dishes a
 * plan actually rotates, and those dishes already carry real photography
 * (`dish.image`, proxied through `/images/*` — the same pipeline /menu, the
 * PDP and /trial render today). So the plan card shows a dish the plan
 * genuinely serves, named honestly in its alt text.
 *
 * Two rules hold this honest, and both are tested:
 *
 *  1. NO FALLBACK PHOTO. When a plan's pool is empty, or the pool's dishes
 *     carry no image, this returns `null` and the card renders no image at
 *     all. Substituting a "close enough" picture is how the placeholders got
 *     here; a card with no photo is honest, a card with someone else's photo
 *     is not.
 *  2. NO REPEATS. A dish already shown on an earlier card is skipped, so
 *     three cards never illustrate three different plans with one photo —
 *     which would read as "these plans are the same food".
 */
export interface PlanPhoto {
  /** Proxied dish image path (`/images/dishes/…`), straight off the catalog. */
  src: string;
  /** The dish's real name. It is the subject of the photo, so it is the alt. */
  alt: string;
}

/** A photo per requested plan; `null` where no real dish photo exists. */
export type PlanPhotoMap = Partial<Record<PlanId, PlanPhoto | null>>;

/**
 * Dishes a plan actually rotates, across every diet track.
 *
 * Track order is DIET_TRACKS' own (veg first). A plan card is not track-
 * specific — the buyer picks their track later in the builder — so any dish
 * in the plan's rotation is a truthful illustration of it.
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

/**
 * Pick one real dish photo per plan, in the order given.
 *
 * Deterministic: the same catalog always yields the same three photos, so the
 * page is stable across renders and snapshot-testable. Earlier plans in the
 * list claim their dish first.
 */
export function pickPlanPhotos(
  planIds: readonly PlanId[],
  dishes: readonly DishData[],
): PlanPhotoMap {
  const used = new Set<string>();
  const photos: PlanPhotoMap = {};

  for (const planId of planIds) {
    const dish = planRotation(planId, dishes).find(
      (d) => !used.has(d.slug) && d.image.trim() !== "",
    );
    if (dish) {
      used.add(dish.slug);
      photos[planId] = { src: dish.image, alt: dish.name };
    } else {
      photos[planId] = null;
    }
  }

  return photos;
}
