"use client";

import React, { useState } from "react";
import type { DishData } from "@workspace/menu-catalog";
import { SafeImage } from "@/components/primitives/SafeImage";
import { PrimaryCTA } from "@/components/primitives/CTA";
import { PriceDisplay } from "@/components/primitives/PriceDisplay";
import { useCart } from "@/components/cart/CartProvider";
import { addLine } from "@/lib/cartStore";

interface ProductDetailViewProps {
  dish: DishData;
}

export function ProductDetailView({ dish }: ProductDetailViewProps) {
  const [showNutrition, setShowNutrition] = useState(false);
  const [selectedModifiers, setSelectedModifiers] = useState<string[]>([]);
  const [added, setAdded] = useState(false);
  const { cart, setCart } = useCart();

  const handleAddToCart = () => {
    setCart(
      addLine(cart, {
        dishId: dish.id,
        kind: "dish",
        slug: dish.slug,
        name: dish.name,
        pricePaise: dish.price,
        customizations: selectedModifiers,
      })
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const est = dish.macrosEstimated ? "~" : "";
  const macros: Array<[string, string]> = [
    ["Calories", `${est}${dish.macros.calories} kcal`],
    ["Protein", `${est}${dish.macros.protein} g`],
    ["Carbs", `${est}${dish.macros.carbs} g`],
    ["Fat", `${est}${dish.macros.fat} g`],
  ];

  const heroImage = dish.image || "/images/placeholder.jpg";

  return (
    <div className="flex flex-col min-h-dvh bg-[var(--bg)] text-ink">
      {/* Product Hero SafeImage */}
      <div className="w-full max-w-2xl mx-auto px-4 pt-4">
        <SafeImage
          src={heroImage}
          alt={dish.name}
          aspectRatio="16/9"
          className="w-full rounded-2xl overflow-hidden object-cover border border-line"
        />
      </div>

      <div className="w-full max-w-2xl mx-auto px-4 py-6 flex-1 flex flex-col gap-6">
        {/* Product Identity */}
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl font-bold tracking-tight text-ink">{dish.name}</h1>
            {dish.isVeg !== undefined && (
              <span className={`px-2 py-0.5 text-xs font-bold rounded border ${dish.isVeg ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : 'border-rose-500/30 text-rose-400 bg-rose-500/10'}`}>
                {dish.isVeg ? "VEG" : "NON-VEG"}
              </span>
            )}
          </div>
          <p className="text-sm text-ink-muted leading-relaxed">
            {dish.tasteDescription || dish.description}
          </p>
          <div className="pt-2">
            <PriceDisplay pricePaise={dish.price} size="lg" />
          </div>
        </section>

        {/* Configuration Options */}
        {dish.customizations && dish.customizations.length > 0 && (
          <section className="p-4 rounded-xl border border-line bg-surface space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
              Customization &amp; Add-ons
            </h3>
            {dish.customizations.map((group) => (
              <div key={group.groupName} className="space-y-2">
                <h4 className="text-xs font-semibold text-ink-muted">{group.groupName}</h4>
                <div className="space-y-1.5">
                  {group.options.map((opt) => {
                    const isSelected = selectedModifiers.includes(opt.name);
                    return (
                      <label
                        key={opt.name}
                        className="flex items-center justify-between p-3 rounded-lg border border-line bg-surface-raised cursor-pointer hover:border-gold transition-colors"
                      >
                        <span className="text-sm font-medium">{opt.name}</span>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedModifiers([...selectedModifiers, opt.name]);
                            } else {
                              setSelectedModifiers(selectedModifiers.filter((m) => m !== opt.name));
                            }
                          }}
                          className="accent-amber-400 h-4 w-4 rounded"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Progressive Nutrition Disclosure (Collapsed by Default) */}
        <section className="rounded-xl border border-line bg-surface overflow-hidden">
          <button
            type="button"
            onClick={() => setShowNutrition(!showNutrition)}
            className="w-full flex items-center justify-between p-4 text-left font-semibold text-sm hover:bg-surface-raised transition-colors"
          >
            <span>Therapeutic Nutrition Profile</span>
            <span className="text-gold font-mono">{showNutrition ? "− Hide" : "+ View Nutrition"}</span>
          </button>
          {showNutrition && (
            <div className="p-4 border-t border-line space-y-4 animate-in fade-in duration-200">
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {macros.map(([label, value]) => (
                  <div key={label} className="p-3 rounded-lg bg-surface-raised border border-line">
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">{label}</dt>
                    <dd className="mt-1 text-sm font-semibold text-ink tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
              {dish.glycaemicIndex && (
                <div className="text-xs text-ink-muted">
                  Glycaemic Index: <span className="font-semibold text-ink">{dish.glycaemicIndex}</span>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Ingredient & Allergen Disclosure */}
        <section className="p-4 rounded-xl border border-line bg-surface space-y-2 text-xs">
          <h3 className="font-bold uppercase tracking-wider text-ink-muted">Ingredients &amp; Allergen Warning</h3>
          {dish.ingredients && dish.ingredients.length > 0 && (
            <p className="text-ink-muted">
              <strong className="text-ink">Ingredients:</strong> {dish.ingredients.join(", ")}
            </p>
          )}
          {dish.allergens && dish.allergens.length > 0 ? (
            <p className="text-amber-400 font-medium">
              ⚠️ <strong>Contains Allergens:</strong> {dish.allergens.join(", ")}
            </p>
          ) : (
            <p className="text-emerald-400 font-medium">✓ No major allergens declared.</p>
          )}
        </section>
      </div>

      {/* Product Sticky Action Footer */}
      <div className="sticky bottom-0 inset-x-0 z-40 p-4 border-t border-line bg-surface-raised/95 backdrop-blur-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4 pb-[env(safe-area-inset-bottom)]">
          <div>
            <span className="text-xs text-ink-muted block">Total Price</span>
            <PriceDisplay pricePaise={dish.price} size="md" />
          </div>
          <PrimaryCTA onClick={handleAddToCart} className="min-w-[160px]">
            {added ? "✓ Added to Cart" : "Add to Cart"}
          </PrimaryCTA>
        </div>
      </div>
    </div>
  );
}
