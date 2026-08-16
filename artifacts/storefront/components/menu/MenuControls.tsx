"use client";
// Client: controlled diet inputs plus the condensed-state focus guard.
import { useState } from "react";
import Link from "next/link";
import { DIET_CHIP_OPTIONS, type DietFilterChip } from "@/lib/dietFilter";

/**
 * The /menu control row — diet chips, the filter trigger, and the ranked
 * note — as ONE collapsing block (owner feedback 2026-08-16: these rows were
 * most of the "~40% of the screen before a single product" complaint).
 *
 * It is ONE row now, not two. The dish-name search box that used to own the
 * first row was removed on owner instruction: the Header's ⌘K command menu
 * already searches the same catalog from every route, so an inline duplicate
 * cost a full row of the first viewport to offer a narrower version of a
 * control that was already on screen. Deleting it is what lets the filter
 * trigger sit beside the diet chips instead of above them.
 *
 * `scrolledDown` is the parent's scroll-direction signal. The focus guard
 * lives HERE because it belongs to these controls: while a chip or the
 * filter trigger holds keyboard focus the block refuses to collapse, so
 * tabbing never pulls the focused control out from under the user. grid-rows
 * 1fr→0fr animates the collapse without measuring anything; `inert` takes
 * the hidden controls out of the tab order and the accessibility tree, not
 * just the paint.
 */
export function MenuControls({
  chip,
  onChipChange,
  activeFilterCount,
  onOpenFilter,
  showRankedNote,
  scrolledDown,
}: {
  chip: DietFilterChip;
  onChipChange: (chip: DietFilterChip) => void;
  activeFilterCount: number;
  onOpenFilter: () => void;
  showRankedNote: boolean;
  scrolledDown: boolean;
}) {
  const [controlsFocused, setControlsFocused] = useState(false);
  const condensed = scrolledDown && !controlsFocused;

  return (
    <div
      inert={condensed}
      onFocus={() => setControlsFocused(true)}
      onBlur={() => setControlsFocused(false)}
      className={`grid transition-[grid-template-rows,opacity] duration-200 motion-reduce:transition-none ${
        condensed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
      }`}
    >
      <div className="min-h-0 overflow-hidden">
        {/* One row, wrapping: chips first (the cheap, one-tap narrowing),
            then the sheet trigger, then the ranked note pushed to the end.
            `flex-wrap` rather than a fixed grid because the note's width is
            copy-dependent — on a narrow phone it drops to its own line
            instead of squeezing the chips it is describing. */}
        <div className="flex flex-wrap items-center gap-2 pb-2">
          <div role="group" aria-label="Filter dishes by diet" className="flex items-center gap-1.5">
            {DIET_CHIP_OPTIONS.map((opt) => {
              const active = chip === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => onChipChange(opt.key)}
                  aria-pressed={active}
                  // D-08: selection state, not a rival action colour —
                  // border + tint + marker, never a solid --gold fill.
                  // min-h-9 (36px) keeps the row shorter than the 44px
                  // filter trigger beside it while staying above the WCAG
                  // 2.2 AA 24px target minimum. `gap-1` carries the space
                  // after the ✓, NOT a trailing space inside the span: this
                  // is a flex container, and flex items get their leading
                  // and trailing whitespace trimmed, which silently
                  // rendered "✓All".
                  className={`inline-flex min-h-9 items-center gap-1 rounded-full border px-4 text-xs font-semibold transition-transform active:scale-95 ${
                    active
                      ? "border-gold bg-gold/10 text-gold-text"
                      : "border-line bg-surface text-ink-muted hover:text-ink"
                  }`}
                >
                  {active && <span aria-hidden>✓</span>}
                  {opt.label}
                </button>
              );
            })}
          </div>
          {/* Icon + count badge; the testid is the contract the specs use.
              Frosted, not gold — opening a sheet is a control, not the
              screen's action. */}
          <button
            type="button"
            onClick={onOpenFilter}
            data-testid="menu-filter-trigger"
            aria-label={activeFilterCount > 0 ? `Filter (${activeFilterCount} active)` : "Filter"}
            className="relative flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line bg-surface-raised text-ink transition-transform active:scale-95"
          >
            <svg
              aria-hidden
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="4" y1="6" x2="20" y2="6" />
              <circle cx="9" cy="6" r="2" fill="var(--surface-raised)" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <circle cx="15" cy="12" r="2" fill="var(--surface-raised)" />
              <line x1="4" y1="18" x2="20" y2="18" />
              <circle cx="7" cy="18" r="2" fill="var(--surface-raised)" />
            </svg>
            {activeFilterCount > 0 && (
              <span
                aria-hidden
                className="tabular absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-3xs font-bold text-[var(--gold-ink)]"
              >
                {activeFilterCount}
              </span>
            )}
          </button>
          {showRankedNote && (
            <p className="ml-auto text-2xs text-ink-muted">
              Sorted for your preferences.{" "}
              <Link href="/account/preferences" className="font-medium text-gold-text hover:underline">
                Edit
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
