"use client";
// Public marketplace browse: category filter + product cards. No auth (buying
// is gated on the detail page). Client-fetched so category chips are instant.
import { useEffect, useState } from "react";
import Link from "next/link";
import { formatPaise } from "@/lib/format";
import { listItems, type MarketplaceItem } from "@/lib/marketplaceApi";
import { useCart } from "@/components/cart/CartProvider";
import { addLine } from "@/lib/cartStore";

const CATEGORIES = ["all", "oils", "sauces", "supplements", "snacks", "pantry"] as const;

export function MarketplaceGrid() {
  const [category, setCategory] = useState<string>("all");
  const [items, setItems] = useState<MarketplaceItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { cart, setCart } = useCart();

  useEffect(() => {
    let live = true;
    setItems(null);
    setError(null);
    listItems(category)
      .then((r) => { if (live) setItems(r.items); })
      .catch(() => { if (live) setError("Couldn't load the pantry."); });
    return () => { live = false; };
  }, [category]);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            aria-pressed={category === c}
            className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${
              category === c ? "border-[var(--gold)] bg-[color-mix(in_srgb,var(--gold)_12%,transparent)] text-gold-text" : "border-line text-ink-muted hover:text-ink"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {error && <p className="mt-6 text-sm text-ink-muted">{error}</p>}
      {!error && items === null && <p className="mt-6 text-sm text-ink-muted">Loading pantry…</p>}
      {items?.length === 0 && <p className="mt-6 text-sm text-ink-muted">No items on this shelf yet.</p>}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items?.map((it) => {
          return (
            <div key={it.id} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
              <Link href={`/marketplace/${it.slug}`} className="flex flex-1 flex-col">
                <div className="relative h-40 bg-surface-raised">
                  {it.image && (
                    // eslint-disable-next-line @next/next/no-img-element -- unoptimized <img>, see next.config
                    <img src={it.image} alt="" loading="lazy" className="h-full w-full object-cover" />
                  )}
                  {it.rdVerified && (
                    <span className="absolute left-2 top-2 rounded-full bg-sage px-2 py-0.5 text-[10px] font-semibold text-sage-foreground">RD-verified</span>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <p className="text-sm font-semibold text-ink">{it.name}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{it.description}</p>
                  <p className="tabular mt-2 text-sm font-semibold text-ink">
                    {formatPaise(it.pricePaise)}
                    {it.weightLabel && <span className="font-normal text-ink-faint"> · {it.weightLabel}</span>}
                  </p>
                </div>
              </Link>
              <div className="p-4 pt-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setCart(addLine(cart, { dishId: it.id, kind: "marketplace", slug: it.slug, name: it.name, pricePaise: it.pricePaise }));
                  }}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface-raised transition-colors"
                >
                  Quick Add
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
