"use client";
// Client: seeds the shared cart from a past order via the pure reorder core.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart/CartProvider";
import { apiGet } from "@/lib/apiClient";
import { checkoutHref } from "@/lib/checkoutIntent";
import { emitFunnel } from "@/lib/funnel";
import { reorderIntoCart, type ReorderMenuDish } from "@/lib/reorder";
import type { OrderLineItem } from "@/lib/ordersApi";

type DoneState = { added: number; dropped: string[] };

/**
 * Reorder in TWO taps (T8, CRO handoff 2026-09-17): tap one re-seeds the cart
 * from this order's lines against the CURRENT menu (today's prices — the
 * server re-prices at order anyway) and lands straight on the à-la-carte
 * checkout, where the address is already prefilled (session draft or the
 * account's saved address) and the sheet remembers the customer's instrument
 * (T0: customer_id + remember_customer); tap two is Pay. It used to stop at
 * "View cart →" on /menu — a third and fourth tap before the money step.
 *
 * The one case that does NOT auto-advance: a line that left the menu. Then
 * the drop is named here, before the hand-off, with the checkout link
 * beside it — dropped honestly, never silently. Orders from api-server
 * builds without the items field render no button at all.
 */
export function ReorderButton({
  items,
  source = "order_history",
  label = "Reorder",
}: {
  items: OrderLineItem[];
  source?: "order_history" | "order_confirmed";
  label?: string;
}) {
  const { cart, setCart } = useCart();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<DoneState | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (items.length === 0) return null;
  const checkout = checkoutHref({ mode: "alacarte" });

  async function reorder() {
    setBusy(true);
    setError(null);
    let navigating = false;
    try {
      const { dishes } = await apiGet<{ dishes: ReorderMenuDish[] }>("/menu/public");
      const result = reorderIntoCart(cart, items, dishes);
      setCart(result.cart);
      emitFunnel("reorder", { source, added: result.added, dropped: result.dropped.length });
      if (result.added > 0 && result.dropped.length === 0) {
        navigating = true; // stays "busy" until the route swaps — no flash of the idle label
        router.push(checkout);
        return;
      }
      setDone({ added: result.added, dropped: result.dropped });
    } catch {
      setError("Couldn't reach the menu just now — try again in a moment.");
    } finally {
      if (!navigating) setBusy(false);
    }
  }

  if (done) {
    return (
      <p className="mt-2 text-sm text-ink-muted">
        {done.added > 0 ? (
          <>
            Added {done.added} item{done.added === 1 ? "" : "s"} to your cart.{" "}
            <Link href={checkout} className="font-semibold text-primary underline-offset-4 hover:underline">
              Continue to checkout &rarr;
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
    <span className="inline-flex items-center gap-3">
      <button
        type="button"
        disabled={busy}
        aria-busy={busy}
        aria-live="polite"
        onClick={() => void reorder()}
        className="-my-2 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline disabled:opacity-40"
      >
        {busy ? "Adding…" : label}
      </button>
      {error && <span role="alert" className="text-xs font-medium text-danger">{error}</span>}
    </span>
  );
}
