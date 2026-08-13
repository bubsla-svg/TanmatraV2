"use client";
// Client: interactive dish customisation builder. Selections are DISPLAY-priced
// here via lib/dishCustomizations (previewCustomizations) but never billed from
// here — the same selections travel to checkout as CartLine.customizationSelections
// and POST /orders re-prices them against the server's own copy of the dish's
// customisation groups. This file must never invent its own add-on system or
// its own price arithmetic that lands in the cart.
import { memo, useCallback, useEffect, useState } from "react";
import type { DishData, DishCustomGroup } from "@workspace/menu-catalog";
import { addLine } from "@/lib/cartStore";
import { Button } from "@/components/ui/button";
import { useCart } from "@/components/cart/CartProvider";
import { SaveToVaultButton } from "@/components/menu/SaveToVaultButton";
import { previewCustomizations, defaultOptionName, type CustomizationSelection } from "@/lib/dishCustomizations";
import { formatPaise } from "@/lib/format";
import { SafeImage } from "@/components/ui/SafeImage";

/** Selection state keyed by groupName → the option name(s) currently active,
 *  mirroring the wire shape sent to checkout. */
type SelectionState = Record<string, string[]>;

function defaultsFor(groups: DishCustomGroup[]): SelectionState {
  const state: SelectionState = {};
  for (const group of groups) {
    if (group.type === "single") {
      const def = defaultOptionName(group) ?? group.options[0]?.name;
      if (def) state[group.groupName] = [def];
    } else {
      state[group.groupName] = [];
    }
  }
  return state;
}

function toSelections(state: SelectionState): CustomizationSelection[] {
  return Object.entries(state).map(([groupName, optionNames]) => ({ groupName, optionNames }));
}

/**
 * One row in the dish picker. `memo`'d so that customising the SELECTED
 * dish — which rewrites `selection` on every tap inside the groups below —
 * doesn't re-render all 8 rows in this list on every tap; only `active`
 * (whichever row is/was selected) actually needs to change.
 */
