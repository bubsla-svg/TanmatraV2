import type { DishData } from "@workspace/menu-catalog";
import { DishCard } from "@/components/DishCard";
import type { DishFit } from "@/lib/menuFit";

/**
 * Single-column dish list — Stitch Route Brief 02 v3 (owner-confirmed): one
 * row per dish at every viewport, desktop centered by the page container.
 * ARIA list roles preserved (screen readers announce "list, N items").
 * Server component: only DishCard's client primitives ship.
 */
export function MenuGrid({
  dishes,
  fits,
}: {
  dishes: DishData[];
  fits?: Map<number, DishFit>;
}) {
  return (
    <div className="flex flex-col gap-3" role="list">
      {dishes.map((dish) => (
        <div key={dish.id} role="listitem">
          <DishCard dish={dish} fit={fits?.get(dish.id)} />
        </div>
      ))}
    </div>
  );
}
