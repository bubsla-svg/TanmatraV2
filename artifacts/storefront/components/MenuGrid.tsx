import type { DishData } from "@workspace/menu-catalog";
import { DishCard } from "@/components/DishCard";
import type { DishFit } from "@/lib/menuFit";

/**
 * Single-column dish list — Stitch Route Brief 02 v3 (owner-confirmed): one
 * row per dish at every viewport, desktop centered by the page container.
 * ARIA list roles preserved (screen readers announce "list, N items").
 * Server component: only DishCard's client primitives ship.
 *
 * `onClearFilter` is optional: PersonalizedMenu owns the active diet chip and
 * can wire a callback here to clear it in place; without one (today) the
 * empty state falls back to a plain link to `/menu`, which still gets a
 * filtered-to-zero visitor back to the full, unfiltered grid.
 */
export function MenuGrid({
  dishes,
  fits,
  emptyMessage = "No dishes match this filter.",
  onClearFilter,
}: {
  dishes: DishData[];
  fits?: Map<number, DishFit>;
  emptyMessage?: string;
  onClearFilter?: () => void;
}) {
  if (dishes.length === 0) {
    return (
      <div role="list" className="rounded-2xl border border-dashed border-line px-6 py-12 text-center">
        <p className="text-sm text-ink-muted">{emptyMessage}</p>
        {onClearFilter ? (
          <button
            type="button"
            onClick={onClearFilter}
            className="mt-3 text-sm font-semibold text-gold-text hover:underline"
          >
            Show all dishes
          </button>
        ) : (
          <a href="/menu" className="mt-3 inline-block text-sm font-semibold text-gold-text hover:underline">
            Show all dishes
          </a>
        )}
      </div>
    );
  }

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
