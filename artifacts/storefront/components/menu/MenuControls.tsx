"use client";
// Client: controlled diet chips, goal toggles and the filter-sheet trigger.
import { DIET_CHIP_OPTIONS, type DietFilterChip } from "@/lib/dietFilter";
import { GOAL_OPTIONS, type GoalFilter } from "@/lib/menuFilters";

/**
 * The leading items of /menu's ONE control strip (T-13, T-14).
 *
 * There used to be two rows — diet chips + an icon-only filter trigger on one,
 * the section chips on another — pinned together under the header: 238px of
 * chrome before the first dish. Everything now rides in the SAME horizontal
 * rail as the section chips (SectionChipBar's `leading` slot), one 48px row:
 *
 *   All · Veg · Non-veg · [Filters (2)] · Fat loss · High protein · … │ Bowls · Wraps …
 *
 * The filter trigger says "Filters" now, not just a sliders glyph, and the
 * five goal chips — the product's thesis — are reachable without opening the
 * sheet. Selection is border + tint + ✓, never a solid gold fill (D-08): the
 * mini-cart bar is this screen's one gold action.
 */
export function MenuControls({
  chip,
  onChipChange,
  activeFilterCount,
  onOpenFilter,
  goals,
  onToggleGoal,
}: {
  chip: DietFilterChip;
  onChipChange: (chip: DietFilterChip) => void;
  activeFilterCount: number;
  onOpenFilter: () => void;
  goals: readonly GoalFilter[];
  onToggleGoal: (goal: GoalFilter) => void;
}) {
  const chipCls = (active: boolean) =>
    `inline-flex min-h-11 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-3.5 text-xs font-semibold transition-transform active:scale-95 ${
      active ? "border-gold bg-primary/10 text-primary" : "border-transparent bg-secondary text-ink-muted hover:text-ink"
    }`;

  return (
    <>
      <div role="group" aria-label="Filter dishes by diet" className="flex shrink-0 items-center gap-1.5">
        {DIET_CHIP_OPTIONS.map((opt) => {
          const active = chip === opt.key;
          return (
            <button key={opt.key} type="button" onClick={() => onChipChange(opt.key)} aria-pressed={active} className={chipCls(active)}>
              {/* `gap-1` carries the space after the ✓ — flex trims a
                  trailing space inside the span, which rendered "✓All". */}
              {active && <span aria-hidden>✓</span>}
              {opt.label}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onOpenFilter}
        data-testid="menu-filter-trigger"
        aria-label={activeFilterCount > 0 ? `Filters (${activeFilterCount} active)` : "Filters"}
        className="inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-transparent bg-secondary px-3.5 text-xs font-semibold text-ink transition-transform active:scale-95"
      >
        <svg aria-hidden className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="6" x2="20" y2="6" />
          <circle cx="9" cy="6" r="2" fill="var(--surface-raised)" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <circle cx="15" cy="12" r="2" fill="var(--surface-raised)" />
          <line x1="4" y1="18" x2="20" y2="18" />
          <circle cx="7" cy="18" r="2" fill="var(--surface-raised)" />
        </svg>
        Filters
        {activeFilterCount > 0 && (
          <span aria-hidden className="tabular flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-2xs font-bold text-amber-ink">
            {activeFilterCount}
          </span>
        )}
      </button>

      <div role="group" aria-label="Goal" className="flex shrink-0 items-center gap-1.5">
        {GOAL_OPTIONS.map((opt) => {
          const active = goals.includes(opt.key);
          return (
            <button key={opt.key} type="button" onClick={() => onToggleGoal(opt.key)} aria-pressed={active} className={chipCls(active)}>
              {active && <span aria-hidden>✓</span>}
              {opt.label}
            </button>
          );
        })}
      </div>

      <span aria-hidden className="mx-0.5 h-6 w-px shrink-0 self-center bg-line" />
    </>
  );
}
