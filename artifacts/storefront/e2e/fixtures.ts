import type { Page } from "@playwright/test";

/**
 * Shared spec fixtures (TNM-SF-01 §6), carrying the tanmatra harness's
 * hard-won lessons from birth:
 *
 * 1. NO addInitScript storage seeding. Playwright injects init scripts into
 *    every document — including sandboxed third-party iframes where
 *    localStorage access throws SecurityError, which then fails the
 *    `errors == []` assertions (the frame-guard incident). The storefront
 *    specs drive the real UI to build state instead of seeding storage.
 *
 * 2. Error collection distinguishes genuinely benign noise from real app
 *    errors, and the benign list is EXPLICIT — never a broad class like
 *    SecurityError, which would mask real storage bugs in app code.
 */

const BENIGN_ERRORS: RegExp[] = [
  // Next.js dev-only hydration notes never appear in prod builds; keep the
  // list empty-by-default and grow it only with documented entries.
];

export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (err) => {
    const text = String(err);
    if (!BENIGN_ERRORS.some((re) => re.test(text))) errors.push(text);
  });
  return errors;
}

/** An à-la-carte-orderable dish (curated hero set) with a stable name, used
 *  by the cart specs. Source of truth: menu-catalog AL_A_CARTE_HERO_SLUGS. */
export const ORDERABLE_DISH = {
  slug: "quinoa-khichdi",
  name: "Quinoa Khichdi",
};
