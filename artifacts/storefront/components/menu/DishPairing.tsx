import Link from "next/link";
import type { DishData } from "@workspace/menu-catalog";
import { formatPaise } from "@/lib/format";
import { isAlaCarteEnabled } from "@workspace/menu-catalog";
import { AddToCart } from "@/components/cart/AddToCart";

/** Compact dish tile used by both the pairing card and the related rail. */
function MiniCard({ dish }: { dish: DishData }) {
  return (
    <div className="group block overflow-hidden rounded-2xl border border-line bg-surface transition-transform active:scale-[0.98]">
      <Link href={`/dish/${dish.slug}`} className="block">
        <div className="aspect-[16/9] w-full overflow-hidden rounded-t-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element -- fixed aspect box; see DishCard */}
          <img src={dish.image} alt="" className="h-full w-full rounded-t-2xl object-cover" />
        </div>
        <div className="p-3">
          <span className="block truncate text-sm font-medium text-ink group-hover:underline">
            {dish.name}
          </span>
          <span className="mt-1 block font-mono text-sm font-semibold text-gold-text">
            {formatPaise(dish.price)}
          </span>
        </div>
      </Link>
      {isAlaCarteEnabled(dish) && (
        <div className="border-t border-line px-3 py-3">
          <div className="w-full [&>button]:w-full [&>button]:min-h-9 [&>button]:py-1.5 [&>div]:w-full [&>div>button]:min-h-9">
            <AddToCart dish={dish} />
          </div>
        </div>
      )}
    </div>
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
          <ul className="mt-3 flex snap-x gap-3 overflow-x-auto pb-2">
            {related.map((dish) => (
              <li key={dish.slug} className="w-40 shrink-0 snap-start">
                <MiniCard dish={dish} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
