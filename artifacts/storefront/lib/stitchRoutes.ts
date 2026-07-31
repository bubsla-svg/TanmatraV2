/**
 * ─── Which routes render on the Stitch dark canvas ─────────────────────────
 *
 * THE SINGLE SOURCE OF TRUTH for the total-redesign programme's dark scope
 * (docs/stitch/DESIGN.md; Stitch project 12062470764535558612).
 *
 * It used to be per page: each redesigned route's wrapper `<div>` carried
 * `data-stitch="dark"`. That could not work, because Header, Footer and
 * MobileBottomNav are rendered by app/layout.tsx OUTSIDE the page — they stayed
 * on the light arm of every token and shipped a white header hard against a
 * #0a0a0a page. Radix portals had the same problem from the other direction:
 * they mount on document.body, outside any page wrapper, so a dialog opened
 * from a dark route rendered light.
 *
 * The attribute now lives on <html>, set by a `next/script` `beforeInteractive`
 * script rendered once in app/layout.tsx (see STITCH_ROUTE_SCRIPT below) — NOT
 * by a server component reading the path. An earlier version of this fix read
 * the pathname via `headers()` in the root layout, which is server-rendered
 * and flash-free, but it forces EVERY route in the app to opt out of static
 * rendering: `headers()` is a dynamic API, and calling it anywhere in a layout
 * makes the whole subtree dynamic. Measured effect: prerendered routes went
 * from 50 to 2 (only /robots.txt and /sitemap.xml survived) — the entire
 * marketing/content surface (/about, /faq, /recipes, /legal/*, ...) lost
 * static caching for a theming concern that has nothing to do with them.
 *
 * The client-script approach gets the same zero-flash guarantee a different
 * way: `beforeInteractive` scripts are injected into the initial HTML and run
 * before hydration, before the browser paints anything — the same mechanism
 * next-themes already uses in this codebase (components/theme-provider.tsx)
 * to set `data-theme` without a flash. It costs one tiny inline script and a
 * route list duplicated into that script's source (generated from the arrays
 * below, not hand-copied — see app/layout.tsx) instead of a request header.
 *
 * ADDING A ROUTE? Add it here and nowhere else. There is no per-page wrapper
 * to edit any more, and stitch.css is imported once, by the layout.
 *
 * WHAT THE ATTRIBUTE DOES is one line — `color-scheme: dark` (lib/themes/
 * stitch.css). Every colour token is a light-dark() tuple in
 * tanmatraBridge.css, carried unresolved as it inherits and resolved against
 * the color-scheme of whatever finally consumes it, so that single declaration
 * rethemes the whole subtree with no pinned values.
 */

/**
 * Browser-chrome colour per arm — the two stops of `--color-background-app`
 * in lib/themes/tanmatraTheme.ts (Stone light / Stitch dark canvas). Lives
 * here rather than in app/ because scripts/lint-tokens.ts forbids raw colour
 * literals under {components,app} and the Next metadata API needs a literal.
 * If the canvas token moves, move these with it.
 */
export const THEME_COLOR = {
  light: "#f3f3f5",
  dark: "#0a0a0a",
} as const;

/**
 * Fully-specified dark routes. The trailing rationale is the one each page's
 * own import comment used to carry, kept because it is the reason the route is
 * dark rather than the fact that it is.
 *
 * An ARRAY, not a Set: app/layout.tsx serialises this straight into the guard
 * script via JSON.stringify, and a Set does not survive that round-trip.
 */
export const STITCH_EXACT_ROUTES: readonly string[] = [
  "/", // Consumer home — the redesign's flagship surface.
  "/menu", // Catalogue; reads as the same product as the PDP it links to.
  "/plans", // Plan surfaces (02f §2).
  "/checkout", // The money path. Sets the vocabulary the rest of the funnel matches.
  "/login", // Not a checkout step, but reached via ?next= from every gated
  //          surface — a light reset there is a visual jump.
  "/trial", // "This IS a purchase decision" (BATCH-4-BRIEFS.md Brief 23), so it
  //           gets checkout's canvas and money-CTA discipline.
  "/custom-build", // Brief 25 — checkout's vocabulary; not a funnel step, so no
  //                  StepDots and no sticky footer.
  "/quick-setup", // Brief 24 — same.
  "/vouchers", // Money-adjacent (Brief 57): wallet + redeem shares checkout's
  //              dark canvas and glass sticky footer.
  "/meal-planner", // Planning surface (route-parity Wave H).
  "/subscription/bridge", // A single terminal conversion action — /trial and
  //                         /checkout's canvas, not the lighter Astryx surfaces.
];

/**
 * Dark route families with a dynamic segment. Matched as prefixes, and only
 * when something follows the slash — "/plan/" must not swallow "/plans", and
 * a bare "/dish" is not a route.
 */
export const STITCH_PREFIX_ROUTES: readonly string[] = [
  "/dish/", // /dish/[slug] — the PDP.
  "/plan/", // /plan/[planId] — the plan builder.
  "/track/", // /track/[orderId] — post-purchase.
  "/order/confirmed/", // /order/confirmed/[orderId] — the checkout tail.
];

/** Strip query/hash and a trailing slash so "/menu/", "/menu?x=1" and "/menu"
 *  all answer the same. Mirrors the normalisation the inline guard script
 *  performs on `location.pathname` (app/layout.tsx) — keep the two in sync if
 *  either changes. */
function normalise(pathname: string): string {
  const path = pathname.split(/[?#]/)[0] ?? "";
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path;
}

/**
 * True when `pathname` renders on the Stitch dark canvas. Not used by
 * app/layout.tsx (which runs client-side via the guard script, and has no
 * server-side view of the path — see the file header) — this is the
 * server/test-time equivalent, kept as the checkable source of truth for
 * lib/stitchRoutes.test.ts and any future server-side consumer (RSS/sitemap
 * generation, etc.) that does know its own route statically.
 */
export function isStitchRoute(pathname: string): boolean {
  const path = normalise(pathname);
  if (STITCH_EXACT_ROUTES.includes(path)) return true;
  return STITCH_PREFIX_ROUTES.some((p) => path.startsWith(p) && path.length > p.length);
}
