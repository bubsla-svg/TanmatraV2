"use client"; // Justification: fetches the live marketplace catalog for the cart drawer's upsell rail.

import { useQuery } from "@tanstack/react-query";
import { formatPaise } from "@/lib/format";
import { listItems, type MarketplaceItem } from "@/lib/marketplaceApi";
import { selectUpsellItems } from "@/lib/upsell";
import type { CartLine } from "@/lib/cartStore";

/**
 * Upsell rail in the cart drawer — REAL catalog items only.
 *
 * This component used to ship its own invented four-item catalog (ids
 * 901–904) that existed nowhere server-side. Adding one persisted a phantom
 * line: checkout excluded it (marketplace lines ship separately) and told the
 * customer to buy it from the marketplace — where the product did not exist.
 * A dead end wearing a recommendation, priced with numbers no server quoted.
 *
 * Now the candidates come from the same public catalog the marketplace grid
 * renders — same query key, so the cache is shared and opening the cart after
 * browsing the marketplace costs zero extra requests. Selection rules
 * (in-cart exclusion scoped to marketplace lines, stock gating, max 3) live
 * in lib/upsell.ts where they are unit-tested.
 *
 * Degradation is deliberately SILENT (null), unlike the fail-loud checkout
 * CTA: the rail is decoration, and an error banner inside the cart for a
 * failed suggestion fetch would be noise exactly when the customer is trying
 * to pay. Nothing here gates the money path.
 */
export function CartUpsellRail({
  cartLines,
  onAdd,
}: {
  cartLines: CartLine[];
  onAdd: (item: MarketplaceItem) => void;
}) {
  const { data } = useQuery({
    // Same key as MarketplaceGrid — one cache entry serves both surfaces.
    queryKey: ["marketplace", "items"],
    queryFn: () => listItems(),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const candidates = selectUpsellItems(data?.items ?? [], cartLines);
  if (candidates.length === 0) return null;

  return (
    <div className="mt-4 rounded-xl border border-line bg-surface-raised p-3">
      <p className="text-xs font-bold uppercase tracking-wider text-gold-text">
        Recommended Add-ons
      </p>
      <div className="mt-2 flex flex-col gap-2">
        {candidates.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface p-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-ink">{item.name}</p>
              <p className="truncate text-[10px] text-ink-muted">{item.description}</p>
              <p className="tabular text-xs font-medium text-gold-text">
                {formatPaise(item.pricePaise)}
              </p>
            </div>
            {/* D-08: Secondary CTA — up to 3 of these can render alongside the
                drawer's own Checkout button, which stays the one gold action. */}
            <button
              type="button"
              onClick={() => onAdd(item)}
              className="min-h-11 shrink-0 rounded-md border border-line-strong bg-surface px-3 py-1.5 text-xs font-bold text-ink transition-transform active:scale-95 hover:bg-surface-raised"
            >
              + Add
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
