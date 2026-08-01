"use client";
import { memo } from "react";
import Link from "next/link";
import { formatPaise } from "@/lib/format";
import type { MarketplaceItem } from "@/lib/marketplaceApi";

/**
 * One product tile in the marketplace grid.
 *
 * `memo`'d: MarketplaceGrid can render dozens of these, and tapping "Quick
 * Add" on ANY one of them changes the shared cart — which used to re-render
 * every OTHER card too (React.memo does nothing if the `onAdd` prop is a new
 * closure every render). MarketplaceGrid passes a `onAdd` stabilized via a
 * cart ref instead of the live `cart` value, so a card's identity is stable
 * across unrelated cart mutations and this memo boundary actually holds.
 */
export const MarketplaceItemCard = memo(function MarketplaceItemCard({
  item,
  onAdd,
}: {
  item: MarketplaceItem;
  onAdd: (item: MarketplaceItem) => void;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-colors hover:border-line-strong">
      <Link href={`/marketplace/${item.slug}`} className="group flex flex-1 flex-col">
        <div className="relative aspect-square w-full overflow-hidden bg-surface-raised">
          {item.image && (
            // eslint-disable-next-line @next/next/no-img-element -- unoptimized <img>, see next.config
            <img
              src={item.image}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            />
          )}
          {item.rdVerified && (
            <span className="absolute left-3 top-3 rounded-full bg-sage-soft px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-sage-text backdrop-blur-sm">
              RD-verified
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2 p-5">
          <h2 className="line-clamp-1 text-base font-semibold text-ink">{item.name}</h2>
          <p className="line-clamp-2 text-sm leading-relaxed text-ink-muted">{item.description}</p>
          <p className="tabular mt-auto pt-4 text-sm font-semibold text-ink">
            {formatPaise(item.pricePaise)}
            {item.weightLabel && <span className="font-normal text-ink-faint"> · {item.weightLabel}</span>}
          </p>
        </div>
      </Link>
      <div className="border-t border-line p-5 pt-4">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onAdd(item);
          }}
          className="w-full rounded-full border border-line px-4 py-2 text-xs font-semibold text-ink transition-colors hover:border-line-strong hover:bg-surface-raised"
        >
          Quick Add
        </button>
      </div>
    </div>
  );
});
