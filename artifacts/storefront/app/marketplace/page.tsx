import type { Metadata } from "next";
import { MarketplaceGrid } from "@/components/marketplace/MarketplaceGrid";
import { fetchMarketplaceItemsServer } from "@/lib/marketplaceApi";

export const metadata: Metadata = {
  title: "The Tanmatra Marketplace",
  description:
    "Single-origin oils, small-batch sauces, supplements and pantry staples — hand-picked by our registered dietitians.",
  alternates: { canonical: "/marketplace" },
};

/**
 * Marketplace (route-parity Wave F). Server-fetches the catalog (revalidate
 * hourly, same pattern as /menu) so first paint has real cards; the grid +
 * item pages are still client islands for the category filter and cart, and
 * buying settles through the shared Razorpay money-path (see
 * lib/marketplaceApi). Ship-only for v1; bundle-with-meal is deferred.
 */
export default async function MarketplacePage() {
  const items = await fetchMarketplaceItemsServer();
  return (
    <section className="mx-auto max-w-5xl px-4 py-10">
      <p className="text-[11px] font-bold uppercase tracking-widest text-gold-text">RD-curated pantry</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">The Tanmatra Marketplace</h1>
      <p className="mt-3 max-w-xl text-base leading-relaxed text-ink-muted">
        Single-origin oils, small-batch sauces, supplements and pantry staples — hand-picked by our
        registered dietitians. Look for the RD badge on dietitian-reviewed picks.
      </p>
      <div className="mt-8">
        <MarketplaceGrid initialItems={items} />
      </div>
    </section>
  );
}
