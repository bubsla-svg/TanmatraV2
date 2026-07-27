import { MarketplaceGrid } from "@/components/marketplace/MarketplaceGrid";

export function Section04bMarketplace() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4">
      <div className="mb-8 max-w-2xl">
        <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          The RD-Curated Pantry
        </h2>
        <p className="mt-4 text-base leading-relaxed text-ink-muted">
          Purity-tested supplements, zero-sugar sauces, and single-origin staples. 
          Verified by our clinical dietitians. Ships standalone or bundled with your next meal delivery.
        </p>
      </div>
      <MarketplaceGrid />
    </section>
  );
}
