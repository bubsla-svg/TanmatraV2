import type { Metadata } from "next";
// Stitch dark scope (route-scoped) — see lib/themes/stitch.css.
import "@/lib/themes/stitch.css";
import { notFound } from "next/navigation";
import Link from "next/link";
import { isAlaCarteEnabled } from "@workspace/menu-catalog";
import { fetchMenu, findDish } from "@/lib/catalog";
import { formatPaise } from "@/lib/format";
import { AddToCart } from "@/components/cart/AddToCart";
import { DishSpec } from "@/components/menu/DishSpec";
import { DishGallery } from "@/components/menu/DishGallery";
import { DishAllergens } from "@/components/menu/DishAllergens";
import { DishPairing } from "@/components/menu/DishPairing";
import { DishReviews } from "@/components/menu/DishReviews";
import { galleryImages } from "@/lib/gallery";
import { dishCrossSell } from "@/lib/related";
import { DishStructuredData } from "@/components/StructuredData";
import { DishBuyBar } from "@/components/menu/DishBuyBar";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const { dishes } = await fetchMenu();
  const dish = findDish(slug, dishes);
  if (!dish) return { title: "Dish not found" };
  return { title: dish.name, description: dish.tasteDescription || dish.description };
}

/** Dish detail — the full canonical PDP: image gallery, macros + spec,
 *  allergen disclosure, and pairing/related cross-sell. Dynamic,
 *  server-rendered, deep-linkable; the price header carries the à-la-carte
 *  AddToCart (server-priced, gated to orderable dishes). */
export default async function DishPage({ params }: Params) {
  const { slug } = await params;
  const { dishes } = await fetchMenu();
  const dish = findDish(slug, dishes);
  if (!dish) notFound();

  const { pairing, related } = dishCrossSell(dish, dishes);
  const est = dish.macrosEstimated ? "~" : "";
  const macros: Array<[string, string]> = [
    ["Calories", `${est}${dish.macros.calories} kcal`],
    ["Protein", `${est}${dish.macros.protein} g`],
    ["Carbs", `${est}${dish.macros.carbs} g`],
    ["Fat", `${est}${dish.macros.fat} g`],
  ];

  return (
    <div data-stitch="dark" className="min-h-screen bg-[var(--bg)] text-ink">
    <article className="mx-auto max-w-3xl px-4 py-8">
      <DishStructuredData dish={dish} />
      <Link href="/menu" className="text-sm text-ink-muted hover:text-ink">
        &larr; Menu
      </Link>

      <div className="mt-4">
        {/* key={slug} forces a fresh gallery (active-thumbnail state reset to 0)
            on client-side PDP→PDP navigation via the cross-sell links below —
            otherwise React keeps the same-position island and dish B would load
            showing dish A's selected companion shot as its hero. */}
        <DishGallery key={dish.slug} images={galleryImages(dish)} alt={dish.name} />
      </div>

      <div className="mt-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{dish.name}</h1>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-muted">
            {dish.tasteDescription || dish.description}
          </p>
        </div>
        {/* Price + the sole action: the canonical page is deep-linkable and
            SEO-indexed, so a shared /dish link must be orderable, not a dead
            end — same server-priced AddToCart as the card/drawer, only for
            à-la-carte dishes (no dead CTA on plan-only dishes). */}
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="tabular text-xl font-semibold text-ink">
            {formatPaise(dish.price)}
          </span>
          {isAlaCarteEnabled(dish) && <AddToCart dish={dish} />}
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-4 gap-2">
        {macros.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-line bg-surface p-3">
            <dt className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</dt>
            <dd className="tabular mt-1 text-sm font-semibold text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      <DishSpec dish={dish} />

      <DishAllergens dish={dish} />

      <DishPairing pairing={pairing} related={related} />

      {/* key={slug}: like DishGallery above, force a fresh island on client-side
          PDP→PDP navigation (via the cross-sell links) so dish B never briefly
          renders dish A's held reviews/rating/eligibility before the refetch. */}
      <DishReviews key={dish.slug} slug={dish.slug} />
    </article>
    <DishBuyBar dish={dish} />
    </div>
  );
}
