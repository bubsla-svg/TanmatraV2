"use client";
import { useMemo, useState, type ReactNode } from "react";
import { capVisibleIds } from "@/lib/menuGridState";

export interface MenuGridRow {
  dishId: number;
  node: ReactNode;
}

// OA-MED-1.19: /menu rendered every diet-filtered dish's DOM node at once
// (~124 on "all"). Cap the initial render and reveal more on demand — the
// same `.slice(0, N)` + "show more" shape already used by DealsFilterBar
// and SmartRecommendationsGrid.
const INITIAL_VISIBLE_COUNT = 20;
const SHOW_MORE_STEP = 20;

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
  const [limit, setLimit] = useState(INITIAL_VISIBLE_COUNT);

  const effectiveVisibleIds = useMemo(
    () => visibleIds ?? new Set(rows.map((r) => r.dishId)),
    [visibleIds, rows],
  );
  const visibleCount = effectiveVisibleIds.size;

  const cappedIds = useMemo(
    () => capVisibleIds(rows.map((r) => r.dishId), order, effectiveVisibleIds, limit),
    [rows, order, effectiveVisibleIds, limit],
  );
  const remaining = visibleCount - limit;

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
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3" role="list">
        {rows.map(({ dishId, node }) => (
          <div
            key={dishId}
            role="listitem"
            style={order ? { order: order.get(dishId) } : undefined}
            hidden={!cappedIds.has(dishId)}
          >
            {node}
          </div>
        ))}
      </div>
      {remaining > 0 && (
        <button
          type="button"
          onClick={() => setLimit((l) => l + SHOW_MORE_STEP)}
          className="self-center rounded-full border border-line px-6 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-line-strong hover:bg-surface-raised"
        >
          Show {Math.min(SHOW_MORE_STEP, remaining)} more dishes
        </button>
      )}
    </div>
  );
}
