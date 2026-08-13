import Link from "next/link";
import { SafeImage } from "@/components/ui/SafeImage";
import { formatPaise } from "@/lib/format";
import type { MarketplaceItem } from "@/lib/marketplaceApi";

/**
 * Marketplace products, as products.
 *
 * This rendered `<div><h3>{item.name}</h3></div>` — a bordered box per item
 * with the name in it and nothing else. No photo, no price, no link: the
 * homepage's pantry section listed products a visitor could neither see, price,
 * nor open. It matched the card treatment on /marketplace in no respect.
 *
 * Now it is the /marketplace card: photo, supplier, name, weight, price, and a
 * link to the product. Same shape on both surfaces, so the homepage rail is a
 * genuine preview of the shop rather than a separate, worse thing.
 *
 * STOCK IS RESPECTED. `stockQty === 0` items are dropped rather than shown as
 * unavailable — this is a promotional rail on the entry route, and the job of a
 * shop window is to show what can be bought today. (`lib/upsell.ts` filters the
 * same way.) /marketplace remains the full catalogue.
 *
 * Server Component: it is a list of links, so nothing here needs the client.
 */
export function MarketplaceGrid({
  initialItems,
  limit,
}: {
  initialItems: MarketplaceItem[];
  /** Cap for the homepage rail. Omit on /marketplace to show everything. */
  limit?: number;
}) {
  const inStock = initialItems.filter((item) => item.stockQty > 0);
  const items = typeof limit === "number" ? inStock.slice(0, limit) : inStock;

  // An empty shop window is not an error state to apologise for — it is a
  // section with nothing to say, so it says nothing and the page moves on.
  if (items.length === 0) return null;

  return (
    <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {items.map((item) => (
        <li key={item.slug}>
          <Link
            href={`/marketplace/${item.slug}`}
            className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-3 transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
          >
            <div className="relative mb-3 overflow-hidden rounded-xl border border-line bg-surface-raised">
              <SafeImage
                src={item.image ?? ""}
                alt={item.name}
                className="aspect-square w-full"
                imgClassName="transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              {item.supplierName && (
                <span className="text-3xs font-bold uppercase tracking-widest text-ink-muted">
                  {item.supplierName}
                </span>
              )}
              <h3 className="line-clamp-2 text-sm font-bold leading-tight text-ink">{item.name}</h3>
              {item.weightLabel && (
                <span className="text-3xs text-ink-muted">{item.weightLabel}</span>
              )}
              <span className="tabular mt-auto pt-3 text-sm font-semibold text-ink">
                {formatPaise(item.pricePaise)}
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
