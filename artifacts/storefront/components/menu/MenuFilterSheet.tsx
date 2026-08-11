"use client";
// "use client" justification: Stitch 5.3 — a bottom sheet with multi-select chip
// state and focus management. Inherently interactive; the menu around it stays RSC.
import { useEffect, useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import {
  ALLERGEN_OPTIONS,
  DIETARY_OPTIONS,
  EMPTY_FILTERS,
  GOAL_OPTIONS,
  MACRO_OPTIONS,
  countActiveFilters,
  toggleFilter,
  type FilterGroupKey,
  type FilterOption,
  type MenuFilterState,
} from "@/lib/menuFilters";

/**
 * Menu filter sheet (Stitch 5.3).
 *
 * Chip selection is styled exactly like the diet chips in PersonalizedMenu — a
 * border + 10% tint + a ✓ marker, never a solid --gold fill. Two reasons, both
 * binding: DS-0 keeps gold as the single ACTION colour and this screen's one
 * gold action is the Apply CTA in the footer; and WCAG 1.4.1 forbids conveying
 * selection by colour alone, which the marker plus `aria-pressed` satisfies
 * independently of the tint.
 *
 * Draft-then-apply, not live-apply: edits accumulate in local state and only
 * reach the menu on Apply. A live-applied multi-select sheet re-sorts the grid
 * underneath the customer while their thumb is still moving down the chip list.
 */
export function MenuFilterSheet({
  open,
  onOpenChange,
  filters,
  onApply,
  matchCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: MenuFilterState;
  onApply: (next: MenuFilterState) => void;
  /** How many dishes the DRAFT currently matches — drives the CTA label. */
  matchCount: (draft: MenuFilterState) => number;
}) {
  const [draft, setDraft] = useState<MenuFilterState>(filters);

  // Re-seed whenever the sheet opens so a dismissed draft never leaks into the
  // next session of the sheet.
  useEffect(() => {
    if (open) setDraft(filters);
  }, [open, filters]);

  const count = matchCount(draft);
  const activeCount = countActiveFilters(draft);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        data-ui-generation="stitch-74"
        data-screen-id="5.3"
        data-screen-state="filter-sheet-open"
        data-testid="menu-filter-sheet"
      >
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-3">
          <DrawerTitle className="text-lg font-semibold tracking-tight text-ink">
            Filter meals
          </DrawerTitle>
          <DrawerDescription className="mt-1 text-xs text-ink-muted">
            Narrows what you see. Allergen handling in the kitchen follows our published
            preparation policy.
          </DrawerDescription>

          <ChipGroup
            label="Goal"
            group="goal"
            options={GOAL_OPTIONS}
            selected={draft.goal}
            onToggle={setDraft}
            draft={draft}
          />
          <ChipGroup
            label="What you eat"
            group="dietary"
            options={DIETARY_OPTIONS}
            selected={draft.dietary}
            onToggle={setDraft}
            draft={draft}
          />
          <ChipGroup
            label="Allergens to avoid"
            group="allergen"
            options={ALLERGEN_OPTIONS}
            selected={draft.allergen}
            onToggle={setDraft}
            draft={draft}
          />
          <ChipGroup
            label="Macro intent"
            group="macro"
            options={MACRO_OPTIONS}
            selected={draft.macro}
            onToggle={setDraft}
            draft={draft}
          />
        </div>

        {/* Footer is a sibling of the scroll area, not its last child, so the
            Apply CTA never scrolls out of reach — same contract DishDrawer keeps. */}
        <div className="flex shrink-0 items-center gap-3 border-t border-line bg-surface px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3">
          <button
            type="button"
            onClick={() => setDraft(EMPTY_FILTERS)}
            disabled={activeCount === 0}
            className="min-h-[44px] shrink-0 rounded-full border border-line bg-surface-raised px-5 text-sm font-semibold text-ink transition-transform active:scale-95 disabled:opacity-40"
          >
            Clear filters
          </button>
          <button
            type="button"
            onClick={() => {
              onApply(draft);
              onOpenChange(false);
            }}
            data-testid="menu-filter-apply"
            className="min-h-[48px] flex-1 rounded-full bg-gold px-5 text-sm font-bold text-[var(--gold-ink)] transition-transform active:scale-[0.98]"
          >
            {count === 0 ? "No meals match" : `Show ${count} ${count === 1 ? "meal" : "meals"}`}
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function ChipGroup<K extends FilterGroupKey>({
  label,
  group,
  options,
  selected,
  draft,
  onToggle,
}: {
  label: string;
  group: K;
  options: FilterOption<MenuFilterState[K][number]>[];
  selected: readonly MenuFilterState[K][number][];
  draft: MenuFilterState;
  onToggle: (next: MenuFilterState) => void;
}) {
  return (
    <section className="mt-5">
      <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">{label}</h3>
      <div role="group" aria-label={label} className="mt-2 flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = selected.includes(opt.key);
          return (
            <button
              key={String(opt.key)}
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(toggleFilter(draft, group, opt.key))}
              className={`min-h-[44px] rounded-full border px-4 text-xs font-semibold transition-transform active:scale-95 ${
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
    </section>
  );
}
