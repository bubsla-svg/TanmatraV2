import Link from "next/link";
import { MarketplaceGrid } from "@/components/marketplace/MarketplaceGrid";
import { fetchMarketplaceItemsServer } from "@/lib/marketplaceApi";

/** Homepage shop window: eight in-stock products, then the door to the rest. */
const RAIL_LIMIT = 8;

export async function Section04bMarketplace() {
  const items = await fetchMarketplaceItemsServer();
  const inStock = items.filter((item) => item.stockQty > 0);
  // Nothing on the shelf, nothing to show — including the heading. A section
  // titled "In the pantry" above an empty grid advertises an empty shop.
  if (inStock.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-[1240px] px-5 sm:px-8">
      <div className="mb-9 flex flex-wrap items-end justify-between gap-4 animate-rise-in">
        <div className="max-w-2xl">
          <h2 className="font-display text-4xl font-semibold leading-none text-primary sm:text-5xl">
            In the pantry
          </h2>
          {/* Was "Dietitian-Approved Pantry" over a paragraph about "experts".
              Same shelf, described the way you would describe it out loud. */}
          <p className="mt-5 max-w-md text-base leading-7 text-ink-muted">
            Good oils, sauces without the sugar, and snacks worth keeping at your
            desk. Add them to a delivery or order on their own.
          </p>
        </div>
        <Link
          href="/marketplace"
          className="touch-target-min shrink-0 text-sm font-bold text-primary hover:opacity-80"
        >
          Shop all
        </Link>
      </div>
      <MarketplaceGrid initialItems={inStock} limit={RAIL_LIMIT} />
    </section>
  );
}
