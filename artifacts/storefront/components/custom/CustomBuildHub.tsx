"use client";
// Client: interactive clinical meal customization builder with server-authoritative price quotes.
import { useState } from "react";
import type { DishData } from "@workspace/menu-catalog";
import { AddToCart } from "@/components/cart/AddToCart";
import { SaveToVaultButton } from "@/components/menu/SaveToVaultButton";
import { formatPaise } from "@/lib/format";

const BOOSTS = [
  { id: "protein-double", name: "Double Organic Protein Boost", macros: "+18g Protein, +110 kcal", quotePaise: 9500 },
  { id: "prebiotic-fiber", name: "Hydroponic Prebiotic Fiber Bowl", macros: "+8g Fiber, +45 kcal", quotePaise: 6500 },
  { id: "probiotic-kombucha", name: "Raw Ginger Fermented Kombucha", macros: "Live Probiotics, +30 kcal", quotePaise: 12000 },
];

export function CustomBuildHub({ dishes }: { dishes: DishData[] }) {
  const [selectedSlug, setSelectedSlug] = useState(dishes[0]?.slug ?? "");
  const [activeBoosts, setActiveBoosts] = useState<string[]>([]);

  const selectedDish = dishes.find((d) => d.slug === selectedSlug) ?? dishes[0]!;
  const basePrice = selectedDish.price ?? 35000;
  const totalQuote = basePrice + activeBoosts.reduce((sum, bId) => {
    const boost = BOOSTS.find((b) => b.id === bId);
    return sum + (boost?.quotePaise ?? 0);
  }, 0);

  const toggleBoost = (id: string) =>
    setActiveBoosts((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
      <div className="flex flex-col gap-4 lg:col-span-7">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gold-text">1. Select Canonical Base Bowl</h2>
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
                  <span className="text-xs font-bold text-ink">{formatPaise(d.price ?? 35000)}</span>
                </div>
                <div className="text-[11px] text-ink-muted mt-1">
                  {d.macros?.calories ?? 450} kcal &bull; {d.macros?.protein ?? 0}g Protein &bull; {d.kitchen.toUpperCase()} Kitchen
                </div>
              </button>
            );
          })}
        </div>

        <h2 className="text-sm font-semibold uppercase tracking-wider text-gold-text mt-4">2. Add Clinical Nutritional Boosts</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {BOOSTS.map((b) => {
            const active = activeBoosts.includes(b.id);
            return (
              <button
                key={b.id}
                onClick={() => toggleBoost(b.id)}
                className={`rounded-xl border p-3 text-left flex flex-col justify-between gap-2 transition-all ${
                  active ? "border-gold bg-gold text-white shadow-sm font-semibold" : "border-line bg-surface text-ink hover:border-ink/20"
                }`}
              >
                <div>
                  <div className={`text-xs ${active ? "text-white" : "text-ink font-semibold"}`}>{b.name}</div>
                  <div className={`text-[10px] mt-1 ${active ? "text-white/80" : "text-ink-muted"}`}>{b.macros}</div>
                </div>
                <span className={`text-xs font-bold ${active ? "text-white" : "text-gold-text"}`}>
                  +{formatPaise(b.quotePaise)} ({active ? "Added &check;" : "+ Select"})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="lg:col-span-5 flex flex-col gap-6 rounded-2xl border border-line bg-surface p-6 shadow-sm h-fit sticky top-6">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-gold-text">Protocol Summary</span>
          <h3 className="text-lg font-semibold text-ink mt-1">{selectedDish.name} (Custom Build)</h3>
          <p className="text-xs text-ink-muted mt-1 leading-relaxed">
            Includes base macro profile plus {activeBoosts.length} active clinical nutrient extensions.
          </p>
        </div>

        <div className="flex flex-col gap-3 border-y border-line py-4 text-xs">
          <div className="flex items-center justify-between text-ink-muted">
            <span>Base Bowl Quote:</span>
            <span className="font-semibold text-ink">{formatPaise(basePrice)}</span>
          </div>
          <div className="flex items-center justify-between text-ink-muted">
            <span>Nutritional Boosts Quote:</span>
            <span className="font-semibold text-ink">{formatPaise(totalQuote - basePrice)}</span>
          </div>
          <div className="flex items-center justify-between pt-2 text-sm font-bold text-ink">
            <span>Estimated Total Quote:</span>
            <span>{formatPaise(totalQuote)}</span>
          </div>
          <p className="text-[10px] text-sage-800 bg-sage-100 p-2 rounded-lg font-medium text-center">
            &starf; Server Authoritative Money (§5): Final billing is recalculated securely by our Express gateway during checkout.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <AddToCart dish={{ id: selectedDish.id, slug: selectedDish.slug, name: `${selectedDish.name} (Custom)`, price: totalQuote }} />
          <div className="w-full flex justify-center">
            <SaveToVaultButton dishSlug={`${selectedDish.slug}-custom`} dishName={`${selectedDish.name} (+${activeBoosts.length} boosts)`} />
          </div>
        </div>
      </div>
    </div>
  );
}
