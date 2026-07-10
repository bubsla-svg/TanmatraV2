import { test, expect } from "@playwright/test";
import { seedCart, cartItem, PINCODES } from "../fixtures";

// IDs 1, 2, 4, 5 (storefront/B2B), 3 (RD onboarding), 11 (auth guard), 19 (geo).

test.describe("Auth guard & delivery zone", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.clear());
  });

  // [11] Guest opening a gated route is blocked (no ghost account). @p0
  test("[11] @p0 guest cannot reach /preferences or /account", async ({ page }) => {
    // Fresh context = incognito-equivalent (no auth cookie).
    for (const path of ["/preferences", "/account"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      // Either the router redirects to a login route, or an inline sign-in prompt
      // is shown — never the authenticated content.
      const signInPrompt = page
        .getByRole("button", { name: /sign in|log ?in|continue/i })
        .or(page.getByText(/sign in to (continue|view|manage)/i));
      const redirectedAway = !new RegExp(`${path}/?$`).test(new URL(page.url()).pathname);
      if (!redirectedAway) {
        await expect(
          signInPrompt.first(),
          `expected an auth block on ${path} (url=${page.url()})`,
        ).toBeVisible();
      }
    }
  });

  // [19] Out-of-zone pincode blocks checkout + shows expansion-interest form. @p0
  test("[19] @p0 out-of-zone pincode blocks checkout and offers notify-me", async ({ page }) => {
    await seedCart(page, [cartItem()]);
    await page.goto("/checkout");
    await expect(page.getByText("Delivery Address")).toBeVisible();

    // Open the new-address form and enter an out-of-zone (Bengaluru) pincode.
    // Copy is grounded in Checkout.tsx ("Notify Me" + "We don't deliver ...").
    // TODO(testid): add data-testid="addr-pincode" + "notify-me" for stable hooks.
    const pin = page.getByPlaceholder(/pincode/i).first();
    await pin.fill(PINCODES.outOfZone); // 560001 — not in the Noida NCR zone
    await expect(page.getByText(/don.?t deliver/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /notify me/i })).toBeVisible();

    // Sanity: a serviceable Noida pincode clears the block.
    await pin.fill(PINCODES.serviceable); // 201301
    await expect(page.getByText(/don.?t deliver/i)).toBeHidden();
  });

  // [3] RD partner onboarding captures license/compliance fields. @p0
  test.fixme("[3] @p0 'For Dietitians' form captures license + compliance", async () => {
    // Assertion source: submitted API payload + DB row. Open the RD onboarding
    // page (footer "For Dietitians"), fill license/compliance fields, submit,
    // and assert the POST body includes them and a row is persisted.
  });

  // [1] Busy lunch: high-protein chicken → add → checkout, minimal friction.
  test.fixme("[1] high-protein chicken quick journey completes", async () => {
    // Assertion source: UI + cart event logs. Needs data-testid on quick-filter
    // chips + dish cards. Filter high-protein chicken, add first result, proceed
    // to /checkout, assert no blocking modal and cart contains the dish.
  });

  // [2] Non-tech patient: content is understandable, no jargon dead-ends.
  test.fixme("[2] accessible content variant has no jargon dead-ends", async () => {
    // Assertion source: UI snapshot + content-rules API. Needs the a11y copy
    // variant flag + a content lint rule; assert protocol/macro copy passes.
  });

  // [4] Corporate HR lead: pilot form visible + submittable.
  test.fixme("[4] corporate pilot lead form submits", async () => {
    // Assertion source: UI + lead API response. Browse corporate plans, submit
    // the pilot form, assert 2xx + lead id echoed.
  });

  // [5] Gym affiliate journey routes correctly.
  test.fixme("[5] gym affiliate protocol + cohort links route correctly", async () => {
    // Assertion source: UI route + tracking event API. Apply performance filter,
    // open cohort link, assert destination route + a tracking event fired.
  });
});
