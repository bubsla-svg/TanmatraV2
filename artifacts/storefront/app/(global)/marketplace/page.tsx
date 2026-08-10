import type { Metadata } from "next";
import { fetchMarketplaceItemsServer } from "@/lib/marketplaceApi";
import { SafeImage } from "@/components/ui/SafeImage";
import { formatPaise } from "@/lib/format";

export const metadata: Metadata = {
  title: "Marketplace | Tanmatra",
  description: "Stock your pantry with Tanmatra-approved goods.",
};

export default async function MarketplacePage() {
  const items = await fetchMarketplaceItemsServer();

  return (
    <div data-ui-generation="stitch-74" data-screen-id="5.7" data-screen-state="default" className="min-h-dvh bg-surface-canvas pb-24">
      <div className="sticky top-0 z-20 bg-surface-canvas/95 backdrop-blur-md pt-4 pb-4 px-gutter border-b border-line">
        <h1 className="font-headline-md text-headline-md text-ink-primary">Marketplace</h1>
        <p className="text-sm text-ink-secondary">Tanmatra-approved pantry & supplements</p>
      </div>

      <div className="px-gutter pt-6">
        <div className="grid grid-cols-2 gap-4">
          {items.map((item) => (
            <a key={item.id} href={`/marketplace/${item.slug}`} className="group flex flex-col rounded-2xl border border-line bg-surface p-3 transition-transform active:scale-[0.98]">
              <div className="relative mb-3 overflow-hidden rounded-xl bg-surface-raised border border-line">
                {item.badges.length > 0 && (
                  <div className="absolute top-2 left-2 flex gap-1 z-10 flex-col">
                    {item.badges.map(badge => (
                      <span key={badge} className="px-2 py-1 rounded-full bg-sage-soft/90 backdrop-blur-md border border-sage-strong/20 font-label-caps text-[9px] text-sage-text uppercase tracking-widest">
                        {badge}
                      </span>
                    ))}
                  </div>
                )}
                <SafeImage src={item.image ?? ""} alt={item.name} className="aspect-square w-full" />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <span className="font-label-caps text-[10px] text-ink-muted uppercase tracking-widest">{item.supplierName}</span>
                <h3 className="font-bold text-sm text-ink-primary line-clamp-2 leading-tight">{item.name}</h3>
                {item.weightLabel && <span className="font-mono text-[10px] text-ink-muted">{item.weightLabel}</span>}
                <div className="relative z-10 mt-auto pt-3 flex justify-between items-center">
                  <span className="font-clinical-data text-ink-primary">{formatPaise(item.pricePaise)}</span>
                </div>
              </div>
            </a>
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
