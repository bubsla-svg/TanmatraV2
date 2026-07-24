/**
 * SINGLE SOURCE OF TRUTH for the legal-entity + contact details shown across
 * every /legal page and the site footer.
 *
 * ▸ CONFIRMED values (legal name, FSSAI licence, brand) are set below.
 * ▸ Everything wrapped in [ … ] is a PLACEHOLDER — fill it in before these
 *   pages go live. They are deliberately loud so they're obvious on the
 *   rendered page and in review. This is the ONLY file you must edit to
 *   supply the missing specifics; all pages read from here.
 *
 * NOTE: this copy is a starting draft and must be reviewed by qualified legal
 * counsel before publishing. It is not legal advice.
 */
export const COMPANY = {
  // ── Confirmed by the business owner ───────────────────────────────────────
  legalName: "Trending Media Service Private Limited",
  brand: "Tanmatra",
  fssaiLicenseNo: "22725926001018",
  // Owner-confirmed contact. All company contact (grievance, data/privacy, and
  // support) currently routes to this single verified inbox + phone; split into
  // dedicated privacy@ / support@ addresses here once those mailboxes exist.
  grievanceEmail: "grievance@tanmatra.food",
  privacyEmail: "grievance@tanmatra.food",
  supportEmail: "grievance@tanmatra.food",
  supportPhone: "+91 92892 13115",
  // Grounded in the current delivery footprint (Noida / Delhi NCR).
  serviceAreas: "Noida and surrounding serviceable pincodes (Delhi NCR)",

  // ── Still to confirm before publishing (loud placeholders) ────────────────
  cin: "[Company CIN — to be inserted]",
  registeredOffice: "[Registered office address — to be inserted]",
  grievanceOfficer: "[Grievance Officer name — to be inserted]",
  jurisdictionCity: "[City — usually the registered-office city]",
  jurisdictionState: "[State], India",

  // Human "Last updated" stamp shown on every legal page.
  updated: "24 July 2026",
} as const;

export type Company = typeof COMPANY;
