"use client";
// Public marketplace browse: category filter + product cards. No auth (buying
// is gated on the detail page). The full catalogue loads once through
// useQuery (["marketplace","items"]) and category chips filter it client-side
// — genuinely instant (no per-chip network round trip), matching the intent
// of the comment this file already carried.
//
// `initialItems` comes from app/marketplace/page.tsx's server-side fetch
// (fetchMarketplaceItemsServer, revalidate:3600 — the same pattern
// lib/catalog.ts already uses for /menu) and seeds useQuery's initialData,
// so first paint has real cards instead of an empty shell + "Loading
// pantry…", matching every other catalog surface. The client-side query
// stays wired for retry-on-error; it just doesn't need to run on mount to
// have something to show.
import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { formatPaise } from "@/lib/format";
import { listItems, type MarketplaceItem } from "@/lib/marketplaceApi";
import { useCart } from "@/components/cart/CartProvider";
import { addLine } from "@/lib/cartStore";

const CATEGORIES = ["all", "oils", "sauces", "supplements", "snacks", "pantry"] as const;

export function MarketplaceGrid({ initialItems }: { initialItems: MarketplaceItem[] }) {
  const [category, setCategory] = useState<string>("all");
  const { cart, setCart } = useCart();

  const {
    data: allItems,
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["marketplace", "items"],
    queryFn: () => listItems("all").then((r) => r.items),
    initialData: initialItems.length > 0 ? initialItems : undefined,
  });

  const items = useMemo(() => {
    if (!allItems) return null;
    return category === "all" ? allItems : allItems.filter((it) => it.category === category);
  }, [allItems, category]);

  return (
    <div>
      <div className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            aria-pressed={category === c}
            className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-xs font-medium capitalize transition-colors ${
              category === c ? "border-[var(--gold)] bg-[color-mix(in_srgb,var(--gold)_12%,transparent)] text-gold-text" : "border-line text-ink-muted hover:border-line-strong hover:text-ink"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {isError && (
        <div className="mt-6 flex items-center gap-3">
          <p className="text-sm text-ink-muted">Couldn&rsquo;t load the pantry.</p>
          <button type="button" onClick={() => void refetch()} className="text-xs font-semibold text-gold-text hover:underline">
            Retry
          </button>
        </div>
      )}
      {!isError && isPending && <p className="mt-6 text-sm text-ink-muted">Loading pantry…</p>}
      {!isError && items?.length === 0 && <p className="mt-6 text-sm text-ink-muted">No items on this shelf yet.</p>}

      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items?.map((it) => {
          return (
            <div
              key={it.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-colors hover:border-line-strong"
            >
              <Link href={`/marketplace/${it.slug}`} className="group flex flex-1 flex-col">
                <div className="relative aspect-square w-full overflow-hidden bg-surface-raised">
                  {it.image && (
                    // eslint-disable-next-line @next/next/no-img-element -- unoptimized <img>, see next.config
                    <img
                      src={it.image}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                    />
                  )}
                  {it.rdVerified && (
                    <span className="absolute left-3 top-3 rounded-full bg-sage-soft px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-sage-text backdrop-blur-sm">
                      RD-verified
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2 p-5">
                  <h2 className="line-clamp-1 text-base font-semibold text-ink">{it.name}</h2>
                  <p className="line-clamp-2 text-sm leading-relaxed text-ink-muted">{it.description}</p>
                  <p className="tabular mt-auto pt-4 text-sm font-semibold text-ink">
                    {formatPaise(it.pricePaise)}
                    {it.weightLabel && <span className="font-normal text-ink-faint"> · {it.weightLabel}</span>}
                  </p>
                </div>
              </Link>
              <div className="border-t border-line p-5 pt-4">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setCart(addLine(cart, { dishId: it.id, kind: "marketplace", slug: it.slug, name: it.name, pricePaise: it.pricePaise }));
                  }}
                  className="w-full rounded-full border border-line px-4 py-2 text-xs font-semibold text-ink transition-colors hover:border-line-strong hover:bg-surface-raised"
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
