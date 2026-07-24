/**
 * Central information-architecture config for the storefront — the SINGLE place
 * a route registers in global navigation.
 *
 * Track 0 of the storefront route-parity port (docs/STOREFRONT-ROUTE-PARITY.md)
 * front-loads this so every later wave adds a route by appending ONE entry here
 * instead of editing Header / Footer / BottomNav JSX and colliding with the
 * other waves on those shared files.
 *
 * Only routes that EXIST on the storefront today are listed; each wave appends
 * its own as it lands (e.g. Wave A adds /about + /faq to COMPANY_LINKS; Wave C
 * fills out the Community group).
 */
export interface NavLink {
  label: string;
  href: string;
  /** Optional one-line description for expanded surfaces (footer, ⌘K, sheet). */
  desc?: string;
}

export type NavGroupKey = "eat" | "plan" | "track" | "community" | "account";

export interface NavGroup {
  key: NavGroupKey;
  label: string;
  /** The group's landing route (drives the header's compact primary row). */
  href: string;
  links: NavLink[];
}

/** The 5-group IA ported from the legacy app (Eat · Plan · Track · Community · Account). */
export const NAV_GROUPS: NavGroup[] = [
  {
    key: "eat",
    label: "Eat",
    href: "/menu",
    links: [
      { label: "Home", href: "/" },
      { label: "Menu", href: "/menu", desc: "Browse today's dishes" },
    ],
  },
  {
    key: "plan",
    label: "Plan",
    href: "/plans",
    links: [
      { label: "Plans", href: "/plans", desc: "Therapeutic subscription plans" },
      { label: "Metabolic programs", href: "/metabolic", desc: "Fat-loss & lean-muscle programs" },
      { label: "PCOS care", href: "/care/pcos", desc: "Hormone-aware, low-GI menu" },
      { label: "Diabetes care", href: "/care/diabetes", desc: "Sugar-conscious, low-GI menu" },
      { label: "Performance protocol", href: "/performance", desc: "High-protein, recovery-tuned" },
      { label: "Clinical protocol", href: "/clinical", desc: "RD-supervised, low-GI therapeutic" },
      { label: "Free trial", href: "/trial", desc: "Try it for 3 days" },
    ],
  },
  {
    key: "track",
    label: "Track",
    href: "/account/orders",
    links: [
      { label: "My orders", href: "/account/orders" },
      { label: "Nutrition coach", href: "/coach", desc: "Chat with an AI nutrition coach" },
      { label: "Our dietitians", href: "/rd", desc: "Meet the registered dietitians" },
    ],
  },
  {
    key: "community",
    label: "Community",
    href: "/recipes",
    links: [
      { label: "Recipes", href: "/recipes", desc: "RD-designed, macro-labelled" },
      { label: "Corporate wellness", href: "/corporate-wellness", desc: "RD-designed team lunches for offices" },
      { label: "Corporate & partnerships", href: "/corporate", desc: "Team lunches for your office" },
    ],
  },
  {
    key: "account",
    label: "Account",
    href: "/account",
    links: [
      { label: "Account hub", href: "/account" },
      { label: "Subscriptions", href: "/account/subscriptions" },
      { label: "Orders", href: "/account/orders" },
      { label: "Addresses", href: "/account/addresses" },
      { label: "Preferences", href: "/account/preferences" },
      { label: "Rewards", href: "/account/loyalty" },
    ],
  },
];

/** Look a group up by key (helper for chrome components). */
export function navGroup(key: NavGroupKey): NavGroup {
  const g = NAV_GROUPS.find((x) => x.key === key);
  if (!g) throw new Error(`unknown nav group: ${key}`);
  return g;
}

/** Header's compact primary row — the groups worth a top-level slot today. */
export const PRIMARY_NAV: NavLink[] = [
  { label: "Menu", href: "/menu" },
  { label: "Plans", href: "/plans" },
  { label: "Account", href: "/account" },
];

/** "Company" / help links (footer). */
export const COMPANY_LINKS: NavLink[] = [
  { label: "About", href: "/about" },
  { label: "Corporate", href: "/corporate" },
  { label: "FAQ", href: "/faq" },
];

/**
 * Legal / policy links. Canonical under /legal/* (the legal-pages PR). Legacy
 * top-level paths (/terms, /privacy, /refunds) 308-redirect here — see the
 * redirects() map in next.config.ts.
 */
export const LEGAL_LINKS: NavLink[] = [
  { label: "Terms of Service", href: "/legal/terms" },
  { label: "Privacy Policy", href: "/legal/privacy" },
  { label: "Refund & Cancellation", href: "/legal/refunds" },
  { label: "Shipping & Delivery", href: "/legal/shipping" },
  { label: "Health & Nutrition Disclaimer", href: "/legal/disclaimer" },
  { label: "Grievance Redressal", href: "/legal/grievance" },
];

/**
 * Partnership / segment landers (route-parity Wave B). B2B conversion pages,
 * not primary IA — they're surfaced by internal links from /corporate and the
 * sitemap, deliberately kept out of the header/BottomNav. Each POSTs to the
 * shared /corporate-leads endpoint under its own `kind`.
 */
export const PARTNER_LINKS: NavLink[] = [
  { label: "For gyms", href: "/partners/gyms", desc: "Bundle nutrition into memberships" },
  { label: "For running & cycling clubs", href: "/partners/fitness-clubs", desc: "Post-workout breakfast drop-offs" },
];

/** Site-level facts surfaced in the footer. */
export const SITE = {
  brand: "Tanmatra",
  tagline: "Clinical nutrition, cooked fresh.",
  fssai: "22725926001018",
} as const;
