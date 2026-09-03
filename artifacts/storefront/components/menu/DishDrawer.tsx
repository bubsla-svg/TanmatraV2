"use client";
// "use client" justification: the PDP drawer is a URL-driven interactive
// island (§4.2) — open state syncs to ?dish=<slug> so shares and back-button
// behave; closing rewrites the URL. Everything around it stays RSC.
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isAlaCarteEnabled, type DishData } from "@workspace/menu-catalog";
import { formatGrams, formatKcal, formatPaise } from "@/lib/format";
import { itemCount, subtotalPaise } from "@/lib/cartStore";
import { useCart } from "@/components/cart/CartProvider";
import { Button } from "@/components/ui/button";
import { AddToCart } from "@/components/cart/AddToCart";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { DishRationale } from "./DishRationale";
import { DishSpec } from "./DishSpec";
import { DishAllergens } from "./DishAllergens";
import { DishImage } from "@/components/menu/DishImage";

/**
 * Dish detail as a bottom sheet over the menu (§4.2): users triage dishes in
 * rapid succession — a route push per dish kills the rhythm. The full
 * /dish/[slug] route stays canonical for shares and SEO; this drawer is the
 * in-flow view, deep-linked via /menu?dish=<slug>.
 */
export function DishDrawer({ dish }: { dish: DishData }) {
  const router = useRouter();
  const { cart, setCartOpen } = useCart();
  const count = itemCount(cart);
  const subtotal = subtotalPaise(cart);
  // Same spellings as the card, the cart and the PDP — lib/format.ts is the
  // one dialect (N5.7). The label carries the nutrient, the value carries its
  // unit; energy used to render as a bare "135" under a "kcal" label while
  // protein rendered "3 g" under a "P" label, in the same four-up row.
  const macros: Array<[string, string]> = [
    ["Energy", formatKcal(dish.macros.calories, dish.macrosEstimated)],
    ["Protein", formatGrams(dish.macros.protein, dish.macrosEstimated)],
    ["Carbs", formatGrams(dish.macros.carbs, dish.macrosEstimated)],
    ["Fat", formatGrams(dish.macros.fat, dish.macrosEstimated)],
  ];

  return (
    <Drawer
      open
      onOpenChange={(open) => {
        if (!open) router.replace("/menu", { scroll: false });
      }}
    >
      <DrawerContent aria-describedby={undefined} data-ui-generation="stitch-74" data-screen-id="5.4" data-screen-state="dish-quick-view-open">
        {/* flex-1 is load-bearing: DrawerContent is itself flex-col, so this
            scroll area filling the REMAINING space (instead of sizing to its
            own content) is what leaves room for the footer below to sit as a
            sibling that never scrolls out of view — the same "buy bar stays,
            content scrolls under it" contract DishBuyBar keeps on the full
            PDP route. Previously the Add-to-cart button was the last thing
            IN this scrolling div, ~200px below the fold on a typical phone. */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-3">
          <div className="overflow-hidden rounded-xl border border-line bg-surface-raised">
            <DishImage src={dish.image} name={dish.name} className="aspect-[16/9] w-full" />
          </div>

          <div className="mt-4 flex items-start justify-between gap-4">
            <DrawerTitle className="font-display text-2xl font-semibold leading-tight text-primary">
              {dish.name}
            </DrawerTitle>
            <span className="font-data shrink-0 text-lg font-bold text-primary">
              {formatPaise(dish.price)}
            </span>
          </div>

          <DrawerDescription className="mt-2 text-sm leading-6 text-ink-muted">
            {dish.tasteDescription || dish.description}
          </DrawerDescription>

          <DishRationale dishId={dish.id} />

          <dl className="mt-4 grid grid-cols-4 gap-2">
            {macros.map(([label, value]) => (
              <div key={label} className="rounded-xl bg-secondary p-2.5 text-center">
                <dd className="font-display text-lg font-semibold text-primary">{value}</dd>
                <dt className="mt-0.5 text-[10px] font-bold uppercase tracking-[.14em] text-ink-muted">{label}</dt>
              </div>
            ))}
          </dl>

          <DishSpec dish={dish} />

          {/* Allergens are never clamped (§6); the disclosure preserves the
              reviewed / auto-detected / under-review states — an unknown list
              is never rendered as "no allergens". */}
          <DishAllergens dish={dish} />
        </div>

        {/* Sibling of the scroll area, not its last child — see the flex-1
            comment above. shrink-0 keeps it from being squeezed as content
            grows; the safe-area pad matches DishBuyBar's fixed bar since this
            sheet already runs to the physical bottom edge on most phones. */}
        <div className="shrink-0 border-t border-line bg-surface px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4">
          <div className="flex items-center justify-between gap-3">
            <Link
              href={`/dish/${dish.slug}`}
              /* 93×20 before, and it sits in the drawer footer beside the Add
                 button — the densest row on the surface, so the easiest to
                 mis-tap. */
              className="touch-target-min text-sm font-medium text-ink-muted underline-offset-4 hover:text-ink hover:underline"
            >
              Open full page
            </Link>
            {/* §4.2 footer Add — server price beside the sole action colour;
                only for à-la-carte-orderable dishes (no dead buttons). */}
            {isAlaCarteEnabled(dish) && <AddToCart dish={dish} />}
          </div>
          {/* THE WAY OUT. Adding a dish here used to turn Add into a bare
              qty stepper and stop — the mini-cart bar that normally carries
              "View cart" sits UNDER this sheet's overlay, so the only exit
              was to dismiss the sheet by hand and go find it. Once the cart
              has anything in it, the forward action is offered right here,
              in the sole action colour, with the live count and subtotal so
              it states what it will show. */}
          {count > 0 && (
            <Button
              type="button"
              onClick={() => {
                // Close this sheet first, then open the cart: two Vaul
                // drawers must never be open at once (each locks scroll and
                // traps focus — stacking them strands the focus ring in the
                // dismissed one).
                router.replace("/menu", { scroll: false });
                setCartOpen(true);
              }}
              shape="pill"
              size="fluid"
              className="mt-3 min-h-12 w-full font-semibold"
            >
              View cart · {count} {count === 1 ? "item" : "items"} · {formatPaise(subtotal)}
            </Button>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
