import Link from "next/link";
import { Text } from "@astryxdesign/core/Text";
import { isAlaCarteEnabled, type DishData } from "@workspace/menu-catalog";
import { formatPaise } from "@/lib/format";
import { AddToCart } from "@/components/cart/AddToCart";
import type { DishFit } from "@/lib/menuFit";

/**
 * Dish row — Stitch Route Brief 02 v3, "Mirrored Clinical Menu List"
 * (docs/stitch/route-02-menu/, screen d97dc79c, owner-confirmed): single
 * column, TEXT column first (title → excerpt → stars → macros), square photo
 * flush at the row's right edge, monospace price with gold emphasis.
 *
 * STILL A SERVER COMPONENT — catalog data, the à-la-carte gate and the price
 * stay server-side; Astryx Text is a client primitive a server component may
 * render. Preserved deliberately from the previous card:
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
      <span aria-hidden className="font-mono text-[11px] text-ink-muted">
        {average.toFixed(1)} ({count})
      </span>
    </span>
  );
}

export function DishCard({ dish, fit }: { dish: DishData; fit?: DishFit }) {
  const est = dish.macrosEstimated ? "~" : "";
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
            {/* `font-bold` duplicates `weight="bold"` on purpose, and only
                here. Astryx's weight atom is emitted in @layer astryx-base;
                while that layer is declared BEFORE Tailwind's, Preflight's
                `h1..h6 { font-weight: inherit }` outranks it and every dish
                name on the menu renders at 400 — but only on this one `as="h3"`
                (the `span` default is untouched, which is why the price below
                is correctly bold). The Tailwind utility sits in @layer
                utilities and wins either way: today over Preflight, and
                harmlessly under the atom once the layer order is repaired. */}
            <Text type="body" weight="bold" as="h3" maxLines={1} className="font-bold">{dish.name}</Text>
          </span>
          {fit?.band === "conflict" && fit.conflictLabel && (
            <Text type="supporting" weight="bold" className="text-[var(--danger)]">
              {fit.conflictLabel}
            </Text>
          )}
          {fit?.band === "high" && (
            <Text type="supporting" weight="bold" className="text-sage-text">
              Good match for you
            </Text>
          )}
          <Text type="supporting" color="secondary" maxLines={2}>
            {dish.tasteDescription || dish.description}
          </Text>
          <RatingStars average={dish.averageRating} count={dish.reviewCount} />
          <span className="font-mono text-[11px] text-ink-muted">
            {est}{dish.macros.calories} kcal · {est}{dish.macros.protein}g P
          </span>
        </div>

        {/* Photo LAST — square, flush right, fixed box (zero CLS) */}
        <div className="relative h-[104px] w-[104px] shrink-0 overflow-hidden rounded-2xl border border-line bg-surface-raised">
          {/* eslint-disable-next-line @next/next/no-img-element -- plain img in
              a fixed box for zero CLS; Astryx has no Image primitive, and
              next/image + remotePatterns lands in a later phase. */}
          <img
            src={dish.image}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </div>
      </Link>

      {/* Sibling of the Link — see the a11y note above. */}
      <div className="relative z-10 mt-2 flex items-center justify-between border-t border-line pt-2">
        <Text type="body" weight="bold" hasTabularNumbers className="text-gold-text">
          {formatPaise(dish.price)}
        </Text>
        {/* §4.1 one-tap add — only for à-la-carte-orderable dishes, so a
            plan-only dish never shows a dead CTA. */}
        {isAlaCarteEnabled(dish) && <AddToCart dish={dish} />}
      </div>
    </article>
  );
}
