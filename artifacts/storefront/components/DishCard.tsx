import Link from "next/link";
import { Text } from "@astryxdesign/core/Text";
import { type DishData } from "@workspace/menu-catalog";
import { formatMacroLine, formatPaise } from "@/lib/format";
import { dishCardSummary } from "@/lib/dishText";
import { AddToCart } from "@/components/cart/AddToCart";
import { ClinicalBadge } from "@/components/primitives/Badges";
import { VegMark, resolveVegClass } from "@/components/menu/VegMark";
import { macroTrust } from "@/lib/dishTrust";

import { DishImage } from "@/components/menu/DishImage";

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

/**
 * The macro chip, with the claim gated to what the data can support
 * (M-5 §3.4, defect S-3 / finding F8).
 *
 * `unverified` renders NO numbers. That is the whole point: 16 live dishes
 * carry a byte-identical placeholder bucket (460 kcal / 18 g P / 45 g C /
 * 14 g F) copied across unrelated dishes, and only one of them is flagged
 * provisional — so without this gate a mango cooler and a garlic bread both
 * assert "460 kcal · 18 g P" as fact. On a platform whose customers count
 * protein, a fabricated number is worse than an absent one.
 */
function MacroChip({ dish }: { dish: DishData }) {
  const trust = macroTrust(dish);
  if (trust === "unverified") {
    return (
      <ClinicalBadge
        variant="slate"
        className="w-fit"
        label="Macros being verified"
      />
    );
  }
  return (
    <ClinicalBadge
      variant="slate"
      className="tabular w-fit"
      label={formatMacroLine(dish.macros, dish.macrosEstimated)}
    />
  );
}

/** Merchandising badge chip variant, keyed off the label text — unknown
 *  labels (any future badge the payload adds) default to gold rather than
 *  failing to render. */
function badgeVariant(badge: string): "gold" | "emerald" | "amber" | "slate" {
  const b = badge.toLowerCase();
  if (b.includes("new")) return "emerald";
  if (b.includes("trend")) return "amber";
  return "gold";
}

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
  if (compact) {
    const vegClass = resolveVegClass(dish);
    return (
      <Link href={`/menu?dish=${dish.slug}`} scroll={false} className="group flex flex-col rounded-2xl border border-line bg-surface p-3 transition-transform active:scale-[0.98]">
        <div className="relative mb-4 overflow-hidden rounded-xl bg-surface-raised border border-line">
          <div className="absolute top-2 left-2 flex items-center gap-1.5 z-10">
            <span className="flex items-center rounded-full bg-[var(--glass)] px-1.5 py-1 backdrop-blur-md">
              <VegMark vegClass={vegClass} />
            </span>
            {dish.badge && (
              <ClinicalBadge label={dish.badge} variant={badgeVariant(dish.badge)} className="backdrop-blur-md" />
            )}
          </div>
          <DishImage
            src={dish.image}
            name={dish.name}
            alt={dish.name}
            className="aspect-[4/3] w-full"
          />
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="font-bold text-lg text-ink truncate">{dish.name}</h3>
          <MacroChip dish={dish} />
          <div className="relative z-10 mt-3 flex justify-between items-center">
            <span className="font-clinical-data text-ink text-gold-text">{formatPaise(dish.price)}</span>
            <AddToCart dish={dish} />
          </div>
        </div>
      </Link>
    );
  }

  const vegClass = resolveVegClass(dish);
  return (
    <article className="group flex flex-col rounded-2xl border border-line bg-surface p-3 transition-transform active:scale-[0.98]">
      <Link href={`/menu?dish=${dish.slug}`} scroll={false} className="flex gap-4">
        {/* Text column FIRST (v3 mirrored order) */}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex items-center gap-2">
            <VegMark vegClass={vegClass} />
            {/* Two lines, not one (flipbook review F-4): the name is the
                card's primary identifier and the clamp was eating the
                distinguishing tail — "Chicken Meal — 150 g grilled …",
                "Grilled Chicken with Veggies …". Portion size and protein
                are exactly what separates neighbouring dishes in a family. */}
            <Text type="body" weight="bold" as="h3" maxLines={2} className="font-bold">{dish.name}</Text>
          </span>

          {dish.badge && (
            <ClinicalBadge label={dish.badge} variant={badgeVariant(dish.badge)} className="w-fit" />
          )}

          {/* dishCardSummary, not `description`: the catalog derives that
              field from the first three ingredients, which across a dish
              FAMILY are the shared base — "Aglio Olio - Veg / - Chicken /
              - Prawns" all printed the identical line, so three consecutive
              cards differed only by name and price. See lib/dishText.ts.
              Three lines, not two (owner feedback 2026-08-16): the photo box
              fixes the row at ~104px, so a 2-line clamp cut summaries "…"
              early while leaving dead air under the text — the third line
              spends that trapped space on the words it was truncating. */}
          <Text type="supporting" color="secondary" maxLines={3}>
            {dishCardSummary(dish)}
          </Text>
          <RatingStars average={dish.averageRating} count={dish.reviewCount} />
          <MacroChip dish={dish} />
        </div>

        {/* Photo LAST — square, flush right, fixed box (zero CLS). No `sizes`
            on purpose: the box is 104px at every viewport, so next/image emits
            a 1x/2x srcset, which is the right pair here. A `sizes` value would
            replace that with the full width-descriptor ladder for no gain. */}
        <div className="relative h-[104px] w-[104px] shrink-0 overflow-hidden rounded-2xl border border-line bg-surface-raised">
          <DishImage
            src={dish.image}
            name={dish.name}
            alt={dish.name}
            className="h-full w-full transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </div>
      </Link>

      {/* Sibling of the Link — see the a11y note above. No divider (owner
          feedback 2026-08-16): the hairline read as a wall between the dish
          and its price/Add, and with the Add now carrying the gold outline
          the row separates itself. */}
      <div className="relative z-10 mt-2.5 flex items-center justify-between">
        <Text type="body" weight="bold" hasTabularNumbers className="text-gold-text">
          {formatPaise(dish.price)}
        </Text>
        {/* §4.1 one-tap add — every menu card on à-la-carte is orderable (zero dead ends) */}
        <AddToCart dish={dish} />
      </div>
    </article>
  );
}
