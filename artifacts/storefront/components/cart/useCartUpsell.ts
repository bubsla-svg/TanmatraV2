"use client";
// "use client" justification: React Query + the local cart — the cart
// drawer's upsell rail, data side. Selection rules live in lib/upsell.ts.
import { useQuery } from "@tanstack/react-query";
import type { DishData } from "@workspace/menu-catalog";
import { apiGet } from "@/lib/apiClient";
import { addLine, type CartState } from "@/lib/cartStore";
import { emitFunnel } from "@/lib/funnel";
import { listItems } from "@/lib/marketplaceApi";
import { selectUpsell } from "@/lib/upsell";
import type { UpsellRailItem } from "./CartUpsellRail";

/**
 * Upsell candidates for the cart drawer, ready to render (T7).
 *
 * Which catalog is fetched follows the cart, not the other way round:
 *
 * - a cart with a dish line → the public menu (`["menu","public"]`, the same
 *   key AlacarteDetails uses, so checkout and the drawer share one cache
 *   entry) — the rail offers FOOD cheaper than the cheapest meal;
 * - a pantry-only cart → the marketplace catalog (`["marketplace","items"]`,
 *   shared with MarketplaceGrid) — the rail offers pantry items;
 * - an empty cart → neither query runs and there is no rail.
 *
 * Both are fetched only while the sheet is open: this hook mounts on every
 * page. A failed fetch simply means no rail — decoration must not add noise
 * where the customer is about to pay. Nothing here gates the money path:
 * every price on a card is the server's own catalog price, and the server
 * re-prices the line at order create.
 */
export function useCartUpsell(
  open: boolean,
  cart: CartState,
  setCart: (next: CartState) => void,
): UpsellRailItem[] {
  const hasDish = cart.lines.some((l) => l.kind === "dish");
  const hasLines = cart.lines.length > 0;

  const menu = useQuery({
    queryKey: ["menu", "public"],
    queryFn: () => apiGet<{ dishes: DishData[] }>("/menu/public"),
    staleTime: 5 * 60_000,
    retry: 1,
    enabled: open && hasDish,
  });
  const pantry = useQuery({
    queryKey: ["marketplace", "items"],
    queryFn: () => listItems(),
    staleTime: 5 * 60_000,
    retry: 1,
    enabled: open && hasLines && !hasDish,
  });

  const selection = selectUpsell({
    dishes: menu.data?.dishes,
    marketplaceItems: pantry.data?.items,
    cartLines: cart.lines,
  });

  // Same line shapes the menu card (AddToCart) and MarketplaceGrid write, so
  // an upsell line is indistinguishable downstream from a browsed one: ids,
  // slugs and prices all resolve server-side. The funnel event is what tells
  // the scoreboard this add came from the rail and not the menu.
  if (selection.kind === "dish") {
    return selection.items.map((dish) => ({
      key: `dish-${dish.id}`,
      name: dish.name,
      description: dish.description,
      pricePaise: dish.price,
      onAdd: () => {
        setCart(
          addLine(cart, {
            dishId: dish.id,
            kind: "dish",
            slug: dish.slug,
            name: dish.name,
            pricePaise: dish.price,
            // D-14: the same figures the menu card shows, omitted when the
            // dish has none rather than a fabricated {0,0}.
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
          }),
        );
        emitFunnel("add_to_cart", { dish_id: dish.slug, price_paise: dish.price, kind: "dish", source: "cart_upsell" });
      },
    }));
  }
  if (selection.kind === "marketplace") {
    return selection.items.map((item) => ({
      key: `marketplace-${item.id}`,
      name: item.name,
      description: item.description,
      pricePaise: item.pricePaise,
      onAdd: () => {
        setCart(
          addLine(cart, {
            dishId: item.id,
            kind: "marketplace",
            slug: item.slug,
            name: item.name,
            pricePaise: item.pricePaise,
          }),
        );
        emitFunnel("add_to_cart", { dish_id: item.slug, price_paise: item.pricePaise, kind: "marketplace", source: "cart_upsell" });
      },
    }));
  }
  return [];
}
