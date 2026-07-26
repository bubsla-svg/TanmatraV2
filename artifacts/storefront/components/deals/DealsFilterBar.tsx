"use client";
// Client: interactive macro-density value sorting with kinetic segmented tabs and 1-click ordering.
import { useState, useMemo } from "react";
import Link from "next/link";
import type { DishData } from "@workspace/menu-catalog";
import { sortDishesByValue, type ValueMetric } from "@/lib/dealSort";
import { AddToCart } from "@/components/cart/AddToCart";
import { formatPaise } from "@/lib/format";

const TABS: { id: ValueMetric; label: string; desc: string }[] = [
  { id: "protein_per_rupee", label: "Max Protein Value", desc: "Grams of protein per ₹100 spent" },
  { id: "fiber_per_rupee", label: "Max Fiber Density", desc: "Grams of prebiotic fiber per ₹100 spent" },
  { id: "calorie_density", label: "Satiety Energy Value", desc: "Total clean calories per ₹100 spent" },
  { id: "price_low", label: "Lowest Price First", desc: "Standard à-la-carte delivery fee sorting" },
];

export function DealsFilterBar({ dishes }: { dishes: DishData[] }) {
  const [metric, setMetric] = useState<ValueMetric>("protein_per_rupee");

  const sorted = useMemo(() => sortDishesByValue(dishes, metric), [dishes, metric]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap gap-2 rounded-2xl border border-line bg-surface p-2 shadow-sm">
        {TABS.map((t) => {
          const active = metric === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setMetric(t.id)}
              className={`flex-1 min-w-[150px] rounded-xl border px-4 py-3 text-left transition-all ${
                active ? "border-gold bg-gold text-white font-semibold shadow-sm" : "border-transparent bg-transparent text-ink-muted hover:text-ink hover:border-ink/20"
              }`}
            >
              <div className={`text-xs ${active ? "text-white" : "text-ink font-semibold"}`}>{t.label}</div>
              <div className={`text-[10px] mt-0.5 ${active ? "text-white/80" : "text-ink-muted"}`}>{t.desc}</div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.slice(0, 9).map(({ dish, valueLabel }) => (
          <div
            key={dish.id}
            className="rounded-2xl border border-line bg-surface p-4 shadow-sm flex flex-col justify-between gap-4 transition-transform duration-200 hover:scale-[1.015]"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="rounded-full bg-sage-100 px-2.5 py-0.5 text-xs font-bold text-sage-800 shrink-0">
                  &starf; {valueLabel}
                </span>
                <span className="text-xs font-bold text-ink">{formatPaise(dish.price ?? 35000)}</span>
              </div>
              <Link href={`/dish/${dish.slug}`} className="block font-semibold text-ink hover:text-gold-text transition-colors mt-1">
                <h3 className="text-base font-semibold leading-snug">{dish.name}</h3>
              </Link>
              <p className="text-xs text-ink-muted mt-2 leading-relaxed line-clamp-2">
                {dish.tasteDescription || dish.description}
              </p>
            </div>

            <div className="flex items-center justify-between border-t border-line pt-3 text-xs">
              <div className="text-[11px] text-ink-muted">
                <span>{dish.macros?.protein ?? 0}g Protein</span> &bull; <span>{dish.macros?.fiber ?? 0}g Fiber</span>
              </div>
              <div className="w-fit">
                <AddToCart dish={{ id: dish.id, slug: dish.slug, name: dish.name, price: dish.price ?? 35000 }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
