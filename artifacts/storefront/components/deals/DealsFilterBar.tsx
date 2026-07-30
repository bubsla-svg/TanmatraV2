"use client";
// Client: macro-density value sorting for `/meal-deals` (Stitch brief 18).
//
// MONEY: this file used to bill `dish.price ?? 35000` — twice, and one of them
// fed the AddToCart payload, so a soft price would have offered a cart add at an
// invented ₹350. DishData.price is non-nullable, so both fallbacks are gone: the
// price renders verbatim, and the add is gated on isAlaCarteEnabled exactly as
// DishCard gates it. A dish that is not à-la-carte links to its PDP instead of
// offering an add it cannot honour.
import { useState, useMemo } from "react";
import Link from "next/link";
import { isAlaCarteEnabled, type DishData } from "@workspace/menu-catalog";
import { sortDishesByValue, type ValueMetric } from "@/lib/dealSort";
import { AddToCart } from "@/components/cart/AddToCart";
import { formatPaise } from "@/lib/format";

const TABS: { id: ValueMetric; label: string; desc: string }[] = [
  { id: "protein_per_rupee", label: "Max protein value", desc: "Grams of protein per ₹100 spent" },
  { id: "fiber_per_rupee", label: "Max fibre density", desc: "Grams of prebiotic fibre per ₹100 spent" },
  { id: "calorie_density", label: "Satiety energy value", desc: "Total clean calories per ₹100 spent" },
  { id: "price_low", label: "Lowest price first", desc: "Standard à-la-carte price, ascending" },
];

export function DealsFilterBar({ dishes }: { dishes: DishData[] }) {
  const [metric, setMetric] = useState<ValueMetric>("protein_per_rupee");
  const sorted = useMemo(() => sortDishesByValue(dishes, metric), [dishes, metric]);
  const active = TABS.find((t) => t.id === metric);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
          {TABS.map((t) => {
            const on = metric === t.id;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={on}
                onClick={() => setMetric(t.id)}
                className={`shrink-0 rounded-full border px-4 py-2 text-xs font-medium transition-colors ${
                  on
                    ? "border-[var(--gold)] bg-[color-mix(in_srgb,var(--gold)_10%,transparent)] text-gold-text"
                    : "border-line text-ink-muted hover:border-line-strong"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        {active && <p className="mt-2 text-xs text-ink-muted">{active.desc}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.slice(0, 9).map(({ dish, valueLabel }) => (
          <div
            key={dish.id}
            className="flex flex-col justify-between gap-4 rounded-3xl border border-line bg-surface p-5 transition-colors hover:border-line-strong"
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <span className="tabular rounded-full bg-sage-soft px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-sage-text">
                  {valueLabel}
                </span>
                <span className="tabular shrink-0 text-sm font-semibold text-ink">
                  {formatPaise(dish.price)}
                </span>
              </div>
              <Link href={`/dish/${dish.slug}`} className="transition-colors hover:text-gold-text">
                <h3 className="text-base font-semibold leading-snug text-ink">{dish.name}</h3>
              </Link>
              <p className="line-clamp-2 text-sm leading-relaxed text-ink-muted">
                {dish.tasteDescription || dish.description}
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
              <span className="tabular text-[11px] text-ink-muted">
                {dish.macros?.protein ?? 0}g protein &bull; {dish.macros?.fiber ?? 0}g fibre
              </span>
              {isAlaCarteEnabled(dish) ? (
                <AddToCart dish={{ id: dish.id, slug: dish.slug, name: dish.name, price: dish.price }} />
              ) : (
                <Link
                  href={`/dish/${dish.slug}`}
                  className="shrink-0 text-xs font-semibold text-gold-text hover:underline"
                >
                  View dish &rarr;
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
