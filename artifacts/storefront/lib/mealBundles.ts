/**
 * Combo bundles for `/meal-deals` (Stitch brief 18).
 *
 * WHY THIS EXISTS: the bundles used to be a hardcoded array carrying invented
 * `estTotalPaise` amounts (₹1,650 / ₹3,200 / ₹1,750) rendered under the label
 * "Server Authoritative Quote", plus savings claims and plan slugs that are not
 * real PlanIds. Amounts on this surface are now DERIVED from the live catalog:
 * a bundle is a rule over the à-la-carte menu, and its total is the sum of its
 * constituents' server prices. Summing server-owned amounts is a display, not a
 * reprice — the same standing the brief gives "value density per ₹100".
 *
 * There is no discount mechanism behind these bundles, so nothing here claims a
 * saving. If one is introduced, it has to come from the server with the quote.
 */
import { isAlaCarteEnabled, type DishData } from "@workspace/menu-catalog";

/** How a bundle picks its dishes out of the live catalog. */
export type BundleRule = "low_gi_high_fibre" | "high_protein" | "low_gi";

export interface BundleSpec {
  id: string;
  title: string;
  badge: string;
  desc: string;
  /** How many dishes the bundle wants. Fewer may be available. */
  mealCount: number;
  rule: BundleRule;
}

export interface MealBundle extends BundleSpec {
  /** The chosen dishes, in display order. */
  dishes: DishData[];
  /** Sum of the constituents' catalog prices, in paise. */
  totalPaise: number;
  /** False when the catalog could not fill the bundle — the UI must not offer it. */
  complete: boolean;
}

/**
 * Bundle definitions. Copy only: every number a customer sees is computed from
 * the dishes the rule actually selects.
 */
export const BUNDLE_SPECS: BundleSpec[] = [
  {
    id: "metabolic-reset-5d",
    title: "5-Day Metabolic Reset",
    badge: "Steady energy",
    desc: "Five weekday lunches off the low-GI, high-fibre end of the menu — built for blood-sugar stability through the afternoon.",
    mealCount: 5,
    rule: "low_gi_high_fibre",
  },
  {
    id: "protein-pack-10",
    title: "10-Meal Protein Pack",
    badge: "Highest protein",
    desc: "The ten highest-protein bowls on the live menu, for a fortnight of training support.",
    mealCount: 10,
    rule: "high_protein",
  },
  {
    id: "low-gi-balance-5d",
    title: "5-Day Low-GI Balance",
    badge: "Low GI only",
    desc: "Five strictly low-glycaemic lunches — the low-GI end of the menu.",
    mealCount: 5,
    rule: "low_gi",
  },
];

/** Stable ordering so the same catalog always yields the same bundle. */
function bySlug(a: DishData, b: DishData): number {
  return a.slug.localeCompare(b.slug);
}

function candidates(dishes: DishData[], rule: BundleRule): DishData[] {
  // Only cart-addable dishes can make up a bundle whose CTA actually works.
  // Since the full-catalog decision (2026-08-09) that is every dish, so the
  // live constraint is availability — but the predicate stays in the chain so
  // any future re-curation narrows bundles automatically.
  const pool = dishes.filter((d) => isAlaCarteEnabled(d) && d.isAvailable !== false);

  if (rule === "high_protein") {
    return [...pool].sort(
      (a, b) => (b.macros?.protein ?? 0) - (a.macros?.protein ?? 0) || bySlug(a, b),
    );
  }
  if (rule === "low_gi") {
    return [...pool]
      .filter((d) => d.glycaemicIndex === "low")
      .sort((a, b) => (a.macros?.calories ?? 0) - (b.macros?.calories ?? 0) || bySlug(a, b));
  }
  // low_gi_high_fibre
  return [...pool]
    .filter((d) => d.glycaemicIndex !== "high")
    .sort((a, b) => (b.macros?.fiber ?? 0) - (a.macros?.fiber ?? 0) || bySlug(a, b));
}

/** Resolve one spec against the live catalog. */
export function buildBundle(spec: BundleSpec, dishes: DishData[]): MealBundle {
  const chosen = candidates(dishes, spec.rule).slice(0, spec.mealCount);
  const totalPaise = chosen.reduce((sum, d) => sum + d.price, 0);
  return {
    ...spec,
    dishes: chosen,
    totalPaise,
    complete: chosen.length === spec.mealCount,
  };
}

/**
 * Every bundle the catalog can actually fill. An under-filled bundle is dropped
 * rather than shown short: a "5-Day" pack holding three dishes would misprice
 * itself against its own name.
 */
export function buildBundles(dishes: DishData[]): MealBundle[] {
  return BUNDLE_SPECS.map((spec) => buildBundle(spec, dishes)).filter((b) => b.complete);
}

/** One constituent dish as the combo Dialog needs it. */
export interface BundleDishView {
  id: number;
  slug: string;
  name: string;
  pricePaise: number;
}

/** A bundle trimmed to what crosses to the client island. */
export interface BundleView {
  id: string;
  title: string;
  badge: string;
  desc: string;
  mealCount: number;
  totalPaise: number;
  dishes: BundleDishView[];
}

/**
 * Slim a bundle for the client. DishData is large and the combo card needs four
 * fields per dish, so the full catalog rows never cross the boundary.
 */
export function toBundleView(bundle: MealBundle): BundleView {
  return {
    id: bundle.id,
    title: bundle.title,
    badge: bundle.badge,
    desc: bundle.desc,
    mealCount: bundle.mealCount,
    totalPaise: bundle.totalPaise,
    dishes: bundle.dishes.map((d) => ({
      id: d.id,
      slug: d.slug,
      name: d.name,
      pricePaise: d.price,
    })),
  };
}
