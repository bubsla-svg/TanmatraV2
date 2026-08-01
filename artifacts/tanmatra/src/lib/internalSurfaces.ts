/**
 * Which routes of this SPA are INTERNAL (Admin ERP / RD console) rather than
 * consumer surfaces.
 *
 * Why this exists at all: the consumer half of this app was removed on
 * 2026-07-26 (`src/routes.ts` — every remaining route is /admin*, /rd-console
 * or a login), but `root.tsx` kept mounting the full consumer chrome around
 * it: the fixed floating Header, the Footer, BottomNav, StickyCheckoutBar and
 * the cart drawer. On an ops console that is not merely redundant, it is
 * actively broken in three separate ways:
 *
 *   1. The Header is `position: fixed; top: 0.75rem` and <main> carries no top
 *      padding, so the header pill sat ON TOP of every admin page's <h1> —
 *      "Admin Console", "AI Runs" and "Ops Agent" were all rendered with their
 *      titles struck through by the nav.
 *   2. Every link in that chrome is dead. Header points at /menu,
 *      /meal-planner, /orders, /challenges, /account; the Footer adds fourteen
 *      more. NONE of those paths are in routes.ts any more, so each one lands
 *      on the catch-all 404. The primary navigation of the admin app was a row
 *      of guaranteed dead ends.
 *   3. A shopping cart, a "Cart & Checkout" footer link and a sticky checkout
 *      bar are meaningless to an internal operator and imply this console can
 *      take an order. It cannot.
 *
 * A path predicate rather than a per-page `handle = { chrome: false }` export
 * because the per-page mechanism is exactly what failed: it exists, twenty
 * consumer pages used it, and not one of the nineteen routed admin pages ever
 * set it. Anything opt-in that nobody opts into is not a control. Route SHAPE
 * is the durable signal — a new page under /admin is internal by construction,
 * so it cannot regress by omission the way the handle did.
 *
 * Kept as a predicate rather than deleting the chrome outright so a future
 * consumer route in this app would get its chrome back automatically; today
 * the predicate matches every route the app has.
 */
const INTERNAL_SURFACE_PATTERNS: RegExp[] = [
  // Root is the Admin console index (routes.ts mounts AdminIndex at "/" with
  // id "ops-erp-root"), not a consumer home page.
  /^\/$/,
  /^\/admin(\/.*)?$/,
  /^\/rd-console(\/.*)?$/,
  // Both login aliases — /login is the legacy alias that renders AdminLogin.
  /^\/login\/?$/,
];

/**
 * True when `pathname` belongs to the Admin ERP / RD console rather than a
 * consumer surface. Trailing slashes are tolerated because React Router will
 * match "/admin/ops/" to the same route.
 */
export function isInternalSurface(pathname: string): boolean {
  const normalised =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  return INTERNAL_SURFACE_PATTERNS.some((re) => re.test(normalised));
}
