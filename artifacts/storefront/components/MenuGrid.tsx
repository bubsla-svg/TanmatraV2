"use client";
import type { ReactNode } from "react";
import { groupBySection, sectionAnchorId, NO_PERSONALIZATION_BOOST_SECTION } from "@/lib/menuSections";
import Link from "next/link";

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
      <div role="list" className="flex min-h-[340px] flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface px-5 py-12 text-center">
        <p className="max-w-sm text-sm text-ink-muted">{emptyMessage}</p>
        {onClearFilter ? (
          <button
            type="button"
            onClick={onClearFilter}
            className="mt-3 text-sm font-semibold text-gold-text hover:underline"
          >
            Show all dishes
          </button>
        ) : (
          <Link href="/menu" className="mt-3 inline-block text-sm font-semibold text-gold-text hover:underline">
            Show all dishes
          </Link>
        )}
      </div>
    );
  }

  const sections = groupBySection(rows, (r) => r.sectionOrder).filter((section) =>
    visibleIds ? section.items.some((r) => visibleIds.has(r.dishId)) : section.items.length > 0,
  );

  return (
    <div className="flex flex-col gap-12">
      {sections.map((section) => {
        // Section 13 never gets the personalization boost — see the file
        // header. Every other section applies `order` normally.
        const boosted = section.order !== NO_PERSONALIZATION_BOOST_SECTION;
        // §3.3: the count is of what the customer can actually SEE, not what
        // the section holds. Under an active filter "Bowls · 4" beside two
        // rendered cards would be the header contradicting the list directly
        // beneath it.
        const shown = visibleIds
          ? section.items.filter((r) => visibleIds.has(r.dishId)).length
          : section.items.length;
        return (
          <section key={section.order} id={sectionAnchorId(section.order)} aria-label={section.name} className="scroll-anchor-offset">
            {/* PR-11c: the revision's section header — display face, the
                count in the data face beside it. */}
            <h2 data-testid="menu-section-heading" className="mb-4 font-display text-2xl font-semibold leading-none text-primary">
              {section.name}{" "}
              <span data-testid="menu-section-count" className="font-data text-sm font-normal text-ink-faint">
                · {shown}
              </span>
            </h2>
            {/* The revision's card grid: one column on a phone, two from sm,
                three from lg. `order` still applies (grid honours it). */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" role="list">
              {section.items.map(({ dishId, node }) => (
                <div
                  key={dishId}
                  role="listitem"
                  // PR-11c: no `cv-auto-row` on the revision's card. The
                  // utility (N3.1) reserved 192px per row for the old list
                  // shape; the card is ~3× that, so the reservation would
                  // mis-size every unrendered row and shift the document as
                  // rows materialise — the CLS it was meant to prevent — and
                  // Chromium's lazy render then leaves most of the grid
                  // unlaid-out for seconds after load. `.cv-auto` stays on
                  // the horizontal rails, where item sizes are fixed.
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
