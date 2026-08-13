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
    <section className="mx-auto w-full max-w-5xl px-4 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            In the pantry
          </h2>
          {/* Was "Dietitian-Approved Pantry" over a paragraph about "experts".
              Same shelf, described the way you would describe it out loud. */}
          <p className="mt-2 text-base leading-relaxed text-ink-muted">
            Good oils, sauces without the sugar, and snacks worth keeping at your
            desk. Add them to a delivery or order on their own.
          </p>
        </div>
        <Link
          href="/marketplace"
          className="text-xs font-bold uppercase tracking-widest text-primary hover:opacity-80"
        >
          Shop all
        </Link>
      </div>
      <MarketplaceGrid initialItems={inStock} limit={RAIL_LIMIT} />
    </section>
  );
}