const DishPickRow = memo(function DishPickRow({
  dish,
  active,
  onSelect,
}: {
  dish: DishData;
  active: boolean;
  onSelect: (slug: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(dish.slug)}
      aria-pressed={active}
      className={`flex items-center gap-4 rounded-2xl border p-3 text-left transition-all active:scale-[0.99] ${
        active ? "border-gold bg-gold/5 shadow-[var(--shadow-card)]" : "border-line bg-surface hover:border-line-strong"
      }`}
    >
      <SafeImage src={dish.image} className="h-16 w-16 shrink-0 rounded-xl border border-line" />
      <div className="flex flex-1 flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-sm font-semibold ${active ? "text-gold-text" : "text-ink"}`}>
            {dish.name}
          </span>
          <span className="tabular text-xs font-bold text-ink">{formatPaise(dish.price)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="tabular rounded-full border border-line bg-surface-raised px-2 py-0.5 text-3xs text-ink-muted">
            {dish.macros.calories} kcal
          </span>
          <span className="tabular rounded-full border border-line bg-surface-raised px-2 py-0.5 text-3xs text-ink-muted">
            {dish.macros.protein}g protein
          </span>
          <span className="rounded-full border border-line bg-surface-raised px-2 py-0.5 text-3xs text-ink-muted">
            {dish.kitchen.toUpperCase()} kitchen
          </span>
        </div>
      </div>
      {active && (
        <span aria-hidden="true" className="shrink-0 text-lg font-bold text-gold-text">
          ✓
        </span>
      )}
    </button>
  );
});

export function CustomBuildHub({ dishes }: { dishes: DishData[] }) {
  const { cart, setCart } = useCart();
  const [selectedSlug, setSelectedSlug] = useState(dishes[0]?.slug ?? "");
  const [added, setAdded] = useState(false);

  const selectedDish = dishes.find((d) => d.slug === selectedSlug) ?? dishes[0]!;
  const [selection, setSelection] = useState<SelectionState>(() => defaultsFor(selectedDish.customizations));

  // Reset to the new dish's defaults whenever the selected dish changes.
  useEffect(() => {
    setSelection(defaultsFor(selectedDish.customizations));
    setAdded(false);
  }, [selectedDish.slug]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stable identity — see DishPickRow's doc comment: this is what lets the
  // memo boundary hold while `selection` below changes on every tap.
  const selectDish = useCallback((slug: string) => setSelectedSlug(slug), []);

  const selectSingle = (groupName: string, optionName: string) =>
    setSelection((prev) => ({ ...prev, [groupName]: [optionName] }));

  const toggleMultiple = (groupName: string, optionName: string) =>
    setSelection((prev) => {
      const current = prev[groupName] ?? [];
      const next = current.includes(optionName)
        ? current.filter((n) => n !== optionName)
        : [...current, optionName];
      return { ...prev, [groupName]: next };
    });

  const preview = previewCustomizations(selectedDish.customizations, toSelections(selection));
  const basePrice = selectedDish.price;
  const totalQuote = basePrice + preview.modifierPaise;

  function handleAddToCart() {
    setCart(
      addLine(cart, {
        dishId: selectedDish.id,
        kind: "dish",
        slug: selectedDish.slug,
        name: selectedDish.name,
        pricePaise: totalQuote,
        customizationSelections: toSelections(selection),
        customizations: preview.labels,
      }),
    );
    setAdded(true);
  }

  const vaultDishName =
    preview.labels.length > 0 ? `${selectedDish.name} (${preview.labels.join(", ")})` : selectedDish.name;

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
      <div className="flex flex-col gap-8 lg:col-span-7">
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold tracking-tight text-ink">Select a Dish</h2>
          <div className="flex max-h-[440px] flex-col gap-3 overflow-y-auto pr-1">
            {dishes.slice(0, 8).map((d) => (
              <DishPickRow key={d.id} dish={d} active={d.slug === selectedDish.slug} onSelect={selectDish} />
            ))}
          </div>
        </div>

        <div className="border-t border-line" />

        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold tracking-tight text-ink">Customise</h2>
          {selectedDish.customizations.length === 0 ? (
            <p className="rounded-2xl border border-line bg-surface p-4 text-xs text-ink-muted">
              No customisation options for this dish.
            </p>
          ) : (
            <div className="flex flex-col gap-6">
              {selectedDish.customizations.map((group) => (
                <div key={group.groupName} className="flex flex-col gap-3">
                  <span className="text-sm font-semibold text-ink">{group.groupName}</span>
                  {group.type === "single" ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {group.options.map((option) => {
                        const active = (selection[group.groupName] ?? []).includes(option.name);
                        return (
                          <button
                            key={option.name}
                            type="button"
                            onClick={() => selectSingle(group.groupName, option.name)}
                            aria-pressed={active}
                            className={`flex items-center justify-between gap-2 rounded-full border px-4 py-3 text-sm font-medium transition-all active:scale-[0.98] ${
                              active
                                ? "border-gold bg-gold text-[var(--gold-ink)] shadow-[var(--shadow-card)]"
                                : "border-line bg-surface text-ink hover:border-line-strong"
                            }`}
                          >
                            <span>{option.name}</span>
                            <span className="tabular text-xs font-bold">
                              {option.priceModifier > 0 ? `+${formatPaise(option.priceModifier)}` : "Included"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      {group.options.map((option) => {
                        const active = (selection[group.groupName] ?? []).includes(option.name);
                        return (
                          <button
                            key={option.name}
                            type="button"
                            onClick={() => toggleMultiple(group.groupName, option.name)}
                            aria-pressed={active}
                            className={`flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-all active:scale-[0.98] ${
                              active
                                ? "border-gold bg-gold text-[var(--gold-ink)] shadow-[var(--shadow-card)]"
                                : "border-line bg-surface text-ink hover:border-line-strong"
                            }`}
                          >
                            <span aria-hidden="true">{active ? "✓" : "+"}</span>
                            <span>{option.name}</span>
                            <span className="tabular text-xs font-bold">
                              {option.priceModifier > 0 ? `+${formatPaise(option.priceModifier)}` : "Included"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Order summary — sticky, doing the primary-action job a fixed footer
          would otherwise do (Brief 25: no second sticky footer on this route). */}
      <div className="relative flex h-fit flex-col gap-6 overflow-hidden rounded-3xl border border-line bg-surface p-6 shadow-[var(--shadow-card)] lg:sticky lg:top-6 lg:col-span-5">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold/10 blur-3xl" />

        <div className="relative flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-gold-text">Order Summary</span>
          <h3 className="text-xl font-semibold tracking-tight text-ink">{selectedDish.name}</h3>
          <p className="text-xs leading-relaxed text-ink-muted">
            {preview.labels.length > 0
              ? `Customised: ${preview.labels.join(", ")}`
              : "No customisations selected — standard preparation."}
          </p>
        </div>

        <div className="tabular relative flex flex-col gap-3 border-y border-line py-4 text-sm">
          <div className="flex items-center justify-between text-ink-muted">
            <span>Base price</span>
            <span className="font-semibold text-ink">{formatPaise(basePrice)}</span>
          </div>
          <div className="flex items-center justify-between text-ink-muted">
            <span>Customisations</span>
            <span className="font-semibold text-ink">{formatPaise(preview.modifierPaise)}</span>
          </div>
          <div className="flex items-center justify-between pt-2 text-base font-bold text-ink">
            <span>Estimated total</span>
            <span className="text-gold-text">{formatPaise(totalQuote)}</span>
          </div>
        </div>

        <p className="relative rounded-xl bg-sage-soft px-4 py-3 text-xs leading-relaxed text-sage-text">
          Your selections travel with the order to checkout, where our server computes the final price.
          This total is a preview.
        </p>

        <div className="relative flex flex-col gap-3">
          <Button
            type="button"
            onClick={handleAddToCart}
            shape="pill"
            size="fluid"
            className="w-full px-6 py-4 text-center font-semibold"
          >
            {added ? "Added ✓" : "Add to cart"}
          </Button>
          <div className="flex w-full justify-center">
            <SaveToVaultButton dishSlug={selectedDish.slug} dishName={vaultDishName} />
          </div>
        </div>
      </div>
    </div>
  );
}
