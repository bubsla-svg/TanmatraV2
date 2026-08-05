/**
 * Focus-shell route registry — the single source of truth for which routes
 * render inside the strict FocusLayout shell (components/FocusLayout.tsx).
 *
 * A focus route is a high-intent flow (authentication, checkout, onboarding,
 * dish PDP) where the global chrome must get out of the way:
 *   - the global bottom tab bar MUST NOT render (MobileBottomNav returns
 *     null), so the flow owns the bottom edge and the back gesture,
 *   - the global Header strips every interactive element (location picker,
 *     ⌘K search, nav links, theme toggle) down to the brand link, so a page
 *     that carries its own location/search input can never collide with a
 *     second copy of the same state in the chrome,
 *   - sticky money bars inside these routes anchor at `bottom-0`, not the
 *     `bottom-16` tab-bar band (see MiniCartBar's band comment).
 *
 * Subtree semantics: an entry covers the route AND everything under it
 * ("/checkout" also matches "/checkout/anything"). Matching is
 * boundary-aware — "/dish" matches "/dish/x" but never "/dishes".
 *
 * Pure and dependency-free on purpose: lib/ files run under node --test with
 * no "@/" aliases (lint:filecap enforces this), and focusRoutes.test.ts
 * exercises the matcher without a DOM.
 */
export const FOCUS_ROUTES = [
  "/auth",
  "/login",
  "/quiz",
  "/plan",
  "/custom-build",
  "/checkout",
  "/corporate/invite",
  "/quick-setup",
  "/dish",
  "/trial",
  "/order/confirmed",
] as const;

export function isFocusRoute(pathname: string): boolean {
  let path = pathname.split(/[?#]/)[0] ?? "";
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  
  // The marketplace root is a global route, but its PDPs are focus routes
  if (path.startsWith("/marketplace/") && path.length > "/marketplace/".length) {
    return true;
  }
  
  return FOCUS_ROUTES.some(
    (route) => path === route || path.startsWith(`${route}/`),
  );
}
