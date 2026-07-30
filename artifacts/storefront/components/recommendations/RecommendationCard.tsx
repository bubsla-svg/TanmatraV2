"use client";
// Client: recommendation card for `/meal-recommendations` (Stitch brief 19) —
// a food image, a macro badge row, ONE line of reasoning, and a 1-click add.
//
// MONEY: the price used to render `dish.price ?? 35000`, and the same fallback
// fed the AddToCart payload. DishData.price is non-nullable, so both are gone and
// the add is gated on isAlaCarteEnabled like every other add surface.
//
// CLINICAL DATA: calories used to fall back to `?? 450` — a fabricated macro
// published as a dish's energy value. Macros now render only when present.
//
// RATING: the star row is omitted entirely when the dish has no averageRating,
// rather than drawing empty stars against an unrated dish.
import Link from "next/link";
import { isAlaCarteEnabled } from "@workspace/menu-catalog";
import { AddToCart } from "@/components/cart/AddToCart";
import { formatPaise } from "@/lib/format";
import type { SmartRecommendation } from "@/lib/recommendations";

const macroChip = "tabular rounded-full border border-line bg-bg px-2.5 py-1 text-[10px] text-ink-muted";

export function RecommendationCard({
  recommendation: { dish, badge, rationale },
}: {
  recommendation: SmartRecommendation;
}) {
  const rating = dish.averageRating;
  const hasRating = typeof rating === "number" && rating > 0;

  return (
    <article className="flex flex-col overflow-hidden rounded-3xl border border-line bg-surface transition-colors hover:border-line-strong">
      <Link href={`/dish/${dish.slug}`} className="relative block h-40 bg-surface-raised">
        {/* eslint-disable-next-line @next/next/no-img-element -- unoptimized <img>, see next.config */}
        <img src={dish.image} alt="" loading="lazy" className="h-full w-full object-cover" />
        <span className="absolute left-3 top-3 rounded-full bg-sage-soft px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-sage-text backdrop-blur-md">
          {badge}
        </span>
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <Link href={`/dish/${dish.slug}`} className="min-w-0 transition-colors hover:text-gold-text">
            <h3 className="truncate text-base font-semibold leading-snug text-ink">{dish.name}</h3>
          </Link>
          <span className="tabular shrink-0 text-sm font-semibold text-ink">{formatPaise(dish.price)}</span>
        </div>

        {hasRating && (
          <p className="tabular flex items-center gap-1.5 text-[11px] text-ink-muted">
            <span aria-hidden className="text-gold-text">
              &starf;
            </span>
            {rating.toFixed(1)}
            {dish.reviewCount ? <span className="text-ink-faint">({dish.reviewCount})</span> : null}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {dish.macros?.calories != null && <span className={macroChip}>{dish.macros.calories} kcal</span>}
          {dish.macros?.protein != null && <span className={macroChip}>{dish.macros.protein}g protein</span>}
          {dish.macros?.fiber != null && <span className={macroChip}>{dish.macros.fiber}g fibre</span>}
        </div>

        {/* One line, never a paragraph — the brief is explicit about this. */}
        <p className="line-clamp-2 text-sm leading-relaxed text-ink-muted">{rationale}</p>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-4">
          <Link
            href={`/meal-guides/${dish.slug}`}
            className="text-xs font-semibold text-gold-text hover:underline"
          >
            Prep guide &rarr;
          </Link>
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
    </article>
  );
}
