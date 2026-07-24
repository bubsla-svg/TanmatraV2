import type { Metadata } from "next";
import Link from "next/link";
import { MarketplaceItemView } from "@/components/marketplace/MarketplaceItemView";

export const metadata: Metadata = { title: "Product · Tanmatra Marketplace" };

/**
 * Marketplace item detail (route-parity Wave F). RSC shell; the client island
 * fetches the item and owns the session-gated buy (money-path).
 */
export default async function MarketplaceItemPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <section className="mx-auto max-w-lg px-4 py-8">
      <Link href="/marketplace" className="text-sm text-ink-muted hover:text-ink">&larr; Marketplace</Link>
      <div className="mt-4">
        <MarketplaceItemView slug={slug} />
      </div>
    </section>
  );
}
