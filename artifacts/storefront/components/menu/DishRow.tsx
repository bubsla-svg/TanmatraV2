import Link from "next/link";
import { type DishData } from "@workspace/menu-catalog";
import { formatMacroLine, formatPaise } from "@/lib/format";
import { AddToCart } from "@/components/cart/AddToCart";
import { VegMark, resolveVegClass } from "@/components/menu/VegMark";
import { macroTrust } from "@/lib/dishTrust";
import { DishImage } from "@/components/menu/DishImage";

/**
 * Compact dish row — CRO handoff T4 (menu density, 17 Sep 2026).
 *
 * /menu measured 110,000px tall at 393px with a photo-led DishCard for every
 * dish. This is the dense shape every dish after a section's hero takes: a
 * 72px square thumbnail, the name on one line, price, the kcal/protein chip
 * and the same one-tap Add — 80px per dish (72 + 2×4 padding) instead of
 * ~560 for a card. Measured 2026-09-17 on the 150-dish fallback catalog:
 * 13,657px → ~13,000px at 393px, from 110,000.
 *
 * The contracts DishCard established are kept on purpose, because the e2e
 * page object and the M-5 display-integrity specs read them:
 *   - the root is an <article> (cards are counted and found by name on it);
 *   - the name is an <h3> inside it (§4.2 duplicate-name audit);
 *   - exactly one VegMark inside the article (§4.3, audited at 100%);
 *   - the photo goes through DishImage, and the fallback tile sits INSIDE
 *     the `?dish=` link (the determinism spec keys tiles by that href);
 *   - the Link wraps browse content only; AddToCart is a SIBLING, never a
 *     <button> inside an <a>.
 *
 * Macro claims are gated exactly as the card gates them (`macroTrust` over
 * the same `sharedMacroKeys`): a provisional, stub or copied tuple prints no
 * number here either. A row never asserts a figure the card would not.
 *
 * A REAL Server Component, like DishCard: rendered by app/(global)/menu/
 * page.tsx and handed to MenuGrid as a node, so none of this markup ships to
 * the client bundle.
 */
export function DishRow({
  dish,
  sharedMacroKeys,
}: {
  dish: DishData;
  sharedMacroKeys: ReadonlySet<string>;
}) {
  const vegClass = resolveVegClass(dish);
  const trust = macroTrust(dish, sharedMacroKeys);
  return (
    <article
      data-dish-row
      className="flex items-center gap-3 py-1"
    >
      <Link
        href={`/menu?dish=${dish.slug}`}
        scroll={false}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl transition-transform active:scale-[0.98]"
      >
        {/* Fixed 72px box: a slow image never shifts the row. `sizes` stops
            next/image downloading the full-width file for a thumbnail. */}
        <DishImage
          src={dish.image}
          name={dish.name}
          className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl bg-surface-raised"
          sizes="72px"
        />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <VegMark vegClass={vegClass} />
            <h3 className="truncate text-sm font-semibold leading-5 text-primary">{dish.name}</h3>
          </span>
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-data text-sm font-bold text-primary">{formatPaise(dish.price)}</span>
            {/* Law 8: no dish representation without its macros — but only
                what the data supports (M-5 §3.4). */}
            {trust === "unverified" ? (
              <span className="text-2xs text-ink-muted">Nutrition coming soon</span>
            ) : (
              <span className="tabular rounded-full border border-[var(--sage)]/20 bg-sage/10 px-2 py-0.5 text-2xs font-semibold text-sage-text">
                {formatMacroLine(dish.macros, dish.macrosEstimated, dish.macrosProvisional)}
              </span>
            )}
          </span>
        </span>
      </Link>

      {/* Sibling of the Link — see the a11y note in the header. Kept verbatim:
          AddToCart owns the cart write, the funnel emit and the stepper swap. */}
      <div className="relative z-10 shrink-0">
        <AddToCart dish={dish} />
      </div>
    </article>
  );
}
