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
  KCAL_MAX_RANGE,
  MACRO_OPTIONS,
  PROTEIN_MIN_RANGE,
  countActiveFilters,
  setBound,
  toggleFilter,
  type FilterGroupKey,
  type FilterOption,
  type MenuFilterState,
} from "@/lib/menuFilters";

/**
 * Menu filter sheet (Stitch 5.3), now as ACCORDIONS (T-14): Goal open by
 * default, the rest collapsed, every header a 48px row — so at most one
 * group sits above the fold and "Macro intent" is no longer buried. Two
 * native range inputs give the "≥ 30 g protein under 500 kcal" shopper a
 * numeric handle; the count on the Apply CTA updates on every `input`.
 *
 * Chip selection stays border + 10% tint + ✓, never a solid --gold fill:
 * gold is the single ACTION colour and this screen's one gold action is the
 * Apply CTA (D-08), and WCAG 1.4.1 forbids conveying selection by colour
 * alone. Draft-then-apply: edits reach the menu only on Apply.
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
          <DrawerTitle className="font-display text-2xl font-semibold leading-tight text-primary">
            Filter meals
          </DrawerTitle>
          <DrawerDescription className="mt-1 text-xs text-ink-muted">
            Narrows what you see. Allergen handling in the kitchen follows our published
            preparation policy.
          </DrawerDescription>

          <div className="mt-3 divide-y divide-line border-y border-line">
            <ChipGroup label="Goal" group="goal" options={GOAL_OPTIONS} selected={draft.goal} onToggle={setDraft} draft={draft} defaultOpen />
            <ChipGroup label="What you eat" group="dietary" options={DIETARY_OPTIONS} selected={draft.dietary} onToggle={setDraft} draft={draft} />
            <ChipGroup label="Allergens to avoid" group="allergen" options={ALLERGEN_OPTIONS} selected={draft.allergen} onToggle={setDraft} draft={draft} />
            <ChipGroup label="Macro intent" group="macro" options={MACRO_OPTIONS} selected={draft.macro} onToggle={setDraft} draft={draft}>
              <BoundsGroup draft={draft} onChange={setDraft} />
            </ChipGroup>
          </div>
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
            className="min-h-[48px] flex-1 rounded-full bg-gold px-5 text-sm font-bold text-gold-ink transition-transform active:scale-[0.98]"
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
  defaultOpen = false,
  children,
}: {
  label: string;
  group: K;
  options: FilterOption<MenuFilterState[K][number]>[];
  selected: readonly MenuFilterState[K][number][];
  draft: MenuFilterState;
  onToggle: (next: MenuFilterState) => void;
  defaultOpen?: boolean;
  children?: React.ReactNode;
}) {
  const picked = selected.length;
  return (
    <details open={defaultOpen} className="group">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-2 [&::-webkit-details-marker]:hidden">
        <span className="text-[10px] font-bold uppercase tracking-[.16em] text-ink-muted">
          {label}
          {picked > 0 && <span className="font-data ml-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-2xs text-primary">{picked}</span>}
        </span>
        <span aria-hidden className="text-ink-faint transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div role="group" aria-label={label} className="flex flex-wrap gap-2 pb-4">
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
                  ? "border-gold bg-primary/10 text-primary"
                  : "border-transparent bg-secondary text-ink-muted hover:text-ink"
              }`}
            >
              {active && <span aria-hidden>✓ </span>}
              {opt.label}
            </button>
          );
        })}
      </div>
      {children}
    </details>
  );
}

/** Native range inputs for the two numbers a protein shopper actually asks
 *  for. The rest position (0 g / 900 kcal) is "no bound" — see normaliseBound. */
function BoundsGroup({ draft, onChange }: { draft: MenuFilterState; onChange: (next: MenuFilterState) => void }) {
  const protein = draft.proteinMin ?? PROTEIN_MIN_RANGE.min;
  const kcal = draft.kcalMax ?? KCAL_MAX_RANGE.max;
  return (
    <div className="flex flex-col gap-4 pb-4">
      <label className="flex flex-col gap-1.5 text-xs font-medium text-ink-muted">
        <span className="flex justify-between">
          <span>Protein, at least</span>
          <span className="font-data font-bold text-primary">{draft.proteinMin == null ? "Any" : `${protein} g`}</span>
        </span>
        <input
          type="range"
          min={PROTEIN_MIN_RANGE.min}
          max={PROTEIN_MIN_RANGE.max}
          step={PROTEIN_MIN_RANGE.step}
          value={protein}
          onInput={(e) => onChange(setBound(draft, "proteinMin", (e.target as HTMLInputElement).value))}
          onChange={(e) => onChange(setBound(draft, "proteinMin", e.target.value))}
          aria-valuetext={draft.proteinMin == null ? "Any" : `${protein} grams`}
          className="h-11 w-full accent-[var(--gold)]"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-medium text-ink-muted">
        <span className="flex justify-between">
          <span>Calories, at most</span>
          <span className="font-data font-bold text-primary">{draft.kcalMax == null ? "Any" : `${kcal} kcal`}</span>
        </span>
        <input
          type="range"
          min={KCAL_MAX_RANGE.min}
          max={KCAL_MAX_RANGE.max}
          step={KCAL_MAX_RANGE.step}
          value={kcal}
          onInput={(e) => onChange(setBound(draft, "kcalMax", (e.target as HTMLInputElement).value))}
          onChange={(e) => onChange(setBound(draft, "kcalMax", e.target.value))}
          aria-valuetext={draft.kcalMax == null ? "Any" : `${kcal} kilocalories`}
          className="h-11 w-full accent-[var(--gold)]"
        />
      </label>
    </div>
  );
}
