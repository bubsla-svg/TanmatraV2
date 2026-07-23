"use client";
// "use client" justification: one-tap add is THE §4.1 conversion lever — an
// interactive island mounted per orderable dish card/drawer. Quantity stepper
// appears in place after first add, per spec.
import type { DishData } from "@workspace/menu-catalog";
import { addLine, qtyOf, setQty } from "@/lib/cartStore";
import { useCart } from "@/components/cart/CartProvider";

/**
 * One-tap Add → in-place qty stepper (§4.1). Saffron is the sole action
 * colour; steppers meet the 44px touch target via padded hit areas.
 * Mounted only for à-la-carte-orderable dishes — the RSC parent gates on
 * `isAlaCarteEnabled`, so no dead buttons ship for plan-only dishes.
 */
export function AddToCart({ dish }: { dish: Pick<DishData, "id" | "slug" | "name" | "price"> }) {
  const { cart, setCart } = useCart();
  const qty = qtyOf(cart, dish.id);
  const line = { dishId: dish.id, slug: dish.slug, name: dish.name, pricePaise: dish.price };

  if (qty === 0) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          setCart(addLine(cart, line));
        }}
        className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.98]"
      >
        Add
      </button>
    );
  }

  return (
    <div
      className="flex items-center rounded-lg border border-line-strong bg-surface"
      role="group"
      aria-label={`${dish.name} quantity`}
    >
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={(e) => {
          e.preventDefault();
          setCart(setQty(cart, dish.id, qty - 1));
        }}
        className="min-h-11 min-w-11 px-3 text-lg font-semibold text-ink"
      >
        −
      </button>
      <span aria-live="polite" className="tabular min-w-6 text-center text-sm font-semibold text-ink">
        {qty}
      </span>
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={(e) => {
          e.preventDefault();
          setCart(setQty(cart, dish.id, qty + 1));
        }}
        className="min-h-11 min-w-11 px-3 text-lg font-semibold text-ink"
      >
        +
      </button>
    </div>
  );
}
