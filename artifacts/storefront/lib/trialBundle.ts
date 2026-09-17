/**
 * The three-lunch trio sold as ORDINARY à-la-carte cart lines (T1, CRO handoff
 * 2026-09-17, owner decision (a)).
 *
 * While plan checkout is dark (POST /subscriptions answers 503), the trial's
 * three fixed dishes are still real, orderable menu items. This module turns a
 * resolved trio into cart lines at each dish's own catalog price — the same
 * shape AddToCart and BundleCard write — so "Try three lunches" lands in the
 * working guest checkout instead of a dead route. The total is the SUM of the
 * server's prices, displayed, never a reprice: there is no ₹399 here, because
 * there is no server mechanism to bill one on the à-la-carte path.
 *
 * NO "@/" ALIAS IMPORTS (storefront lib rule).
 */
import { addLine, type CartLine, type CartState } from "./cartStore";
import type { TrioDish } from "./trialTrio";

/** Sum of the trio's catalog prices, in paise. Zero for an empty trio. */
export function trioTotalPaise(trio: readonly TrioDish[]): number {
  return trio.reduce((sum, d) => sum + d.pricePaise, 0);
}

/** One ordinary cart line per trio dish — id, slug, name and the catalog
 *  price snapshot, nothing invented. Macros ride along when the trio can
 *  vouch for them (D-14), exactly as BundleCard does. */
export function trioCartLines(trio: readonly TrioDish[]): Array<Omit<CartLine, "qty">> {
  return trio.map((d) => ({
    dishId: d.id,
    kind: "dish" as const,
    slug: d.slug,
    name: d.name,
    pricePaise: d.pricePaise,
    ...(d.macros
      ? { macros: { calories: d.macros.calories, protein: d.macros.protein, estimated: d.macrosEstimated === true } }
      : {}),
  }));
}

/** The cart with the trio added, one line each. An unavailable dish is
 *  skipped by cartStore's own backstop (D-19) rather than added dead. */
export function withTrioInCart(cart: CartState, trio: readonly TrioDish[]): CartState {
  return trio.reduce(
    (state, d, i) => addLine(state, trioCartLines([d])[0]!, { isAvailable: trio[i]!.isAvailable }),
    cart,
  );
}

/**
 * Where a scan lands when it is not buying the trio: the menu, with the `src`
 * placement carried on the URL so attribution survives even for a visitor who
 * arrived on `/start?src=` directly (the cookie is only written by `/q/[src]`).
 */
export function menuHrefWithSrc(search: string): string {
  const src = new URLSearchParams(search).get("src");
  return src ? `/menu?src=${encodeURIComponent(src)}` : "/menu";
}
