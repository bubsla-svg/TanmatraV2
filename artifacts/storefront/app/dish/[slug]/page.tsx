import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { isAlaCarteEnabled } from "@workspace/menu-catalog";
import { fetchMenu, findDish } from "@/lib/catalog";
import { formatPaise } from "@/lib/format";
import { AddToCart } from "@/components/cart/AddToCart";
import { DishSpec } from "@/components/menu/DishSpec";
import { DishStructuredData } from "@/components/StructuredData";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const { dishes } = await fetchMenu();
  const dish = findDish(slug, dishes);
  if (!dish) return { title: "Dish not found" };
  return { title: dish.name, description: dish.tasteDescription || dish.description };
}

/** Dish detail. Dynamic, server-rendered, deep-linkable. No money surface —
 *  browsing only; ordering arrives with the money path. */
export default async function DishPage({ params }: Params) {
  const { slug } = await params;
  const { dishes } = await fetchMenu();
  const dish = findDish(slug, dishes);
  if (!dish) notFound();

  const est = dish.macrosEstimated ? "~" : "";
  const macros: Array<[string, string]> = [
    ["Calories", `${est}${dish.macros.calories} kcal`],
    ["Protein", `${est}${dish.macros.protein} g`],
    ["Carbs", `${est}${dish.macros.carbs} g`],
    ["Fat", `${est}${dish.macros.fat} g`],
  ];

  return (
    <article className="mx-auto max-w-3xl px-4 py-8">
      <DishStructuredData dish={dish} />
      <Link href="/menu" className="text-sm text-ink-muted hover:text-ink">
        &larr; Menu
      </Link>

      <div className="mt-4 overflow-hidden rounded-xl border border-line bg-surface-raised">
        <div className="aspect-[16/9] w-full">
          {/* eslint-disable-next-line @next/next/no-img-element -- see DishCard */}
          <img src={dish.image} alt="" className="h-full w-full object-cover" />
        </div>
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

      {dish.allergens.length > 0 && (
        <p className="mt-5 text-xs text-ink-muted">
          <span className="font-semibold text-ink">Allergens:</span>{" "}
          {dish.allergens.join(", ")}
        </p>
      )}
    </article>
  );
}
