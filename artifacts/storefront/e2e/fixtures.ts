import { expect, type Page } from "@playwright/test";

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

/**
 * OA-MED-1.19 caps /menu's initial DOM-visible dish count and reveals more
 * via a "Show N more dishes" button (MenuGrid.tsx). Specs that need a
 * specific dish visible/clickable — or need every card interactable — must
 * click through it first; card elements are still in the DOM under a
 * `hidden` row wrapper, so a plain CSS locator would find them while
 * `getByRole` (which respects the accessibility tree) would not.
 *
 * Two races have to be handled, and a bare `while (isVisible()) click()`
 * loses to both. `isVisible()` resolves immediately rather than auto-waiting,
 * so probing a not-yet-painted page concludes there is nothing to reveal;
 * and the button ships in the SSR HTML before React hydrates, so an early
 * click lands on an element with no handler attached and silently does
 * nothing. Hence: wait for the grid first, then assert each click actually
 * grew the visible set before moving on.
 */
export async function revealAllDishes(page: Page): Promise<void> {
  const visibleCards = page.locator('a[href^="/menu?dish="]:visible');
  const showMore = page.getByRole("button", { name: /show \d+ more dishes/i });
  await visibleCards.first().waitFor({ state: "visible" });
  // Bounded rather than `while (true)`: the reveal step is 20 and the
  // catalog tops out around 124, so 10 iterations is slack, and a bug that
  // stops the button disappearing fails the spec instead of hanging it.
  for (let i = 0; i < 10; i++) {
    if (!(await showMore.isVisible().catch(() => false))) return;
    const before = await visibleCards.count();
    await showMore.click();
    await expect(async () => {
      expect(await visibleCards.count()).toBeGreaterThan(before);
    }).toPass({ timeout: 10_000 });
  }
}
