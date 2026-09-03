import Link from "next/link";
import { SafeImage } from "@/components/ui/SafeImage";
import { MarketplaceAddToCart } from "@/components/cart/MarketplaceAddToCart";
import { formatPaise } from "@/lib/format";
import { fetchMarketplaceItemsServer } from "@/lib/marketplaceApi";
import { Rail } from "@/components/primitives/Rail";

/** Three or four cards — a glance, not a shelf. */
const RAIL_LIMIT = 4;

/**
 * "Goes with this" — a horizontally swiping pantry rail on the dish page
 * (T-17). Cross-sell used to exist only inside the cart sheet, after Add;
 * here it sits above the allergen block, before the decision. Real catalog
 * items from the same server fetch the marketplace grid uses, in stock only,
 * with the card-variant Add (44px, outline gold) so the shared cart bar
 * counts them the moment they are tapped. Server Component — no state.
 */
export async function PantryRail() {
  const items = (await fetchMarketplaceItemsServer()).filter((i) => i.stockQty > 0).slice(0, RAIL_LIMIT);
  if (items.length === 0) return null;

  return (
    <section aria-label="Goes with this" className="mt-6">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-2xs font-semibold uppercase tracking-wide text-ink-faint">Goes with this</h2>
        <Link href="/marketplace" className="touch-target-min text-xs font-semibold text-gold-text hover:underline">
          Pantry
        </Link>
      </div>
      <Rail as="ul" bleed="gutter" className="gap-3 pb-1">
        {items.map((item) => (
          <li key={item.id} className="flex w-40 flex-none snap-start flex-col gap-2 rounded-2xl border border-line bg-surface p-2.5">
            <Link href={`/marketplace/${item.slug}`} className="flex flex-col gap-2">
              <SafeImage src={item.image ?? ""} alt={item.name} className="aspect-square w-full rounded-xl border border-line" />
              <span className="line-clamp-2 text-xs font-semibold leading-snug text-ink">{item.name}</span>
              <span className="tabular text-xs font-medium text-gold-text">{formatPaise(item.pricePaise)}</span>
            </Link>
            <MarketplaceAddToCart item={item} variant="card" />
          </li>
        ))}
      </Rail>
    </section>
  );
}
