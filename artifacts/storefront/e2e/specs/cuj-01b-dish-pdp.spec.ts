import { test, expect } from "@playwright/test";
import { collectErrors, ORDERABLE_DISH } from "../fixtures";

/**
 * The STANDALONE dish PDP (`/dish/[slug]`) — the surface that had no e2e
 * coverage at all, and where a guest-purchase dead end shipped undetected.
 *
 * CUJ-01 already covers the *other* PDP: the `/menu?dish=<slug>` bottom
 * sheet. That one lives in `app/(global)/`, so it inherits Header +
 * MiniCartBar and its route into checkout comes for free. `/dish/[slug]` is a
 * different page in a different shell — `app/(focus)/`, which renders no
 * Header, no MobileBottomNav and no MiniCartBar on the rule that each focus
 * flow owns its own bottom edge.
 *
 * `support/routes.ts` excludes parameterised routes from the generic sweep,
 * which is why this needs its own spec rather than a list entry.
 *
 * Runs against the live-or-fallback catalog like the rest of the suite;
 * ORDERABLE_DISH is an à-la-carte hero, so it is present in both tiers.
 *
 * PdpBuyLedger (the sweep's "Cart Drawer wired on the PDP" fix) makes Add
 * open the Cart Drawer immediately — the architecture doc's canonical route
 * PDP → Cart Drawer → /checkout, not a link past the drawer to a dead end.
 * The drawer's own Checkout CTA is dual-target the same way CUJ-01's is: the
 * PR-gate build is flag-dark (NEXT_PUBLIC_LIVE_CHECKOUT unset) and renders the
 * LOUD "checkout goes live" status; the deployed service is flag-live and
 * renders the real link. E2E_LIVE_CHECKOUT=1 selects which side runs.
 */

const PDP = `/dish/${ORDERABLE_DISH.slug}`;
const liveCheckout = process.env["E2E_LIVE_CHECKOUT"] === "1" ? test : test.skip;

test("standalone PDP exposes a guest add-to-cart action", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(PDP);

  await expect(
    page.getByRole("heading", { name: ORDERABLE_DISH.name }),
  ).toBeVisible();

  // No session is established anywhere in this spec — guest checkout is
  // supported, so the purchase action must not be gated behind sign-in.
  const add = page.getByRole("button", { name: /^add to cart$/i });
  await expect(add).toBeVisible();
  await expect(add).toBeEnabled();
  expect(errors).toEqual([]);
});

test("adding from the standalone PDP opens the cart drawer and reveals a way onward", async ({ page }) => {
  await page.goto(PDP);

  // Pre-add: the drawer's own title is not on screen (nothing to view yet).
  await expect(page.getByText(/^your cart$/i)).toBeHidden();

  await page.getByRole("button", { name: /^add to cart$/i }).click();

  // The regression this spec exists for: once the cart is non-empty the page
  // must offer a way ONWARD. PdpBuyLedger's fix is to open the Cart Drawer
  // the same tap that adds — not merely reveal a link past it.
  await expect(page.getByText(/^your cart$/i)).toBeVisible();
  await expect(page.getByText(ORDERABLE_DISH.name).first()).toBeVisible();

  // §4.1: the PDP's own sticky bar also flips to the stepper + "View cart"
  // face in place of "Add to cart" — this is the qty>0 face of the same
  // control, and it survives after the drawer is dismissed.
  await page.keyboard.press("Escape");
  await expect(page.getByText(/^your cart$/i)).toBeHidden();
  await expect(
    page.getByRole("group", { name: new RegExp(`${ORDERABLE_DISH.name} quantity`, "i") }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /view cart/i })).toBeVisible();

  // Flag-dark contract (mirrors CUJ-01's drawer leg): reopening the drawer via
  // "View cart" must show the loud not-yet-live status in the PR-gate build,
  // never a link into a void.
  await page.getByRole("button", { name: /view cart/i }).click();
  if (process.env["E2E_LIVE_CHECKOUT"] === "1") {
    const checkout = page.getByRole("link", { name: /^checkout$/i });
    await expect(checkout).toBeVisible();
    await expect(checkout).toBeEnabled();
  } else {
    await expect(
      page.getByRole("status").filter({ hasText: /checkout goes live/i }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /^checkout$/i })).toHaveCount(0);
  }
});

// The checkout leg only exists where the live flag is built in — the deployed
// service, run with E2E_LIVE_CHECKOUT=1. Skipped (not vacuously passed) in the
// flag-dark PR-gate build, same as CUJ-01's live leg.
liveCheckout("guest can reach checkout from the standalone PDP", async ({ page }) => {
  await page.goto(PDP);
  await page.getByRole("button", { name: /^add to cart$/i }).click();

  await page.getByRole("link", { name: /^checkout$/i }).click();

  await expect(page).toHaveURL(/\/checkout/);
});

test("the standalone PDP offers a way back out", async ({ page }) => {
  // FocusLayout's contract is that each focus flow supplies its own back
  // affordance, since the shell renders no Header. This page had none —
  // arriving from a protocol rail, a saved favourite or a search result left
  // browser Back as the only exit.
  await page.goto(PDP);

  await page.getByRole("link", { name: /back to menu/i }).click();

  await expect(page).toHaveURL(/\/menu$/);
});

test("the standalone PDP never renders the unsafe raw allergen fallback", async ({ page }) => {
  // Regression guard for the P0 allergen-safety fix: this route used to print
  // a raw `dish.allergens.length ? ... : "None declared."`, which claimed
  // absence of allergens even when the dish's disclosure was unreviewed. It
  // now renders the same <DishAllergens>/lib/allergenCopy.ts mapping the
  // drawer uses, whose five possible headings never include that literal
  // string — see lib/allergenCopy.test.ts for the full state matrix pinned
  // there. This asserts the safety component is mounted and the unsafe
  // fallback text is gone, without depending on this dish's specific
  // allergen data (which lives in the catalog and can change).
  await page.goto(PDP);

  await expect(page.getByRole("heading", { name: "Allergens", level: 2 })).toBeVisible();
  await expect(page.getByText("None declared.", { exact: true })).toHaveCount(0);
});

test("the focus shell renders no global chrome on the PDP", async ({ page }) => {
  // The flip side of the bug: this page must NOT grow a tab bar to solve the
  // dead end — that would break the layout contract. The fix belongs in the
  // page's own sticky bar + drawer, not the global shell.
  await page.goto(PDP);
  await page.getByRole("button", { name: /^add to cart$/i }).click();
  await page.keyboard.press("Escape");

  await expect(page.getByRole("navigation", { name: /primary/i })).toBeHidden();
});
