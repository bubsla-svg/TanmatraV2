import { test, expect } from "@playwright/test";
import { MenuPage } from "../support/pages/MenuPage";
import { CartDrawer } from "../support/pages/CartDrawer";

/**
 * A2 (audit G1 blocker-to-automation, EC-9 §16.1) — the server's allergen
 * safety gate (`checkoutSafety.ts` assessAllergenAck, 422
 * `allergen_ack_required`) previously had NO pre-submit affordance: a guest
 * with an allergen-flagged cart discovered it only after Continue to payment
 * failed once. This proves the ack is visible before submit, an unchecked
 * attempt is caught client-side (inline error + focus on the control), and
 * checking it clears the way.
 *
 * DEPLOYED-ONLY, same reason as `availability.spec.ts`: the ack control's
 * visibility depends on a client-side fetch of `/api/menu/public`
 * (`AlacarteDetails` — `useQuery(["menu","public"], ...)`), which only
 * resolves through the storefront's `/api/*` rewrite when `API_UPSTREAM` was
 * set at build time — true for the deployed service, not the PR-gate build
 * (see next.config.ts's own comment on the rewrite being build-time-only).
 * In the PR-gate build that query never resolves, so the ack block never has
 * data to decide it's needed — there's no fixture-free way to prove it here
 * before deploy. The predicate it's built on (`flagCartAllergens`, which
 * mirrors the server's `assessAllergenAck` exactly) is unit-tested DB-free in
 * `lib/allergenAck.test.ts` and runs on every PR regardless.
 *
 * Stops short of completing a real Razorpay payment on purpose — this only
 * proves the client no longer walks a guest into the 422 blind; a live
 * capture is out of scope for this suite.
 */
const deployedLive = process.env["E2E_LIVE_CHECKOUT"] === "1" ? test : test.skip;

interface LiveDish {
  id: number;
  slug: string;
  name: string;
  isAvailable?: boolean;
  allergens?: string[];
  contraindications?: string[];
}

deployedLive(
  "an allergen-flagged cart surfaces the ack pre-submit, catches an unchecked attempt, then clears",
  async ({ page }) => {
    const menuRes = await page.request.get("/api/menu/public");
    expect(menuRes.ok()).toBeTruthy();
    const { dishes } = (await menuRes.json()) as { dishes: LiveDish[] };
    const flagged = dishes.find(
      (d) => d.isAvailable !== false && ((d.allergens?.length ?? 0) > 0 || (d.contraindications?.length ?? 0) > 0),
    );
    expect(flagged, "live menu has at least one available, allergen-flagged dish").toBeTruthy();

    const menu = new MenuPage(page);
    const cart = new CartDrawer(page);
    await menu.goto();
    await menu.addToCart(flagged!.name);
    await menu.openCart();
    await cart.checkoutLink.click();
    await expect(page).toHaveURL(/\/checkout\?mode=alacarte/);

    // Pre-submit: the ack is visible before any submit attempt, naming the
    // flagged dish.
    const ack = page.getByTestId("allergen-ack");
    await expect(ack).toBeVisible();
    await expect(ack).not.toBeChecked();
    await expect(page.getByText(flagged!.name, { exact: false })).toBeVisible();

    // Fill the rest of the form — including the DPDP consent, a SEPARATE
    // required checkbox — so allergen-ack is the ONLY thing standing between
    // this cart and a submit attempt.
    await page.getByLabel("Mobile number").fill("9876543210");
    await page.getByLabel("Flat / house · street").fill("Flat 3B, Sector 62");
    await page.getByLabel("City").fill("Noida");
    await page.getByLabel("PIN code").fill("201301");
    await page.locator("label", { hasText: "DPDP Act 2023" }).locator('input[type="checkbox"]').check();

    const pay = page.getByRole("button", { name: /continue to payment/i });
    await expect(pay).toBeEnabled(); // clickable regardless of ack — see AlacarteDetails' click-time gate

    // Unchecked submit: caught client-side, not by a round trip to the
    // server's 422 — inline error appears and focus lands on the control.
    await pay.click();
    await expect(page.getByRole("alert").filter({ hasText: /reviewed the allergen information/i })).toBeVisible();
    await expect(ack).toBeFocused();

    // Checking it clears the blocker: the inline error retracts immediately
    // (no need to re-attempt submit to see it go).
    await ack.check();
    await expect(page.getByRole("alert").filter({ hasText: /reviewed the allergen information/i })).toHaveCount(0);

    // Submitting again proceeds past the client-side gate — the button moves
    // to its busy state instead of bouncing back to the ack error. Stops
    // here deliberately; completing the Razorpay capture is out of scope.
    await pay.click();
    await expect(page.getByRole("button", { name: /opening payment/i })).toBeVisible();
  },
);
