import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchMarketplaceItemsServer } from "@/lib/marketplaceApi";
import { SafeImage } from "@/components/ui/SafeImage";
import { formatPaise } from "@/lib/format";
import { MarketplaceAddToCart } from "@/components/cart/MarketplaceAddToCart";
import { MarketplaceBuyNow } from "@/components/marketplace/MarketplaceBuyNow";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const items = await fetchMarketplaceItemsServer();
  const item = items.find(i => i.slug === resolvedParams.slug);
  if (!item) return { title: "Not Found | Tanmatra" };
  return { title: `${item.name} | Tanmatra` };
}

export default async function MarketplaceItemPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const items = await fetchMarketplaceItemsServer();
  const item = items.find(i => i.slug === resolvedParams.slug);
  if (!item) notFound();

  return (
    <div data-ui-generation="stitch-74" data-screen-id="5.8" data-screen-state="default" className="min-h-dvh flex flex-col bg-surface-canvas pb-24">
      {/* Hero Image */}
      <div className="relative w-full aspect-square md:aspect-video overflow-hidden">
        <SafeImage src={item.image ?? ""} alt={item.name} className="h-full w-full" />
      </div>

      <div className="px-gutter pt-6 flex-1 flex flex-col">
        {/* Header Section */}
        <div className="mb-6">
          <div className="flex gap-2 items-center mb-3">
            <span className="px-2 py-1 rounded-full bg-surface-raised border border-line font-label-caps text-[10px] text-ink-secondary uppercase tracking-widest">
              {item.category}
            </span>
            {item.rdVerified && (
              <span className="px-2 py-1 rounded-full bg-sage-soft/90 border border-sage-strong/20 font-label-caps text-[10px] text-sage-text uppercase tracking-widest">
                RD Verified
              </span>
            )}
          </div>
          
          <h1 className="font-headline-md text-3xl text-ink-primary mb-1">{item.name}</h1>
          {item.supplierName && (
            <p className="font-label-caps text-[11px] text-primary uppercase tracking-widest mb-3">{item.supplierName}</p>
          )}
          <p className="text-ink-secondary text-sm leading-relaxed mb-4">{item.longDescription || item.description}</p>
        </div>

        {/* Bottom CTA */}
        <div className="sticky bottom-4 w-full bg-surface-canvas/95 backdrop-blur-md p-4 rounded-3xl border border-line flex items-center justify-between gap-3 shadow-2xl mt-auto">
          <div className="flex flex-col">
            <span className="font-label-caps text-[10px] text-ink-muted uppercase tracking-widest">Price</span>
            <span className="font-clinical-data text-xl text-gold-text">{formatPaise(item.pricePaise)}</span>
          </div>
          <div className="flex items-center gap-2">
            <MarketplaceAddToCart item={item} />
            <MarketplaceBuyNow item={item} />
          </div>
        </div>
      </div>
    </div>
  );
}
