import Link from "next/link";
import { type DishData } from "@workspace/menu-catalog";
import { formatMacroLine, formatPaise } from "@/lib/format";
import { dishCardSummary } from "@/lib/dishText";
import { AddToCart } from "@/components/cart/AddToCart";
import { ClinicalBadge } from "@/components/primitives/Badges";
import { VegMark, resolveVegClass } from "@/components/menu/VegMark";
import { macroTrust } from "@/lib/dishTrust";
import { DishImage } from "@/components/menu/DishImage";

/**
 * Dish card — PR-11c, the delivered revision's `dish-card.tsx` replicated
 * (docs/design-reference/storefront-revision-2026-09, brief CUJ 1 §1/§10):
 * photo on top at the revision's `aspect-[1.12]`, category eyebrow, display
 * name, two-line summary, then price and the one-tap Add. What the README
 * says the reference gets wrong is corrected here, not carried across:
 *
 *  - a macros row on every card (Law 8 — the revision's card omits it);
 *  - a real photograph through DishImage, never the revision's CSS plate;
 *  - stars only from the payload (`averageRating`/`reviewCount`), never the
 *    revision's hard-coded 4.8, and no "Fresh today" chip on every card;
 *  - 44px+ controls (the revision's Add is 40px).
 *
 * A REAL Server Component: catalog data, the à-la-carte gate and the price
 * are evaluated server-side and none of this file's own code ships to the
 * client — app/menu/page.tsx renders DishCard directly and hands the nodes
 * to PersonalizedMenu/MenuGrid as data (see the RSC-boundary history in git
 * for why the composition is inverted). Preserved deliberately:
 *   - The Link wraps browse content only; the footer (price · Add) is a
 *     SIBLING — a <button> inside an <a> is invalid HTML and an a11y failure.
 *     (The compact rail card used to wrap Add inside its Link; it no longer
 *     does — same card, both surfaces.)
 *   - Price renders dish.price exactly as the server sent it; stars render
 *     dish.averageRating/reviewCount exactly as shipped in the menu payload.
 *     Nothing here computes, discounts or re-derives an amount or a rating.
 *   - The photo box has a fixed aspect, so a slow image never shifts the row.
 */

/**
 * The macro chip, with the claim gated to what the data can support
 * (M-5 §3.4, defect S-3 / finding F8). `unverified` renders NO numbers:
 * 16 live dishes carry a byte-identical placeholder bucket copied across
 * unrelated dishes, so without this gate a mango cooler and a garlic bread
 * both assert "460 kcal · 18 g P" as fact. A fabricated number is worse
 * than an absent one.
 */
function MacroChip({ dish, sharedMacroKeys }: { dish: DishData; sharedMacroKeys: ReadonlySet<string> }) {
  const trust = macroTrust(dish, sharedMacroKeys);
  if (trust === "unverified") {
    return <ClinicalBadge variant="slate" className="w-fit" label="Nutrition coming soon" />;
  }
  return (
    <ClinicalBadge
      variant="emerald"
      className="tabular w-fit"
      label={formatMacroLine(dish.macros, dish.macrosEstimated, dish.macrosProvisional)}
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

/** Display-only star row (signal, not action). Renders nothing when a dish
 *  has no reviews yet — the revision's constant "4.8" is exactly the claim
 *  the README rules out. */
function RatingStars({ average, count }: { average?: number | null; count?: number }) {
  if (!average || !count) return null;
  const filled = Math.round(average);
  return (
    <span className="flex items-center gap-1.5" aria-label={`Rated ${average} out of 5 from ${count} reviews`}>
      <span aria-hidden className="text-xs leading-none tracking-tight text-accent">
        {"★".repeat(Math.min(filled, 5))}
        <span className="opacity-30">{"★".repeat(Math.max(0, 5 - filled))}</span>
      </span>
      <span aria-hidden className="font-data text-2xs text-ink-muted">
        {average.toFixed(1)} ({count})
      </span>
    </span>
  );
}

/**
 * `sharedMacroKeys` is REQUIRED, not optional (flipbook F-1): the set of
 * macro tuples appearing on more than one dish in the set being rendered; a
 * dish inside it prints no numbers. Callers build it with
 * `buildSharedMacroKeys(dishes)`; a surface that genuinely renders one
 * isolated dish passes an empty set.
 *
 * `compact` survives as the home rail's flag (the rail sizes its items to
 * 280px); the card itself is the same composition on both surfaces.
 */
export function DishCard({
  dish,
  compact,
  sharedMacroKeys,
}: {
  dish: DishData;
  compact?: boolean;
  sharedMacroKeys: ReadonlySet<string>;
}) {
  const vegClass = resolveVegClass(dish);
  const pad = compact ? "p-4" : "p-5";
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-transform active:scale-[0.99]">
      <Link href={`/menu?dish=${dish.slug}`} scroll={false} className="flex flex-1 flex-col">
        <div className="relative">
          {/* Fixed aspect from the revision (1.12) — a slow image never
              shifts the card. No `sizes`: the card is one column at every
              phone width, so next/image's default pair is the right one. */}
          <DishImage
            src={dish.image}
            name={dish.name}
            alt={dish.name}
            className="aspect-[1.12] w-full bg-surface-raised"
            imgClassName="transition-transform duration-500 group-hover:scale-[1.03]"
          />
          <span className="absolute left-4 top-4 z-10 flex items-center rounded-full bg-glass px-1.5 py-1 backdrop-blur-md">
            <VegMark vegClass={vegClass} />
          </span>
          {dish.badge && (
            <ClinicalBadge
              label={dish.badge}
              variant={badgeVariant(dish.badge)}
              className="absolute bottom-4 left-4 backdrop-blur-sm"
            />
          )}
        </div>
        <div className={`flex flex-1 flex-col ${pad} pb-0`}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[.16em] text-ink-muted">{dish.category}</span>
            <RatingStars average={dish.averageRating} count={dish.reviewCount} />
          </div>
          {/* Two lines, not one (flipbook review F-4): the name is the card's
              primary identifier and the clamp was eating the distinguishing
              tail — portion size and protein are what separate neighbouring
              dishes in a family. */}
          <h3 className="line-clamp-2 font-display text-[22px] font-semibold leading-[1.1] text-primary">{dish.name}</h3>
          {/* dishCardSummary, not `description`: the catalog derives that
              field from the first three ingredients, which across a dish
              FAMILY are the shared base — three consecutive cards differed
              only by name and price. See lib/dishText.ts. */}
          <p className="mt-2 line-clamp-2 text-sm leading-5 text-ink-muted">{dishCardSummary(dish)}</p>
          {/* Law 8: no dish representation without its macros. */}
          <div className="mt-3">
            <MacroChip dish={dish} sharedMacroKeys={sharedMacroKeys} />
          </div>
        </div>
      </Link>

      {/* Sibling of the Link — see the a11y note above. */}
      <div className={`relative z-10 mt-4 flex items-end justify-between gap-3 ${pad} pt-0`}>
        <span className="font-data text-sm font-bold text-primary">{formatPaise(dish.price)}</span>
        {/* §4.1 one-tap add — every menu card on à-la-carte is orderable (zero dead ends) */}
        <AddToCart dish={dish} />
      </div>
    </article>
  );
}
