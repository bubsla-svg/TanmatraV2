/**
 * Single source of truth for build-time prerendered paths.
 *
 * react-router.config.ts consumes this so the prerender list can never
 * drift from the bundled catalogs, and scripts/generate-sitemap.mjs walks
 * the resulting build output — sitemap, prerender list, and data stay in
 * lockstep by construction.
 *
 * Two tiers:
 *  - PUBLIC_PRERENDER_PATHS: indexable pages that render real content from
 *    bundled data at build time (each page owns rich meta + JSON-LD).
 *  - NOINDEX_SHELL_PATHS: personalized/transactional pages prerendered so
 *    crawlers and link previews get a real <title> + description + robots
 *    noindex instead of the bare SPA fallback. Their meta exports carry
 *    `robots: noindex`.
 */
import { DISHES } from "@workspace/menu-catalog";
import { TEAM } from "./teamData";
import { RD_BOOKING } from "./rdBookingData";
import { RD_PLANS } from "./rdPlans";

const MARKETING_PATHS = [
  "/",
  "/menu",
  "/wellness",
  "/performance",
  "/clinical",
  "/about",
  "/faq",
  "/premium",
  "/corporate",
  "/subscription-plans",
  // Playbook Part 3 acquisition landing pages.
  "/metabolic",
  "/care/pcos",
  "/care/diabetes",
  "/corporate-wellness",
  "/rd-partners",
  "/partners/gyms",
  "/partners/fitness-clubs",
];

const LEGAL_PATHS = ["/terms", "/privacy", "/refunds"];

// Discovery indexes whose detail content is API-backed render at least a
// real header/meta shell — still far better than the empty fallback.
const DISCOVERY_PATHS = ["/team", "/rd", "/plans", "/recipes", "/challenges", "/marketplace"];

const DETAIL_PATHS = [
  ...DISHES.map((d) => `/dish/${d.slug}`),
  ...TEAM.map((m) => `/team/${m.slug}`),
  ...RD_BOOKING.map((r) => `/rd/${r.slug}`),
  ...RD_PLANS.map((p) => `/plans/${p.slug}`),
];

export const PUBLIC_PRERENDER_PATHS: string[] = [
  ...MARKETING_PATHS,
  ...LEGAL_PATHS,
  ...DISCOVERY_PATHS,
  ...DETAIL_PATHS,
];

export const NOINDEX_SHELL_PATHS: string[] = [
  "/cart",
  "/track",
  "/login",
  // /profile is a client-side redirect to /account; prerender a noindex shell
  // so crawlers get robots:noindex instead of the indexable SPA fallback HTML.
  "/profile",
  "/account",
  "/account/addresses",
  "/orders",
  "/subscriptions",
  "/preferences",
  "/meal-planner",
  "/rewards",
  "/vouchers",
  "/appointments",
  "/checkout-appointment",
  "/subscribe",
  "/checkout",
  "/trial/default",
  "/order/confirmed/default",
  "/account/plan",
  "/account/billing",
];

export const ALL_PRERENDER_PATHS: string[] = [
  ...PUBLIC_PRERENDER_PATHS,
  ...NOINDEX_SHELL_PATHS,
];
