"use client";
// Client: cart state + the PDP's on-demand Cart Drawer host.
import { useState, Suspense } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import type { DishData, DishMacros } from "@workspace/menu-catalog";
import { Button } from "@/components/ui/button";
import { formatPaise } from "@/lib/format";
import { addLine, itemCount, qtyOf, setQty, subtotalPaise } from "@/lib/cartStore";
import { useCart } from "@/components/cart/CartProvider";
import { AddToCart } from "@/components/cart/AddToCart";

// Same on-demand load as MiniCartBar's host: the drawer pulls in Vaul, and
// most PDP visits never open it.
const CartDrawer = dynamic(
  () => import("@/components/cart/CartDrawer").then((m) => m.CartDrawer),
  { ssr: false },
);

// isAvailable, macros and the two provenance flags all optional — see
// AddToCart.tsx's identical Dish type for the rationale (D-19 availability,
// D-14 best-effort macro capture).
type Dish = Pick<DishData, "id" | "slug" | "name" | "price"> & {
  isAvailable?: boolean;
  macros?: DishMacros;
  macrosEstimated?: boolean;
  macrosProvisional?: boolean;
};
const GROUP_CODE = /^[0-9A-Za-z]{6,8}$/;

/**
 * The dish PDP's StickyAddToCartLedger (UX/UI Architecture Phase 2 §6): a
 * primary gold "Add to cart" that adds the dish AND opens the Cart Drawer —
 * the doc's canonical route onward (PDP → Cart Drawer → /checkout). At qty>0
 * the primary face becomes "View cart" with an in-place stepper beside it, so
 * a returning visitor always sees both a quantity control and the single
 * primary route forward. This supersedes PdpCartLink's direct /checkout link:
 * the drawer owns the checkout CTA (and its flag-dark loud state), so the
 * PDP no longer needs its own copy of that logic.
 */
export function PdpBuyLedger({ dish }: { dish: Dish }) {
  return (
    <Suspense fallback={<LocalLedger dish={dish} />}>
      <PdpBuyLedgerResolved dish={dish} />
    </Suspense>
  );
}

function PdpBuyLedgerResolved({ dish }: { dish: Dish }) {
  // An invitee arriving from a group order adds to the SHARED group, not the
  // local cart — AddToCart owns that path (server-resolved, host pays).
  const group = useSearchParams().get("group");
  if (group && GROUP_CODE.test(group)) return <AddToCart dish={dish} />;
  return <LocalLedger dish={dish} />;
}

function LocalLedger({ dish }: { dish: Dish }) {
  const { cart, setCart, hydrated } = useCart();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const qty = qtyOf(cart, dish.id, "dish");
  const count = itemCount(cart);

  // D-19: the PDP's sticky CTA is the primary place a customer discovers a
  // paused dish — the whole point is answering it BEFORE checkout, not
  // after. Same disabled treatment regardless of hydration/cart state,
  // since a paused dish is never addable no matter what else is true.
  if (dish.isAvailable === false) {
    return (
      <Button
        type="button"
        disabled
        shape="pill"
        size="fluid"
        className="min-h-11 flex-1 px-6 py-3 font-semibold opacity-70"
      >
        Back soon — kitchen has paused this dish
      </Button>
    );
  }

  if (!hydrated) {
    // Stable-height placeholder: no wrong-state flash for returning visitors,
    // no layout shift when the real face arrives.
    return (
      <Button type="button" disabled shape="pill" size="fluid" className="min-h-11 px-6 py-3 font-semibold opacity-60">
        Add to cart
      </Button>
    );
  }

  return (
    <>
      <div className="flex items-center gap-3">
        {qty > 0 && (
          <div className="flex items-center rounded-lg border border-line-strong bg-surface" role="group" aria-label={`${dish.name} quantity`}>
            <button type="button" aria-label="Decrease quantity" onClick={() => setCart(setQty(cart, dish.id, "dish", qty - 1))} className="min-h-11 min-w-11 px-3 text-lg font-semibold text-ink transition-transform active:scale-[0.98]">
              −
            </button>
            <span aria-live="polite" className="tabular min-w-6 text-center text-sm font-semibold text-ink">{qty}</span>
            <button type="button" aria-label="Increase quantity" onClick={() => setCart(setQty(cart, dish.id, "dish", qty + 1))} className="min-h-11 min-w-11 px-3 text-lg font-semibold text-ink transition-transform active:scale-[0.98]">
              +
            </button>
          </div>
        )}
        {qty === 0 ? (
          <Button
            type="button"
            shape="pill"
            size="fluid"
            className="min-h-11 flex-1 px-6 py-3 font-semibold"
            onClick={() => {
              setCart(
                // cartStore's own backstop (D-19) — the disabled branch
                // above is the primary gate; this dish is available by the
                // time execution reaches here, but the guard costs nothing.
                addLine(
                  cart,
                  {
                    dishId: dish.id,
                    kind: "dish",
                    slug: dish.slug,
                    name: dish.name,
                    pricePaise: dish.price,
                    // D-14: same figures the PDP's own macro strip already shows.
                    ...(dish.macros
                      ? { macros: { calories: dish.macros.calories, protein: dish.macros.protein, estimated: dish.macrosEstimated, provisional: dish.macrosProvisional } }
                      : {}),
                  },
                  { isAvailable: dish.isAvailable },
                ),
              );
              setDrawerOpen(true);
            }}
          >
            Add to cart
          </Button>
        ) : (
          <Button
            type="button"
            shape="pill"
            size="fluid"
            className="min-h-11 flex-1 px-6 py-3 font-semibold"
            onClick={() => setDrawerOpen(true)}
          >
            View cart · {count} {count === 1 ? "item" : "items"} · {formatPaise(subtotalPaise(cart))}
          </Button>
        )}
      </div>
      <CartDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </>
  );
}
