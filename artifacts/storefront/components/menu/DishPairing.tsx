import Link from "next/link";
import type { DishData } from "@workspace/menu-catalog";
import { formatPaise } from "@/lib/format";
import { isAlaCarteEnabled } from "@workspace/menu-catalog";
import { AddToCart } from "@/components/cart/AddToCart";

/** Compact dish tile used by both the pairing card and the related rail. */
function MiniCard({ dish }: { dish: DishData }) {
  return (
    <Link
      href={`/dish/${dish.slug}`}
      className="group block overflow-hidden rounded-xl border border-line bg-surface-raised transition-transform active:scale-[0.99]"
    >
      <div className="aspect-[16/9] w-full">
        {/* eslint-disable-next-line @next/next/no-img-element -- fixed aspect box; see DishCard */}
        <img src={dish.image} alt="" className="h-full w-full object-cover" />
      </div>
      <div className="flex items-start justify-between gap-3 p-3">
        <span className="text-sm font-medium text-ink group-hover:underline">{dish.name}</span>
        <span className="tabular shrink-0 text-sm font-semibold text-ink">
          {formatPaise(dish.price)}
        </span>
      </div>
      {isAlaCarteEnabled(dish) && (
        <div className="border-t border-line px-3 py-3">
          <div className="w-full [&>button]:w-full [&>button]:min-h-9 [&>button]:py-1.5 [&>div]:w-full [&>div>button]:min-h-9">
            <AddToCart dish={dish} />
          </div>
        </div>
      )}
    </Link>
  );
}

/**
 * PDP cross-sell: the dish's explicit pairing (when set) plus a same-category
 * "more like this" rail. Renders nothing when there's neither — the caller
 * passes `dishCrossSell()` output, so an isolated dish adds no empty sections.
 */
export function DishPairing({
  pairing,
  related,
}: {
  pairing?: DishData;
  related: DishData[];
}) {
  if (!pairing && related.length === 0) return null;

  return (
    <div className="mt-10 space-y-8">
      {pairing && (
        <section>
          <h2 className="text-sm font-semibold text-ink">Pairs well with</h2>
          <div className="mt-3 max-w-sm">
            <MiniCard dish={pairing} />
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-ink">More like this</h2>
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {related.map((dish) => (
              <li key={dish.slug}>
                <MiniCard dish={dish} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
