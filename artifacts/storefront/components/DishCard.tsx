import Link from "next/link";
import { Text } from "@astryxdesign/core/Text";
import { type DishData } from "@workspace/menu-catalog";
import { formatPaise } from "@/lib/format";
import { dishCardSummary } from "@/lib/dishText";
import { AddToCart } from "@/components/cart/AddToCart";

import { SafeImage } from "@/components/ui/SafeImage";

/**
 * Dish row — Stitch Route Brief 02 v3, "Mirrored Clinical Menu List"
 * (docs/stitch/route-02-menu/, screen d97dc79c, owner-confirmed): single
 * column, TEXT column first (title → excerpt → stars → macros), square photo
 * flush at the row's right edge, monospace price with gold emphasis.
 *
 * A REAL Server Component: catalog data, the à-la-carte gate and the price
 * are evaluated server-side and none of this file's own code ships to the
 * client. (It used to claim this while being reached only through
 * PersonalizedMenu's "use client" import chain — under RSC rules that
 * silently compiled this whole file, MenuGrid, and everything below it into
 * client JS regardless of the comment. Fixed by inverting the composition:
 * app/menu/page.tsx renders DishCard directly and hands the resulting nodes
 * to PersonalizedMenu/MenuGrid as data, not as an import.) The one piece of
 * markup that genuinely depends on client-fetched state — the personalised
 * fit badge — is isolated to the small client island in DishFitContext.tsx,
 * rendered below at the position the inline fit check used to occupy.
 * Preserved deliberately from the previous card:
 *   - The Link wraps browse content only; the footer (price · Add) is a
 *     SIBLING — a <button> inside an <a> is invalid HTML and an a11y failure.
 *   - Price renders dish.price exactly as the server sent it; stars render
 *     dish.averageRating/reviewCount exactly as shipped in the menu payload.
 *     Nothing here computes, discounts or re-derives an amount or a rating.
 *   - The fixed-size photo box means a slow image never shifts the row.
 */

/** Display-only star row (gold = signal here, not an action — the whole row is
 *  the action). Renders nothing when a dish has no reviews yet. */
function RatingStars({ average, count }: { average?: number | null; count?: number }) {
  if (!average || !count) return null;
  const filled = Math.round(average);
  return (
    <span className="flex items-center gap-1.5" aria-label={`Rated ${average} out of 5 from ${count} reviews`}>
      <span aria-hidden className="text-xs leading-none tracking-tight text-gold-text">
        {"★".repeat(Math.min(filled, 5))}
        <span className="opacity-30">{"★".repeat(Math.max(0, 5 - filled))}</span>
      </span>
      <span aria-hidden className="font-mono text-2xs text-ink-muted">
        {average.toFixed(1)} ({count})
      </span>
    </span>
  );
}

export function DishCard({ dish, compact }: { dish: DishData; compact?: boolean }) {
  const est = dish.macrosEstimated ? "~" : "";
  
  if (compact) {
    return (
      <Link href={`/menu?dish=${dish.slug}`} scroll={false} className="group flex flex-col rounded-2xl border border-line bg-surface p-3 transition-transform active:scale-[0.98]">
        <div className="relative mb-4 overflow-hidden rounded-xl bg-surface-raised border border-line">
          <div className="absolute top-2 left-2 flex gap-1 z-10">
            <span className="px-2 py-1 rounded-full bg-sage-soft/90 backdrop-blur-md border border-[var(--sage)]/20 font-bold text-3xs text-sage-text uppercase tracking-widest">
              {dish.isVeg ? "Veg" : "Non-Veg"}
            </span>
          </div>
          <SafeImage src={dish.image} alt={dish.name} className="aspect-[4/3] w-full" />
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="font-bold text-lg text-ink truncate">{dish.name}</h3>
          <span className="font-mono text-2xs text-ink-muted">
            {est}{dish.macros.calories} kcal · {est}{dish.macros.protein}g P
          </span>
          <div className="relative z-10 mt-3 flex justify-between items-center">
            <span className="font-clinical-data text-ink text-gold-text">{formatPaise(dish.price)}</span>
            <AddToCart dish={dish} />
          </div>
        </div>
      </Link>
    );
  }

  return (
    <article className="group flex flex-col rounded-2xl border border-line bg-surface p-3 transition-transform active:scale-[0.98]">
      <Link href={`/menu?dish=${dish.slug}`} scroll={false} className="flex gap-4">
        {/* Text column FIRST (v3 mirrored order) */}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex items-center gap-2">
            <span
              role="img"
              aria-label={dish.isVeg ? "Vegetarian" : "Non-vegetarian"}
              className={`inline-block h-2.5 w-2.5 shrink-0 ring-1 ring-line-strong ${
                dish.isVeg ? "rounded-full" : "rounded-[2px]"
              }`}
              style={{ backgroundColor: dish.isVeg ? "var(--sage)" : "var(--danger)" }}
            />
            <Text type="body" weight="bold" as="h3" maxLines={1} className="font-bold">{dish.name}</Text>
          </span>

          {/* dishCardSummary, not `description`: the catalog derives that
              field from the first three ingredients, which across a dish
              FAMILY are the shared base — "Aglio Olio - Veg / - Chicken /
              - Prawns" all printed the identical line, so three consecutive
              cards differed only by name and price. See lib/dishText.ts. */}
          <Text type="supporting" color="secondary" maxLines={2}>
            {dishCardSummary(dish)}
          </Text>
          <RatingStars average={dish.averageRating} count={dish.reviewCount} />
          <span className="font-mono text-2xs text-ink-muted">
            {est}{dish.macros.calories} kcal · {est}{dish.macros.protein}g P
          </span>
        </div>

        {/* Photo LAST — square, flush right, fixed box (zero CLS). No `sizes`
            on purpose: the box is 104px at every viewport, so next/image emits
            a 1x/2x srcset, which is the right pair here. A `sizes` value would
            replace that with the full width-descriptor ladder for no gain. */}
        <div className="relative h-[104px] w-[104px] shrink-0 overflow-hidden rounded-2xl border border-line bg-surface-raised">
          <SafeImage
            src={dish.image}
            alt={dish.name}
            className="h-full w-full transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </div>
      </Link>

      {/* Sibling of the Link — see the a11y note above. */}
      <div className="relative z-10 mt-2 flex items-center justify-between border-t border-line pt-2">
        <Text type="body" weight="bold" hasTabularNumbers className="text-gold-text">
          {formatPaise(dish.price)}
        </Text>
        {/* §4.1 one-tap add — every menu card on à-la-carte is orderable (zero dead ends) */}
        <AddToCart dish={dish} />
      </div>
    </article>
  );
}
