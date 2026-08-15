"use client";
import type { ReactNode } from "react";
import { groupBySection, NO_PERSONALIZATION_BOOST_SECTION } from "@/lib/menuSections";

export interface MenuGridRow {
  dishId: number;
  node: ReactNode;
  /** TNM-MENU-01 §5 fixed section (1-13). Undefined sinks the row into a
   *  trailing "More dishes" bucket instead of being dropped. */
  sectionOrder?: number;
}

/**
 * TNM-MENU-01 M-5: thirteen fixed §5 sections in order, each its own
 * single-column dish list (Stitch Route Brief 02 v3 row shape preserved
 * within a section). ARIA: each section is a labelled list of its own
 * (`aria-label` from the heading, `role="list"`/`role="listitem"`) rather
 * than one page-wide list, so a screen reader announces section boundaries.
 *
 * A genuinely thin CLIENT wrapper — the ONLY reason this file exists as a
 * client component. `rows` are pre-rendered DishCard markup, built
 * server-side by app/menu/page.tsx: this component never constructs or
 * re-renders a dish row, it only groups rows by `sectionOrder`, applies the
 * personalised order (CSS `order`, requires the flex container below) and
 * the diet-chip visibility (`hidden`) that PersonalizedMenu computes from
 * client-fetched preferences. That split is what keeps DishCard (and
 * everything it renders — Astryx Text, formatPaise, the à-la-carte gate)
 * out of the client bundle; see DishCard.tsx's own header for the
 * RSC-boundary history.
 *
 * Personalization re-ranks within a section (high-fit dishes rise inside
 * their own section via CSS `order`) but never hides — the `hidden`
 * attribute is driven only by the diet chip / filter sheet / search, which
 * are user-initiated. Section 13 ("Off the Wok") is excluded from the
 * re-rank (`NO_PERSONALIZATION_BOOST_SECTION`) and always renders in its
 * natural row order — its dishes are mostly needs-macros/needs-cogs gated
 * and unfinished, so a fit score would surface half-verified dishes ahead
 * of (or bury them behind) the governed catalog.
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

  const sections = groupBySection(rows, (r) => r.sectionOrder).filter((section) =>
    visibleIds ? section.items.some((r) => visibleIds.has(r.dishId)) : section.items.length > 0,
  );

  return (
    <div className="flex flex-col gap-8">
      {sections.map((section) => {
        // Section 13 never gets the personalization boost — see the file
        // header. Every other section applies `order` normally.
        const boosted = section.order !== NO_PERSONALIZATION_BOOST_SECTION;
        return (
          <section key={section.order} aria-label={section.name}>
            <h2 data-testid="menu-section-heading" className="mb-3 text-lg font-semibold tracking-tight text-ink">
              {section.name}
            </h2>
            <div className="flex flex-col gap-3" role="list">
              {section.items.map(({ dishId, node }) => (
                <div
                  key={dishId}
                  role="listitem"
                  // N3.1: content-visibility:auto skips layout+paint for rows
                  // the viewport hasn't reached yet — the 116-dish grid
                  // otherwise builds full layout for every card up front.
                  // See globals.css's .cv-auto-row for why this is a
                  // SEPARATE utility from .cv-auto (horizontal rails) rather
                  // than a reuse.
                  className="cv-auto-row"
                  style={order && boosted ? { order: order.get(dishId) } : undefined}
                  hidden={visibleIds ? !visibleIds.has(dishId) : false}
                >
                  {node}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
