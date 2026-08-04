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

/**
 * ─── Stitch Project & Screen Registry ──────────────────────────────────────
 *
 * Official programmatic mapping of Tanmatra routes to generated Google Stitch
 * UI screens in project 12062470764535558612 ("Tanmatra — Premium Clinical Metabolic OS").
 *
 * Generated per Tanmatra Google Stitch SDK Prompt Pack (/goal /gpt-taste).
 */
export interface StitchScreenSpec {
  readonly projectId: string;
  readonly screenId: string;
  readonly title: string;
  readonly route: string;
  readonly category: "design_system" | "route" | "component";
}

export const STITCH_PROJECT_ID = "12062470764535558612" as const;

export const STITCH_SCREEN_REGISTRY: readonly StitchScreenSpec[] = [
  {
    projectId: STITCH_PROJECT_ID,
    screenId: "839f4a92436a4444bda6fabfa07d7a06",
    title: "Tanmatra Design Reference",
    route: "/styleguide?theme=dark",
    category: "design_system",
  },
  {
    projectId: STITCH_PROJECT_ID,
    screenId: "f814ddb11cbb4b17832dba069604e371",
    title: "Tanmatra Design Reference (Light Theme)",
    route: "/styleguide?theme=light",
    category: "design_system",
  },
  {
    projectId: STITCH_PROJECT_ID,
    screenId: "966d396f55ed43ada3e69ff56950d3ef",
    title: "Tanmatra Home: Clinical Feed",
    route: "/",
    category: "route",
  },
  {
    projectId: STITCH_PROJECT_ID,
    screenId: "72d14e82a0064eb398552c2bee5d4682",
    title: "Daily Menu: Clinical Selection",
    route: "/menu",
    category: "route",
  },
  {
    projectId: STITCH_PROJECT_ID,
    screenId: "ef20a9487d414d8aaa48ab69e4b1f22d",
    title: "Dish Detail: Charcoal Smoothie",
    route: "/dish/[slug]",
    category: "route",
  },
  {
    projectId: STITCH_PROJECT_ID,
    screenId: "44267f5a1c8c43f0873fb5ed30fef65d",
    title: "Cart Drawer: Clinical Summary",
    route: "/checkout#cart-drawer",
    category: "component",
  },
  {
    projectId: STITCH_PROJECT_ID,
    screenId: "866fc4167d9c47709ff6c3465ab63b84",
    title: "Tanmatra Marketplace: Clinical Pantry",
    route: "/marketplace",
    category: "route",
  },
  {
    projectId: STITCH_PROJECT_ID,
    screenId: "8d3c8980a3cc4937b00e062e5d5e554c",
    title: "Subscription Plans: Therapeutic Protocols",
    route: "/plans",
    category: "route",
  },
  {
    projectId: STITCH_PROJECT_ID,
    screenId: "e4be16728fa3442d88c96a63529b1b92",
    title: "Plan Configuration: 5-Day Metabolic Reset",
    route: "/plan/[planId]",
    category: "route",
  },
  {
    projectId: STITCH_PROJECT_ID,
    screenId: "21ee21b9d8e94c98927f921775b8c5f3",
    title: "Build Your Own Plan: Goal Selection",
    route: "/custom-build",
    category: "route",
  },
  {
    projectId: STITCH_PROJECT_ID,
    screenId: "b4f7b93cf4854f5eac4e1afb72efff6f",
    title: "Secure Checkout: Tanmatra OS",
    route: "/checkout",
    category: "route",
  },
  {
    projectId: STITCH_PROJECT_ID,
    screenId: "59aa3123733a4aac84001db8d6032283",
    title: "3-Day Clinical Trial Protocol",
    route: "/trial",
    category: "route",
  },
  {
    projectId: STITCH_PROJECT_ID,
    screenId: "75cf7ca6e32c4596b20c9ef59e0d9f16",
    title: "Meal Planner: Clinical Protocol Active",
    route: "/meal-planner",
    category: "route",
  },
  {
    projectId: STITCH_PROJECT_ID,
    screenId: "f49ace3e5e27464aacca6184b0432059",
    title: "Account Hub: Clinical Profile",
    route: "/account",
    category: "route",
  },
  {
    projectId: STITCH_PROJECT_ID,
    screenId: "2b29b0174cfb46b1826594928710885e",
    title: "Biometric & CGM Telemetry: Live Sync",
    route: "/account/wearables",
    category: "route",
  },
  {
    projectId: STITCH_PROJECT_ID,
    screenId: "43952f75a4c649be9f2e947d011b6bc0",
    title: "Clinical Care: Metabolic Protocols",
    route: "/care",
    category: "route",
  },
] as const;

/**
 * Looks up the official generated Stitch screen specification for a given route.
 * Handles dynamic segments (e.g. "/dish/wild-salmon-bowl" -> "/dish/[slug]").
 */
export function getStitchScreenForRoute(pathname: string): StitchScreenSpec | undefined {
  const path = pathname.split(/[?#]/)[0] ?? "";
  const exact = STITCH_SCREEN_REGISTRY.find((s) => s.route === path);
  if (exact) return exact;

  if (path.startsWith("/dish/") || path.startsWith("/menu/")) {
    return STITCH_SCREEN_REGISTRY.find((s) => s.route === "/dish/[slug]");
  }
  if (path.startsWith("/plan/")) {
    return STITCH_SCREEN_REGISTRY.find((s) => s.route === "/plan/[planId]");
  }
  if (path.startsWith("/care/") || path.startsWith("/clinical")) {
    return STITCH_SCREEN_REGISTRY.find((s) => s.route === "/care");
  }
  return undefined;
}

