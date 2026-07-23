import Link from "next/link";
import type { DishData } from "@workspace/menu-catalog";
import { formatPaise } from "@/lib/format";

/**
 * Presentational dish card. Server component — pure render, no client JS.
 * The image sits in a fixed-aspect box so a slow or missing image never shifts
 * layout (CLS budget). Numeric macros carry a "~" when estimated, so a
 * templated value is never shown as precise.
 */
export function DishCard({ dish }: { dish: DishData }) {
  const est = dish.macrosEstimated ? "~" : "";
  return (
    <Link
      // Opens the §4.2 PDP bottom sheet over the grid (?dish= deep-link);
      // /dish/[slug] stays the canonical share/SEO route, linked from the
      // drawer. scroll={false} keeps the grid position under the sheet.
      href={`/menu?dish=${dish.slug}`}
      scroll={false}
      className="group flex flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-raised">
        {/* eslint-disable-next-line @next/next/no-img-element -- skeleton uses
            a plain img with explicit aspect box for zero CLS; next/image +
            remotePatterns lands in a later phase. */}
        <img
          src={dish.image}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <span
          role="img"
          aria-label={dish.isVeg ? "Vegetarian" : "Non-vegetarian"}
          className={`absolute left-2 top-2 inline-block h-3 w-3 ring-2 ring-white ${
            dish.isVeg ? "rounded-full" : "rounded-[2px]"
          }`}
          style={{ backgroundColor: dish.isVeg ? "var(--sage)" : "var(--danger)" }}
        />
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3 className="text-sm font-semibold leading-snug text-ink">{dish.name}</h3>
        <p className="line-clamp-2 text-xs leading-relaxed text-ink-muted">
          {dish.tasteDescription || dish.description}
        </p>
        <div className="mt-auto flex items-center justify-between pt-1.5">
          <span className="tabular text-sm font-semibold text-ink">
            {formatPaise(dish.price)}
          </span>
          <span className="tabular text-[11px] text-ink-faint">
            {est}
            {dish.macros.calories} kcal · {est}
            {dish.macros.protein}g P
          </span>
        </div>
      </div>
    </Link>
  );
}
