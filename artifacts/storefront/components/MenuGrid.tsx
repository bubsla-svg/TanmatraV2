import type { DishData } from "@workspace/menu-catalog";
import { DishCard } from "@/components/DishCard";

/**
 * Responsive dish grid. Server component. The grid template is fixed-column
 * (not content-driven), so adding rows never reflows existing cards.
 */
export function MenuGrid({ dishes }: { dishes: DishData[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {dishes.map((dish) => (
        <li key={dish.id} className="contents">
          <DishCard dish={dish} />
        </li>
      ))}
    </ul>
  );
}
