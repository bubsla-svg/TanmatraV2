"use client";
// "use client" justification: the bundle card is the page's one interactive
// island — it opens the combo drawer and adds the constituent dishes to the
// cart. The page shell around it stays RSC.
import { useState } from "react";
import Link from "next/link";
import type { MealBundle } from "@/lib/mealBundles";
import { formatPaise } from "@/lib/format";
import { addLine } from "@/lib/cartStore";
import { useCart } from "@/components/cart/CartProvider";
import { SafeImage } from "@/components/ui/SafeImage";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";

/**
 * The combo card `/meal-deals` was missing. The page used to render a solid
 * "Select Bundle" `<button>` in a Server Component — no handler, no link, no
 * form. A gold CTA that does nothing is the exact dead-end the cart's own
 * header comment forbids, on a surface whose only job is revenue.
 *
 * This is CLAUDE.md's combo convention, verbatim: a single clickable card
 * opening a Dialog (the house bottom-sheet drawer) that lists the constituent
 * dishes — each linking to /dish/[slug] — with an "Add Combo" CTA. Adding a
 * combo is N ordinary cart lines at their own server-owned catalog prices;
 * the bundle total is their sum, never a reprice (lib/mealBundles.ts).
 */
export function BundleCard({ bundle }: { bundle: MealBundle }) {
  const { cart, setCart, setCartOpen } = useCart();
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState(false);

  function addCombo() {
    // One ordinary line per constituent — same shape AddToCart writes (D-14:
    // macros ride along when the dish has them; D-19: availability backstop).
    let next = cart;
    for (const dish of bundle.dishes) {
      next = addLine(
        next,
        {
          dishId: dish.id,
          kind: "dish",
          slug: dish.slug,
          name: dish.name,
          pricePaise: dish.price,
          ...(dish.macros
            ? {
                macros: {
                  calories: dish.macros.calories,
                  protein: dish.macros.protein,
                  estimated: dish.macrosEstimated,
                  provisional: dish.macrosProvisional,
                },
              }
            : {}),
        },
        { isAvailable: dish.isAvailable },
      );
    }
    setCart(next);
    setAdded(true);
    // Land the customer where the added lines are visible and editable —
    // the same cart drawer every other add flows into.
    setOpen(false);
    setCartOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-left rounded-3xl border border-line bg-surface p-5 flex flex-col gap-4 shadow-sm transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
      >
        <div className="flex justify-between items-start">
          <div>
            <span className="inline-block px-2 py-1 rounded-full bg-surface-raised border border-line font-bold text-3xs text-primary uppercase tracking-widest mb-2">
              {bundle.badge}
            </span>
            <h2 className="font-bold text-xl text-ink mb-1">{bundle.title}</h2>
            <p className="text-sm text-ink-muted">{bundle.desc}</p>
          </div>
          <div className="text-right flex-shrink-0 ml-4">
            <div className="font-clinical-data text-lg text-gold-text">{formatPaise(bundle.totalPaise)}</div>
            <div className="font-bold text-3xs text-ink-muted uppercase mt-1">{bundle.mealCount} Meals</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-2">
          {bundle.dishes.slice(0, 4).map((dish) => (
            <div key={dish.id} className="flex items-center gap-2 rounded-xl bg-surface-raised p-2 border border-line">
              <div className="relative w-10 h-10 rounded-md overflow-hidden bg-surface flex-shrink-0">
                <SafeImage src={dish.image ?? ""} alt={dish.name} className="h-full w-full" />
              </div>
              <span className="text-xs font-semibold text-ink line-clamp-2">{dish.name}</span>
            </div>
          ))}
          {bundle.dishes.length > 4 && (
            <div className="flex items-center justify-center rounded-xl bg-surface-raised border border-line p-2 text-xs text-ink-muted font-semibold">
              +{bundle.dishes.length - 4} more
            </div>
          )}
        </div>

        {/* Affordance, not a nested control — the CARD is the button. */}
        <span className="w-full mt-2 rounded-lg border border-gold bg-surface px-4 py-3 text-center text-sm font-bold text-gold-text">
          {added ? "In your cart — tap to view again" : "See what's inside"}
        </span>
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerTitle className="text-lg font-semibold text-ink">{bundle.title}</DrawerTitle>
          <DrawerDescription className="text-sm text-ink-muted">
            {bundle.mealCount} dishes, each at its own menu price — the combo total is simply their sum.
          </DrawerDescription>
          <div className="flex-1 overflow-y-auto flex flex-col gap-2 py-3">
            {bundle.dishes.map((dish) => (
              <Link
                key={dish.id}
                href={`/dish/${encodeURIComponent(dish.slug)}`}
                className="flex items-center gap-3 rounded-xl border border-line bg-surface-raised p-2 transition-transform active:scale-[0.98]"
              >
                <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-surface">
                  <SafeImage src={dish.image ?? ""} alt={dish.name} className="h-full w-full" />
                </div>
                <span className="min-w-0 flex-1 text-sm font-semibold text-ink line-clamp-2">{dish.name}</span>
                <span className="tabular text-sm font-semibold text-ink">{formatPaise(dish.price)}</span>
              </Link>
            ))}
          </div>
          <div className="border-t border-line pt-3 flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-3xs font-bold uppercase tracking-widest text-ink-muted">Combo total</span>
              <span className="tabular text-lg font-bold text-ink">{formatPaise(bundle.totalPaise)}</span>
            </div>
            <Button type="button" onClick={addCombo} shape="pill" className="px-6 py-3 font-semibold">
              Add Combo
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
