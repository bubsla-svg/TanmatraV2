"use client"; // Justification: renders inside the client-only cart drawer; "+ Add" writes the local cart.

import { formatPaise } from "@/lib/format";
import type { MarketplaceItem } from "@/lib/marketplaceApi";
import { Rail } from "@/components/primitives/Rail";

/**
 * Upsell rail in the cart drawer — REAL catalog items only, shaped so it can
 * never crowd the order.
 *
 * This component used to ship its own invented four-item catalog (ids
 * 901–904) that existed nowhere server-side. Adding one persisted a phantom
 * line: checkout excluded it (marketplace lines ship separately) and told the
 * customer to buy it from the marketplace — where the product did not exist.
 * A dead end wearing a recommendation, priced with numbers no server quoted.
 * The candidates now come from the same public catalog the marketplace grid
 * renders; CartDrawer owns that query (same key as MarketplaceGrid, so the
 * cache is shared) and the selection rules live in lib/upsell.ts.
 *
 * Shape: ONE horizontal row of fixed-width cards — the shared Rail primitive
 * with its trailing fade as the continuation cue — so the rail is the same
 * height for one candidate or three. It used to be a vertical stack that
 * grew ~90px per item: three of them out-weighed a two-line order on a 667px
 * phone. Where the row sits under the order is measured by the drawer
 * (useUpsellRailFit); this is presentation only, and it renders nothing for
 * an empty list so the drawer measures it as zero.
 *
 * Degradation stays SILENT: the rail is decoration, and an error state inside
 * the cart would be noise exactly when the customer is trying to pay.
 * Nothing here gates the money path.
 */
export function CartUpsellRail({
  items,
  onAdd,
}: {
  items: MarketplaceItem[];
  onAdd: (item: MarketplaceItem) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-2xl bg-secondary p-3">
      <p className="text-[10px] font-bold uppercase tracking-[.16em] text-ink-muted">
        Recommended Add-ons
      </p>
      <Rail as="ul" aria-label="Recommended add-ons" className="-mx-3 mt-2 gap-2 px-3 scroll-pl-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex w-56 shrink-0 snap-start items-center justify-between gap-2 rounded-xl bg-surface p-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-base font-semibold leading-tight text-primary">{item.name}</p>
              <p className="truncate text-2xs text-ink-muted">{item.description}</p>
              <p className="font-data text-xs font-bold text-primary">
                {formatPaise(item.pricePaise)}
              </p>
            </div>
            {/* D-08: Secondary CTA — up to 3 of these can render alongside the
                drawer's own Checkout button, which stays the one gold action. */}
            <button
              type="button"
              onClick={() => onAdd(item)}
              aria-label={`Add ${item.name}`}
              className="min-h-11 shrink-0 rounded-full border border-line-strong bg-surface px-3.5 py-1.5 text-xs font-bold text-ink transition-transform active:scale-95 hover:bg-surface-raised"
            >
              + Add
            </button>
          </li>
        ))}
      </Rail>
    </div>
  );
}
