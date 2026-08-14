/**
 * ONE identity per dietitian — the fields both RD surfaces put on screen.
 *
 * THE BUG THIS CLOSES
 * -------------------
 * Each RD existed twice, under the same slug, with different facts:
 *
 *   teamProfiles.ts (seeds `/team`)   rdAdvisory.ts (serves `/rd/directory`)
 *   ------------------------------    -------------------------------------
 *   Dr. Anjali Nair                   Anjali Nair
 *   Lead RD — Cardiometabolic         Lead Registered Dietitian
 *   PhD Clinical Nutrition, AIIMS     MSc Clinical Nutrition
 *   17 years                          12 years
 *
 * Same for Vikram (CSCS vs CISSN, a named university on one side only) and
 * Kavya (12 vs 8 years). Both records reach customers — `/team` and `/about`
 * render one, `/rd` and the booking flow render the other, and orders.ts joins
 * team_profiles to show an RD's name and title against an order. So a customer
 * could read a PhD on one page and an MSc on the next, for the person they are
 * about to book.
 *
 * WHICH RECORD WON, AND WHY
 * -------------------------
 * The `/rd/directory` values, on a stated rule: it is the record a customer
 * books and pays against, so it is the one the business is already standing
 * behind. It also happens to be the more conservative claim in every single
 * conflict — no doctoral honorific, no named degree-granting institution,
 * fewer years — which is the right way to fail on a professional credential.
 * Under-claiming a qualification is modest; over-claiming one is the sort of
 * thing a customer can check in one search.
 *
 * If any of the stronger claims are true, this is the one file to correct, and
 * both endpoints follow. That is the point.
 *
 * NOT INCLUDED: `bio`. The two surfaces genuinely say different things — the
 * team page describes what someone does for Tanmatra, the directory describes
 * their practice — and neither contradicts the other. Only the facts that were
 * in conflict live here.
 *
 * No database import on purpose: `/rd/directory` serves this without touching
 * Postgres today, and making the roster DB-dependent would take the endpoint
 * down with the database.
 */
export interface RdIdentity {
  slug: string;
  name: string;
  title: string;
  credentials: string[];
  yearsExperience: number;
}

export const RD_IDENTITIES: readonly RdIdentity[] = [
  {
    slug: "rd-anjali-nair",
    name: "Anjali Nair",
    title: "Lead Registered Dietitian",
    credentials: ["RD (India)", "MSc Clinical Nutrition", "CDE"],
    yearsExperience: 12,
  },
  {
    slug: "rd-vikram-sethi",
    name: "Vikram Sethi",
    title: "Performance Dietitian",
    credentials: ["RD", "ISAK Level 2", "CISSN"],
    yearsExperience: 9,
  },
  {
    slug: "rd-kavya-menon",
    name: "Kavya Menon",
    title: "Family & Gut-Health Dietitian",
    credentials: ["RD", "MSc Nutrition & Dietetics", "Monash FODMAP-trained"],
    yearsExperience: 8,
  },
];

/**
 * Throws on an unknown slug rather than returning undefined.
 *
 * Every caller is a module-level literal naming a slug it expects to exist, so
 * a miss is a typo, and a typo should stop the server at import time instead of
 * shipping a profile card with a blank name on it.
 */
export function rdIdentity(slug: string): RdIdentity {
  const found = RD_IDENTITIES.find((r) => r.slug === slug);
  if (!found) throw new Error(`rdIdentity: unknown RD slug "${slug}"`);
  return found;
}
