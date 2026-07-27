import { MarketplaceGrid } from "@/components/marketplace/MarketplaceGrid";

export function Section04bMarketplace() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4">
      <div className="mb-8 max-w-2xl">
        <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Dietitian-Approved Pantry
        </h2>
        <p className="mt-4 text-base leading-relaxed text-ink-muted">
          Healthy snacks, zero-sugar sauces, and pantry staples approved by our experts. Add them to your next meal delivery or order separately.
        </p>
      </div>
      <MarketplaceGrid />
    </section>
  );
}
