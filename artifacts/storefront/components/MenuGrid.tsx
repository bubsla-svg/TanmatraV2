"use client";
import type { ReactNode } from "react";

export interface MenuGridRow {
  dishId: number;
  node: ReactNode;
}

/**
 * Single-column dish list — Stitch Route Brief 02 v3 (owner-confirmed): one
 * row per dish at every viewport, desktop centered by the page container.
 * ARIA list roles preserved (screen readers announce "list, N items").
 *
 * A genuinely thin CLIENT wrapper — the ONLY reason this file exists as a
 * client component. `rows` are pre-rendered DishCard markup, built
 * server-side by app/menu/page.tsx: this component never constructs or
 * re-renders a dish row, it only applies the personalised order (CSS
 * `order`, requires the flex container below) and the diet-chip visibility
 * (`hidden`) that PersonalizedMenu computes from client-fetched preferences.
 * That split is what keeps DishCard (and everything it renders — Astryx
 * Text, formatPaise, the à-la-carte gate) out of the client bundle; see
 * DishCard.tsx's own header for the RSC-boundary history.
 *
 * `onClearFilter` is optional: PersonalizedMenu owns the active diet chip and
 * can wire a callback here to clear it in place; without one (today) the
 * empty state falls back to a plain link to `/menu`, which still gets a
 * filtered-to-zero visitor back to the full, unfiltered grid.
 */
export function MenuGrid({
  rows,
  order,
  visibleIds,
  emptyMessage = "No dishes match this filter.",
  onClearFilter,
}: {
  rows: MenuGridRow[];
  order?: Map<number, number>;
  visibleIds?: Set<number>;
  emptyMessage?: string;
  onClearFilter?: () => void;
}) {
  const visibleCount = visibleIds
    ? rows.filter((r) => visibleIds.has(r.dishId)).length
    : rows.length;

  if (visibleCount === 0) {
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
      {rows.map(({ dishId, node }) => (
        <div
          key={dishId}
          role="listitem"
          style={order ? { order: order.get(dishId) } : undefined}
          hidden={visibleIds ? !visibleIds.has(dishId) : false}
        >
          {node}
        </div>
      ))}
    </div>
  );
}
