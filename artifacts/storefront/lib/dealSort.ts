/**
 * Budget-Conscious Shopper algorithm (PRD Feature #9).
 * Computes nutritional value efficiency (e.g. grams of protein per ₹100 spent)
 * without altering server-authoritative money pricing.
 * Strictly uses relative imports within lib/.
 */
import type { DishData } from "@workspace/menu-catalog";

export type ValueMetric = "protein_per_rupee" | "fiber_per_rupee" | "calorie_density" | "price_low";

export interface DishValueScore {
  dish: DishData;
  score: number;
  valueLabel: string;
}

/**
 * Score and order menu items by macro density per monetary unit.
 * Price in catalog is in paise (dish.price), so ₹1 = dish.price / 100.
 */
export function evaluateDishValue(dish: DishData, metric: ValueMetric): DishValueScore {
  const rupees = (dish.price ?? 35000) / 100;
  const protein = dish.macros?.protein ?? 0;
  const fiber = dish.macros?.fiber ?? 0;
  const calories = dish.macros?.calories ?? 0;

  if (metric === "protein_per_rupee") {
    const perHundred = (protein / rupees) * 100;
    return {
      dish,
      score: perHundred,
      valueLabel: `${perHundred.toFixed(1)}g Protein per ₹100`,
    };
  }

  if (metric === "fiber_per_rupee") {
    const perHundred = (fiber / rupees) * 100;
    return {
      dish,
      score: perHundred,
      valueLabel: `${perHundred.toFixed(1)}g Fiber per ₹100`,
    };
  }

  if (metric === "calorie_density") {
    const perHundred = (calories / rupees) * 100;
    return {
      dish,
      score: perHundred,
      valueLabel: `${Math.round(perHundred)} kcal per ₹100`,
    };
  }

  return {
    dish,
    score: -rupees,
    valueLabel: `₹${rupees.toFixed(0)}`,
  };
}

export function sortDishesByValue(dishes: DishData[], metric: ValueMetric): DishValueScore[] {
  return dishes
    .filter((d) => (d.price ?? 0) > 0 && d.isAvailable !== false)
    .map((d) => evaluateDishValue(d, metric))
    .sort((a, b) => b.score - a.score);
}
