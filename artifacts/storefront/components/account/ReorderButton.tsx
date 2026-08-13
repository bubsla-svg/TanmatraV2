"use client";
// Client: seeds the shared cart from a past order via the pure reorder core.
import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/components/cart/CartProvider";
import { apiGet } from "@/lib/apiClient";
import { reorderIntoCart, type ReorderMenuDish } from "@/lib/reorder";
import type { OrderLineItem } from "@/lib/ordersApi";

type DoneState = { added: number; dropped: string[] };

/**
 * Reorder (CUJ-09): one tap re-seeds the cart from this order's lines against
 * the CURRENT menu (today's prices — the server re-prices at order anyway),
 * then hands over to CUJ-01 from the cart step via the mini-bar / View cart.
 * Dishes that left the menu are named, not silently dropped. Orders from
 * api-server builds without the items field render no button at all.
 */
export function ReorderButton({ items }: { items: OrderLineItem[] }) {
  const { cart, setCart } = useCart();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<DoneState | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (items.length === 0) return null;

  async function reorder() {
    setBusy(true);
    setError(null);
    try {
      const { dishes } = await apiGet<{ dishes: ReorderMenuDish[] }>("/menu/public");
      const result = reorderIntoCart(cart, items, dishes);
      setCart(result.cart);
      setDone({ added: result.added, dropped: result.dropped });
    } catch {
      setError("Couldn't reach the menu just now — try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p className="mt-2 text-sm text-ink-muted">
        {done.added > 0 ? (
          <>
            Added {done.added} item{done.added === 1 ? "" : "s"} to your cart.{" "}
            <Link href="/menu" className="font-medium text-gold-text hover:underline">
              View cart &rarr;
            </Link>
          </>
        ) : (
          <>Nothing from this order is on the menu right now.</>
        )}
        {done.dropped.length > 0 && (
          <span className="block text-xs text-ink-faint">
            No longer on the menu: {done.dropped.join(", ")}
          </span>
        )}
      </p>
    );
  }

  return (
    <span className="mt-2 inline-flex items-center gap-3">
      <button
        type="button"
        disabled={busy}
        aria-busy={busy}
        aria-live="polite"
        onClick={() => void reorder()}
        className="text-sm font-medium text-gold-text hover:underline disabled:opacity-40"
      >
        {busy ? "Adding…" : "Reorder"}
      </button>
      {error && <span role="alert" className="text-xs font-medium text-[var(--danger)]">{error}</span>}
    </span>
  );
}
