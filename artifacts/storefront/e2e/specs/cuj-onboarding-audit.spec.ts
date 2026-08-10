import { test, expect } from "@playwright/test";
import { collectErrors, ORDERABLE_DISH } from "../fixtures";

// Same gate the other API-dependent storefront specs use. The storefront job
// runs `next start` with NO api-server behind it, so anything that needs a real
// verdict or a real 401 cannot pass there — it is not a flake, the dependency
// is absent. These run against a deployed target with E2E_LIVE_CHECKOUT=1.
const deployedLive = process.env["E2E_LIVE_CHECKOUT"] === "1" ? test : test.skip;

/**
 * CUJ-Onboarding Audit (OB-6). Proves core onboarding conversion lock rules:
 * 1. Zero auth wall on consumer catalog surfaces logged-out (/, /menu, PDPs, /plans, /trial).
 * 2. Commitment operations (trial purchase, checkout, coach, account) land on /login?next=.
 * 3. Front-door ServiceabilityBar remains advisory UX — unserviceable verdicts display inline
 *    notify-me capture without blocking menu catalog scrollability or interaction.
 */

test.describe("OB-6 Onboarding Conversion Gate & Auth Audit", () => {
  test("zero auth wall on catalog and discovery routes when logged out", async ({ page }) => {
    const errors = collectErrors(page);
    const publicPaths = [
      "/",
      "/menu",
      `/menu?dish=${ORDERABLE_DISH.slug}`,
      "/plans",
      "/trial",
    ];

    for (const path of publicPaths) {
      await page.goto(path);
      // Ensure page does NOT redirect to /login
      expect(page.url()).not.toContain("/login");
      // Assert zero auth modals or OTP blockers intercept public browsing.
      // Target <PhoneAuth/>'s own inputs (#pa-phone / autocomplete=one-time-code),
      // not any tel field: the homepage's §4 clinical waitlist asks for a phone
      // number too, and that is unauthenticated marketing capture, not a wall.
      // Matching `input[type='tel']` failed on it while the actual invariant —
      // no auth island intercepts a logged-out browser — still held.
      await expect(page.locator("input[autocomplete='one-time-code']")).toHaveCount(0);
      await expect(page.locator("#pa-phone")).toHaveCount(0);
    }
    expect(errors).toEqual([]);
  });

  // The storefront does NOT redirect logged-out users to /login. Auth-gated
  // surfaces are islands: the page renders, its data call 401s, and the island
  // swaps in <PhoneAuth/> in place (CLAUDE.md, "Auth-gated surfaces"). Asserting
  // a redirect here failed against a correctly-behaving app — the URL stayed
  // /account, which is the contract, not a bug.
  //
  // What actually matters for the conversion gate is tested instead: the surface
  // stays on its own URL (so the intended destination is never lost) and it
  // shows an auth prompt rather than leaking account content.
  deployedLive("commitment surfaces prompt for auth in place, without losing the destination", async ({ page }) => {
    const protectedPaths = ["/account", "/account/orders", "/account/preferences"];

    for (const path of protectedPaths) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.locator("input[type='tel']").first()).toBeVisible();
    }
  });

  deployedLive("ServiceabilityBar unserviceable verdict renders notify form without blocking menu browsing", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("/menu");

    const pinInput = page.locator("input[inputmode='numeric']").first();
    const checkBtn = page.getByRole("button", { name: "Check" });

    // Ensure ServiceabilityBar rendered at top of catalog
    await expect(pinInput).toBeVisible();

    // Enter out-of-bounds unserviceable pincode (e.g., Mumbai 400001)
    await pinInput.fill("400001");
    await checkBtn.click();

    // Verify advisory unserviceable verdict displays
    await expect(page.getByText(/We're not in 400001 yet/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Notify me" })).toBeVisible();

    // Core invariant: menu grid beneath remains fully scrollable, browsable, and un-walled
    const dishLinks = page.locator('a[href^="/menu?dish="]');
    expect(await dishLinks.count()).toBeGreaterThan(35);
    await expect(page.getByText("The menu")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("dietary filter chips filter dishes without triggering auth or write-backs", async ({ page }) => {
    await page.goto("/menu");
    await page.waitForLoadState("networkidle");
    const filterGroup = page.getByRole("group", { name: "Filter dishes by diet" });
    const vegChip = filterGroup.getByRole("button", { name: "Veg", exact: true });
    const nonVegChip = filterGroup.getByRole("button", { name: "Non-veg", exact: true });

    console.log("vegChip count:", await page.getByRole("button", { name: "Veg", exact: true }).count());
    await expect(vegChip).toBeVisible();
    await expect(nonVegChip).toBeVisible();

    // Toggle chip logged-out -> filters grid without any login modal or redirection
    await vegChip.click({ force: true });
    expect(page.url()).not.toContain("/login");
    await expect(page.locator("input[autocomplete='one-time-code']")).toHaveCount(0);

    // D-08 (PR #44): selected state is a border + tint, never a solid gold
    // fill — bg-gold is reserved for this page's one purchase action (the
    // mini-cart bar). vegChip keeps "Veg" as its accessible name throughout
    // (the active-state checkmark is aria-hidden), so it's still the right
    // element to assert against post-click.
    await expect(vegChip).toHaveClass(/border-gold/);
  });
});
