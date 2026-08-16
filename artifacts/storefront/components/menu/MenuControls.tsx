"use client";
// Client: controlled search/diet inputs plus the condensed-state focus guard.
import { useState } from "react";
import Link from "next/link";
import { DIET_CHIP_OPTIONS, type DietFilterChip } from "@/lib/dietFilter";

/**
 * The /menu control rows — search + filter trigger, diet chips + ranked note
 * — as ONE collapsing block (owner feedback 2026-08-16: these rows were most
 * of the "~40% of the screen before a single product" complaint).
 *
 * `scrolledDown` is the parent's scroll-direction signal; the focus guard
 * lives HERE because it belongs to these rows: while the keyboard is in the
 * search box the block refuses to collapse — condensing mid-typing would rip
 * the input out from under the caret. grid-rows 1fr→0fr animates the
 * collapse without measuring anything; `inert` takes the hidden controls out
 * of the tab order and the accessibility tree, not just the paint.
 */
export function MenuControls({
  searchQuery,
  onSearchChange,
  chip,
  onChipChange,
  activeFilterCount,
  onOpenFilter,
  showRankedNote,
  scrolledDown,
}: {
  searchQuery: string;
  onSearchChange: (value: string) => void;
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
        <div className="flex flex-col gap-2 pb-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <svg
                aria-hidden
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search dishes…"
                aria-label="Search dishes"
                className="w-full rounded-full border border-line bg-surface py-2 pl-10 pr-4 text-sm text-ink outline-none placeholder:text-ink-faint focus-visible:border-[var(--gold)] focus-visible:ring-1 focus-visible:ring-[var(--gold)]"
              />
            </div>
            {/* The filter trigger lives beside the search box (one "narrow
                the list" row), which is what lets the diet row below stop
                wrapping on narrow screens. Icon + count badge; the testid is
                the contract the specs use. Frosted, not gold — opening a
                sheet is a control, not the screen's action. */}
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
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
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
                    className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-transform active:scale-95 ${
                      active
                        ? "border-gold bg-gold/10 text-gold-text"
                        : "border-line bg-surface text-ink-muted hover:text-ink"
                    }`}
                  >
                    {active && <span aria-hidden>✓ </span>}
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {showRankedNote && (
              <p className="text-2xs text-ink-muted">
                Sorted for your preferences.{" "}
                <Link href="/account/preferences" className="font-medium text-gold-text hover:underline">
                  Edit
                </Link>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
