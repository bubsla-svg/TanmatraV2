/**
 * SINGLE SOURCE OF TRUTH for the legal-entity + contact details shown across
 * every /legal page and the site footer.
 *
 * ▸ CONFIRMED values (legal name, FSSAI registration, brand, address) are set below.
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
  // FSSAI REGISTRATION, not a licence. The certificate on file (FBO: Anuradha,
  // issued 06-09-2025, valid up to 05-09-2026, premises: Hajipur, Sector 104,
  // Noida) is a Registration Certificate under the FSS Act, 2006 — the petty-FBO
  // tier. User-facing copy must therefore say "Registration"/"Reg. No.", never
  // "Licence": the two are distinct instruments under the Licensing and
  // Registration Regulations, and claiming the one we don't hold is a false
  // declaration under §61. The field NAME stays `fssaiLicenseNo` because it
  // mirrors the `legal_company_profile` wire/DB column — renaming it is API
  // churn, not honesty.
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

  // Owner-supplied business address (2026-08-29). The FSSAI registration's
  // premises line reads "Shop Number 5, Gali No. 3, Vill. Hajipur, Sector-104
  // Noida" — same locality; the owner's stated display address is used here.
  registeredOffice: "237, Hazipur, Sector 104, Noida, Uttar Pradesh 201301",
  // Derived from the address above, per the placeholder's own note
  // ("usually the registered-office city").
  jurisdictionCity: "Noida",
  jurisdictionState: "Uttar Pradesh, India",

  // ── Still to confirm before publishing (loud placeholders) ────────────────
  cin: "[Company CIN — to be inserted]",
  grievanceOfficer: "[Grievance Officer name — to be inserted]",

  // Human "Last updated" stamp shown on every legal page.
  updated: "29 August 2026",
} as const;

export type Company = typeof COMPANY;

/**
 * WhatsApp is the support channel (owner decision, 2026-09-06).
 *
 * Derived from `COMPANY.supportPhone` rather than typed again, so the number a
 * customer messages cannot drift from the one the legal pages print. wa.me
 * takes digits only — no `+`, spaces or dashes.
 */
export const SUPPORT_WHATSAPP_URL = `https://wa.me/${COMPANY.supportPhone.replace(/\D/g, "")}`;
