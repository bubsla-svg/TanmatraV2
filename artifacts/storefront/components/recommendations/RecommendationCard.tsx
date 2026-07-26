"use client";
// Client: interactive recommendation squircle card with AI reasoning badges and 1-click add.
import Link from "next/link";
import { AddToCart } from "@/components/cart/AddToCart";
import { formatPaise } from "@/lib/format";
import type { SmartRecommendation } from "@/lib/recommendations";

export function RecommendationCard({ recommendation: { dish, badge, rationale } }: { recommendation: SmartRecommendation }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm flex flex-col justify-between gap-3.5 transition-transform duration-200 hover:scale-[1.015]">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="inline-block rounded-full bg-sage-100 px-2.5 py-0.5 text-xs font-semibold text-sage-800 tracking-wide mb-2">
              &starf; {badge}
            </span>
            <Link href={`/dish/${dish.slug}`} className="block font-semibold text-ink hover:text-gold-text transition-colors">
              <h3 className="text-base font-semibold leading-snug">{dish.name}</h3>
            </Link>
          </div>
          <span className="text-sm font-bold text-ink shrink-0">{formatPaise(dish.price ?? 35000)}</span>
        </div>

        <div className="rounded-xl border border-sage-200 bg-sage-100/50 p-3">
          <p className="text-xs text-sage-800 leading-relaxed font-medium">
            <span className="font-bold">AI Clinical Rationale:</span> {rationale}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-line pt-2 mt-1">
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          <span>{dish.macros?.calories ?? 450} kcal</span>
          <span>&bull;</span>
          <span>{dish.macros?.protein ?? 0}g Protein</span>
          <span>&bull;</span>
          <span>{dish.macros?.fiber ?? 0}g Fiber</span>
          <Link href={`/meal-guides/${dish.slug}`} className="font-semibold text-gold-text hover:underline ml-auto">
            Prep Guide &rarr;
          </Link>
        </div>
        <div className="mt-1">
          <AddToCart dish={{ id: dish.id, slug: dish.slug, name: dish.name, price: dish.price ?? 35000 }} />
        </div>
      </div>
    </div>
  );
}
