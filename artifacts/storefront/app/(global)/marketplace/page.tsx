import type { Metadata } from "next";
import Link from "next/link";
import { fetchMarketplaceItemsServer } from "@/lib/marketplaceApi";
import { SafeImage } from "@/components/ui/SafeImage";
import { MarketplaceAddToCart } from "@/components/cart/MarketplaceAddToCart";
import { formatPaise } from "@/lib/format";

export const metadata: Metadata = {
  title: "Marketplace",
  description: "Stock your pantry with Tanmatra-approved goods.",
};

export default async function MarketplacePage() {
  const items = await fetchMarketplaceItemsServer();

  return (
    <div data-ui-generation="stitch-74" data-screen-id="5.7" data-screen-state="default" className="min-h-dvh bg-bg pb-24">
      <div className="sticky top-0 z-20 bg-bg/95 backdrop-blur-md pt-4 pb-4 px-gutter border-b border-line">
        <h1 className="font-bold text-3xl text-ink">Marketplace</h1>
        <p className="text-sm text-ink-muted">Tanmatra-approved pantry & supplements</p>
      </div>

      <div className="px-gutter pt-6">
        <div className="grid grid-cols-2 gap-4">
          {/* Card body navigates; the quick-add is a sibling of the Link, not
              a child (a button inside an anchor is invalid HTML) — same
              add → [− qty +] on-card grammar as dish cards (D-08 outline). */}
          {items.map((item) => (
            <div key={item.id} className="flex flex-col rounded-2xl border border-line bg-surface p-3">
              <Link href={`/marketplace/${item.slug}`} className="group flex flex-1 flex-col transition-transform active:scale-[0.98]">
              <div className="relative mb-3 overflow-hidden rounded-xl bg-surface-raised border border-line">
                {item.badges.length > 0 && (
                  <div className="absolute top-2 left-2 flex gap-1 z-10 flex-col">
                    {item.badges.map(badge => (
                      <span key={badge} className="px-2 py-1 rounded-full bg-sage-soft/90 backdrop-blur-md border border-[var(--sage)]/20 font-bold text-3xs text-sage-text uppercase tracking-widest">
                        {badge}
                      </span>
                    ))}
                  </div>
                )}
                <SafeImage src={item.image ?? ""} alt={item.name} className="aspect-square w-full" />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <span className="font-bold text-3xs text-ink-muted uppercase tracking-widest">{item.supplierName}</span>
                <h3 className="font-bold text-sm text-ink line-clamp-2 leading-tight">{item.name}</h3>
                {item.weightLabel && <span className="font-mono text-3xs text-ink-muted">{item.weightLabel}</span>}
                <div className="relative z-10 mt-auto pt-3 flex justify-between items-center">
                  <span className="font-clinical-data text-ink">{formatPaise(item.pricePaise)}</span>
                </div>
              </div>
              </Link>
              {/* /marketplace shows the FULL catalogue, out-of-stock included —
                  no quick-add on an unbuyable item; the PDP states its status. */}
              {item.stockQty > 0 && (
                <div className="mt-3">
                  <MarketplaceAddToCart item={item} variant="card" />
                </div>
              )}
            </div>
          ))}
          {items.length === 0 && (
            <div className="col-span-2 py-10 text-center text-ink-muted">
              Marketplace catalog is currently empty.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
