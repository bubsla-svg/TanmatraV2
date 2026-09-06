import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchMarketplaceItemsServer } from "@/lib/marketplaceApi";
import { SafeImage } from "@/components/ui/SafeImage";
import { formatPaise } from "@/lib/format";
import { MarketplaceAddToCart } from "@/components/cart/MarketplaceAddToCart";
import { MarketplaceBuyNow } from "@/components/marketplace/MarketplaceBuyNow";
import { FocusHeader } from "@/components/FocusHeader";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const items = await fetchMarketplaceItemsServer();
  const item = items.find(i => i.slug === resolvedParams.slug);
  if (!item) return { title: "Not Found" };
  return { title: item.name };
}

export default async function MarketplaceItemPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const items = await fetchMarketplaceItemsServer();
  const item = items.find(i => i.slug === resolvedParams.slug);
  if (!item) notFound();

  return (
    <div data-ui-generation="stitch-74" data-screen-id="5.8" data-screen-state="default" className="min-h-dvh flex flex-col bg-bg pb-24">
      <FocusHeader backLabel="Back to marketplace" />
      {/* Hero Image */}
      <div className="relative w-full aspect-square md:aspect-video overflow-hidden">
        <SafeImage src={item.image ?? ""} alt={item.name} className="h-full w-full" />
      </div>

      <div className="px-gutter pt-6 flex-1 flex flex-col">
        {/* Header Section */}
        <div className="mb-6">
          <div className="flex gap-2 items-center mb-3">
            {/* text-xs, not text-3xs (T-22/T-24: nothing under 12px). */}
            <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold uppercase tracking-[.12em] text-ink-muted">
              {item.category}
            </span>
            {item.rdVerified && (
              <span className="rounded-full bg-sage-soft px-2.5 py-1 text-xs font-bold uppercase tracking-[.12em] text-sage-text">
                Nutrition checked
              </span>
            )}
          </div>

          <h1 className="mb-1 font-display text-3xl font-semibold leading-[1.05] tracking-[-.02em] text-primary">{item.name}</h1>
          {item.supplierName && (
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[.18em] text-accent">{item.supplierName}</p>
          )}
          <p className="mb-4 text-base leading-7 text-ink-muted">{item.longDescription || item.description}</p>
        </div>

        {/* Bottom CTA — T-17: stepper + gold "Add to Order" is the one action;
            "Buy on its own" is a text secondary beneath it. Opaque, not /95:
            the title scrolled visibly through the bar. */}
        <div className="sticky bottom-4 mt-auto flex w-full flex-col gap-1 rounded-2xl border border-line bg-bg p-4 shadow-[var(--shadow-raised)]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-[.16em] text-ink-muted">Price</span>
              <span className="font-data text-2xl font-bold text-primary">{formatPaise(item.pricePaise)}</span>
            </div>
            <MarketplaceAddToCart item={item} />
          </div>
          <div className="flex justify-end">
            <MarketplaceBuyNow item={item} />
          </div>
        </div>
      </div>
    </div>
  );
}
