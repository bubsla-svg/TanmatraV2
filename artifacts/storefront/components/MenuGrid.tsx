import type { DishData } from "@workspace/menu-catalog";
import { DishCard } from "@/components/DishCard";
import type { DishFit } from "@/lib/menuFit";

/**
 * Responsive dish grid. The grid template is fixed-column (not content-driven),
 * so adding rows never reflows existing cards. An optional per-dish `fits` map
 * (keyed by dish id) drives the personalisation badge — absent for the plain,
 * un-personalised menu.
 */
export function MenuGrid({
  dishes,
  fits,
}: {
  dishes: DishData[];
  fits?: Map<number, DishFit>;
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {dishes.map((dish) => (
        <li key={dish.id} className="contents">
          <DishCard dish={dish} fit={fits?.get(dish.id)} />
        </li>
      ))}
    </ul>
  );
}
