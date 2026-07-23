import Link from "next/link";
import { isAlaCarteEnabled, type DishData } from "@workspace/menu-catalog";
import { formatPaise } from "@/lib/format";
import { AddToCart } from "@/components/cart/AddToCart";

/**
 * Presentational dish card. Server component — pure render; the only client
 * JS is the AddToCart island on orderable dishes. The image sits in a
 * fixed-aspect box so a slow or missing image never shifts layout (CLS
 * budget). Numeric macros carry a "~" when estimated.
 *
 * Structure: the Link wraps the browse content (image, name, description) and
 * opens the §4.2 PDP sheet via /menu?dish= (scroll preserved; /dish/[slug]
 * stays canonical for shares). The footer (price · macros · Add) is a SIBLING
 * of the Link, not a child — a button inside an anchor is invalid HTML and an
 * a11y fail.
 */
export function DishCard({ dish }: { dish: DishData }) {
  const est = dish.macrosEstimated ? "~" : "";
  return (
    <article className="group flex flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5">
      <Link href={`/menu?dish=${dish.slug}`} scroll={false} className="flex flex-col">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-raised">
          {/* eslint-disable-next-line @next/next/no-img-element -- plain img
              with explicit aspect box for zero CLS; next/image + remotePatterns
              lands in a later phase. */}
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
        <div className="flex flex-col gap-1.5 p-3 pb-0">
          <h3 className="text-sm font-semibold leading-snug text-ink">{dish.name}</h3>
          <p className="line-clamp-2 text-xs leading-relaxed text-ink-muted">
            {dish.tasteDescription || dish.description}
          </p>
        </div>
      </Link>

      <div className="mt-auto flex items-center justify-between gap-2 p-3 pt-2">
        <div className="flex flex-col">
          <span className="tabular text-sm font-semibold text-ink">
            {formatPaise(dish.price)}
          </span>
          <span className="tabular text-[11px] text-ink-faint">
            {est}
            {dish.macros.calories} kcal · {est}
            {dish.macros.protein}g P
          </span>
        </div>
        {/* §4.1 one-tap add without opening the PDP — only for à-la-carte-
            orderable dishes (server-curated hero set): no dead CTAs on
            plan-only dishes. */}
        {isAlaCarteEnabled(dish) && <AddToCart dish={dish} />}
      </div>
    </article>
  );
}
