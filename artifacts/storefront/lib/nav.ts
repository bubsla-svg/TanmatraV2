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
  /**
   * Optional sub-section label. Links sharing a `section` render under a small
   * sub-heading in EXPANDED surfaces (the footer today), giving a large group
   * light two-tier hierarchy without changing the flat `links` contract that
   * BottomNav (group tops only) and ⌘K (flattened search) consume unchanged.
   * A group's sectioned links MUST be contiguous — see lib/nav.test.ts.
   */
  section?: string;
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
      { label: "Marketplace", href: "/marketplace", desc: "Pantry: good oils, sauces and snacks" },
    ],
  },
  {
    // Two-tier IA: the core plan actions (choose a plan / start a trial) sit up
    // top; the goal-specific landers — all entry points into the same catalog
    // (they each map to a real PlanId) — are grouped under one sub-section so a
    // large group reads as a short list, not a flat pile. The two by-condition
    // landers (/care/pcos, /care/diabetes) left this list with the by-condition
    // surface (consumer copy deck); they return with CARE_BY_CONDITION_ENABLED.
    key: "plan",
    label: "Plan",
    href: "/plans",
    links: [
      { label: "Plans", href: "/plans", desc: "Monthly lunch plans" },
      // T-18: customer vocabulary, not internal names. The trial costs ₹399
      // (TRIAL_CREDIT_PAISE in lib/subscription-rules) — it was listed here
      // as "Free trial". "hub", "wizard" and "smart" are how the team names
      // things, not how a customer looks for them.
      { label: "3-lunch trial · ₹399", href: "/trial", desc: "Three lunches, one payment" },
      { label: "Build your own plan", href: "/custom-build", desc: "Customize macros & boosts" },
      { label: "Quick start", href: "/quick-setup", desc: "Set up in three steps" },
      { label: "Recommended for you", href: "/meal-recommendations", desc: "Dishes matched to your goal" },
      { label: "Combos", href: "/meal-deals", desc: "Meal combos, priced together" },
      { label: "Metabolic programs", href: "/metabolic", desc: "Fat-loss & lean-muscle programs", section: "By goal" },
      { label: "Performance protocol", href: "/performance", desc: "High-protein, recovery-tuned", section: "By goal" },
      { label: "Clinical protocol", href: "/clinical", desc: "Low-GI, sugar-capped, measured", section: "By goal" },
    ],
  },
  {
    // "Our dietitians" (/rd) left this list with the RD services flag: the
    // route 404s while it is off, and a nav entry into a 404 is worse than no
    // entry. It comes back with RD_SERVICES_ENABLED, as does the partner
    // network below.
    key: "track",
    label: "Track",
    href: "/account/orders",
    links: [
      { label: "My orders", href: "/account/orders" },
      { label: "Protocol vault", href: "/account/favorites", desc: "Saved favorites & presets" },
      { label: "Meal history dashboard", href: "/account/history", desc: "Consumed macro adherence" },
      { label: "Symptom logs", href: "/account/symptoms", desc: "Correlate reactions & food" },
      { label: "Challenge streak tracker", href: "/challenges/tracker", desc: "Regimen telemetry" },
      { label: "Nutrition tracker", href: "/account/wellness", desc: "Log food & water, track streaks" },
      { label: "Meal planner", href: "/meal-planner", desc: "Plan & swap your week" },
      { label: "Nutrition coach", href: "/coach", desc: "Chat with an AI nutrition coach" },
    ],
  },
  {
    key: "community",
    label: "Community",
    href: "/recipes",
    links: [
      { label: "Recipes", href: "/recipes", desc: "Macro-labelled" },
      { label: "Community Q&A forum", href: "/qa", desc: "Nutrition questions, answered" },
      { label: "Our team", href: "/team", desc: "The people who cook your food" },
      { label: "Challenges", href: "/challenges", desc: "Cohort programmes with check-ins" },
      { label: "Corporate wellness", href: "/corporate-wellness", desc: "Team lunches for offices" },
    ],
  },
  {
    key: "account",
    label: "Account",
    href: "/account",
    links: [
      { label: "Account hub", href: "/account" },
      { label: "Tanmatra Premium", href: "/premium", desc: "Priority delivery + premium-only dishes" },
      { label: "Subscriptions", href: "/account/subscriptions" },
      { label: "Orders", href: "/account/orders" },
      { label: "Consults", href: "/account/appointments", desc: "View your booked sessions" },
      { label: "Billing & credits", href: "/account/billing", desc: "Wallet balance & credit activity" },
      { label: "Wallet & vouchers", href: "/vouchers", desc: "Redeem a voucher · wallet balance" },
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

/**
 * Header's compact primary row — the groups worth a top-level slot today.
 * Labels are deliberately shorter than the page titles they link to (this
 * array has no other consumer, so it's free to diverge): "Corporate" reuses
 * COMPANY_LINKS' existing shorthand for the same /corporate-wellness href
 * below, and "Metabolic" drops "Care" to match. The unabridged names wrapped
 * to two lines inside TopNav's centerContent grid track, and a wrapped label
 * is the leading indicator that the row is running out of room — past that
 * point the header's clusters stop merely looking cramped and start
 * overlapping, which silently covers interactive controls rather than just
 * reflowing them. desktop-header-nav-fit.spec.ts pins both properties.
 */
export const PRIMARY_NAV: NavLink[] = [
  { label: "Menu", href: "/menu" },
  { label: "Plans", href: "/plans" },
  { label: "Metabolic", href: "/metabolic" },
  { label: "Corporate", href: "/corporate-wellness" },
  { label: "Account", href: "/account" },
];

/** "Company" / help links (footer). */
export const COMPANY_LINKS: NavLink[] = [
  { label: "About", href: "/about" },
  // Plan item 2.1: the page that answers "does this keep charging me?" has to
  // be reachable without already being in a checkout.
  { label: "How it works", href: "/how-it-works" },
  { label: "Corporate", href: "/corporate-wellness" },
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
  { label: "Nutrition disclaimer", href: "/legal/disclaimer" },
  { label: "Complaints", href: "/legal/grievance" },
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
  tagline: "Fresh lunch, cooked after you order.",
  // FSSAI *Registration* number (petty-FBO tier, not a licence) — render it
  // as "FSSAI Reg. No.", per the certificate. See content/legal/company.ts.
  fssai: "22725926001018",
  // Owner-supplied business address (2026-08-29); the footer's fallback when
  // the legal_company_profile singleton is unseeded/unreachable. Keep in
  // lockstep with COMPANY.registeredOffice (content/legal/company.ts).
  address: "237, Hazipur, Sector 104, Noida, Uttar Pradesh 201301",
} as const;
