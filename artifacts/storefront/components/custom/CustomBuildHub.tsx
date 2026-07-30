"use client";
// Client: interactive dish customisation builder. Selections are DISPLAY-priced
// here via lib/dishCustomizations (previewCustomizations) but never billed from
// here — the same selections travel to checkout as CartLine.customizationSelections
// and POST /orders re-prices them against the server's own copy of the dish's
// customisation groups. This file must never invent its own add-on system or
// its own price arithmetic that lands in the cart.
import { useEffect, useState } from "react";
import type { DishData, DishCustomGroup } from "@workspace/menu-catalog";
import { addLine } from "@/lib/cartStore";
import { useCart } from "@/components/cart/CartProvider";
import { SaveToVaultButton } from "@/components/menu/SaveToVaultButton";
import { previewCustomizations, defaultOptionName, type CustomizationSelection } from "@/lib/dishCustomizations";
import { formatPaise } from "@/lib/format";

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
      <div className="flex flex-col gap-4 lg:col-span-7">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gold-text">1. Select a Dish</h2>
        <div className="flex flex-col gap-3 max-h-[420px] overflow-y-auto pr-1">
          {dishes.slice(0, 8).map((d) => {
            const active = d.slug === selectedDish.slug;
            return (
              <button
                key={d.id}
                onClick={() => setSelectedSlug(d.slug)}
                className={`rounded-2xl border p-4 text-left transition-all ${
                  active ? "border-gold bg-gold/5 shadow-sm font-semibold" : "border-line bg-surface hover:border-ink/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-ink">{d.name}</span>
                  <span className="text-xs font-bold text-ink">{formatPaise(d.price)}</span>
                </div>
                <div className="text-[11px] text-ink-muted mt-1">
                  {d.macros.calories} kcal &bull; {d.macros.protein}g Protein &bull; {d.kitchen.toUpperCase()} Kitchen
                </div>
              </button>
            );
          })}
        </div>

        <h2 className="text-sm font-semibold uppercase tracking-wider text-gold-text mt-4">2. Customise</h2>
        {selectedDish.customizations.length === 0 ? (
          <p className="rounded-xl border border-line bg-surface p-4 text-xs text-ink-muted">
            No customisation options for this dish.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {selectedDish.customizations.map((group) => (
              <div key={group.groupName} className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-ink">{group.groupName}</span>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {group.options.map((option) => {
                    const active = (selection[group.groupName] ?? []).includes(option.name);
                    return (
                      <button
                        key={option.name}
                        type="button"
                        onClick={() =>
                          group.type === "single"
                            ? selectSingle(group.groupName, option.name)
                            : toggleMultiple(group.groupName, option.name)
                        }
                        aria-pressed={active}
                        className={`rounded-xl border p-3 text-left flex items-center justify-between gap-2 transition-all ${
                          active
                            ? "border-gold bg-gold text-[var(--gold-ink)] shadow-sm font-semibold"
                            : "border-line bg-surface text-ink hover:border-ink/20"
                        }`}
                      >
                        <span className="text-xs">{option.name}</span>
                        <span className="text-[10px] font-bold">
                          {option.priceModifier > 0 ? `+${formatPaise(option.priceModifier)}` : "Included"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="lg:col-span-5 flex flex-col gap-6 rounded-2xl border border-line bg-surface p-6 shadow-sm h-fit sticky top-6">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-gold-text">Order Summary</span>
          <h3 className="text-lg font-semibold text-ink mt-1">{selectedDish.name}</h3>
          <p className="text-xs text-ink-muted mt-1 leading-relaxed">
            {preview.labels.length > 0
              ? `Customised: ${preview.labels.join(", ")}`
              : "No customisations selected — standard preparation."}
          </p>
        </div>

        <div className="flex flex-col gap-3 border-y border-line py-4 text-xs">
          <div className="flex items-center justify-between text-ink-muted">
            <span>Base price:</span>
            <span className="font-semibold text-ink">{formatPaise(basePrice)}</span>
          </div>
          <div className="flex items-center justify-between text-ink-muted">
            <span>Customisations:</span>
            <span className="font-semibold text-ink">{formatPaise(preview.modifierPaise)}</span>
          </div>
          <div className="flex items-center justify-between pt-2 text-sm font-bold text-ink">
            <span>Estimated total:</span>
            <span>{formatPaise(totalQuote)}</span>
          </div>
          <p className="text-[10px] text-sage-text bg-sage-soft p-2 rounded-lg font-medium text-center">
            Your selections travel with the order to checkout, where our server computes the final price.
            This total is a preview.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={handleAddToCart}
            className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.98]"
          >
            {added ? "Added ✓" : "Add to cart"}
          </button>
          <div className="w-full flex justify-center">
            <SaveToVaultButton dishSlug={selectedDish.slug} dishName={vaultDishName} />
          </div>
        </div>
      </div>
    </div>
  );
}
