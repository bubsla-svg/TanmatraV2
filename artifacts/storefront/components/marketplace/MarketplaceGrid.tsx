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
import { useCallback, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listItems, type MarketplaceItem } from "@/lib/marketplaceApi";
import { useCart } from "@/components/cart/CartProvider";
import { addLine } from "@/lib/cartStore";
import { MarketplaceItemCard } from "./MarketplaceItemCard";

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

  // Read through a ref, not the `cart` closure directly: `handleAdd`'s
  // identity would otherwise change every time ANY item is added (since
  // `cart` changes), which defeats `memo(MarketplaceItemCard)` for every
  // OTHER card in the grid on every single add.
  const cartRef = useRef(cart);
  cartRef.current = cart;
  const handleAdd = useCallback(
    (item: MarketplaceItem) => {
      setCart(addLine(cartRef.current, { dishId: item.id, kind: "marketplace", slug: item.slug, name: item.name, pricePaise: item.pricePaise }));
    },
    [setCart],
  );

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
        {items?.map((it) => (
          <MarketplaceItemCard key={it.id} item={it} onAdd={handleAdd} />
        ))}
      </div>
    </div>
  );
}
