/**
 * CUJ money-path pack — the critical user journeys that move money, coded
 * once so regressions surface in CI instead of live click-throughs.
 *
 * Layered by what each environment can prove:
 *
 *  ALWAYS RUN (no credentials needed)
 *   CUJ-1  Browse → PDP → add to cart → drawer shows ONE Checkout CTA
 *          (regression: the dead "Pay now · UPI / Cards" express button)
 *   CUJ-2  Checkout address gate → canvas-free picker (regression: the
 *          "Map tiles couldn't load" dead map) → manual-entry path →
 *          serviceability feedback
 *   CUJ-3  /api/geo/reverse contract (GPS→address chain of the picker)
 *
 *  ENV-GATED (run when the test facility is configured; skip otherwise)
 *   CUJ-4  Guest OTP login via a Firebase TEST phone number
 *          → set E2E_TEST_PHONE + E2E_TEST_OTP (Firebase Console → Auth →
 *            Phone → "Phone numbers for testing"; fixed OTP, no SMS sent)
 *   CUJ-5  Razorpay TEST-mode modal opens for a real server order
 *          → set E2E_RZP_TEST=1 against a deployment running rzp_test_* keys
 *
 * Run:  E2E_BASE_URL=https://tanmatra.food pnpm exec playwright test cuj_money_paths
 * The same specs gate PRs locally and act as nightly synthetics against prod.
 */

import { test, expect } from "@playwright/test";
import { cartItem, seedCart, API_BASE, PINCODES, rupees } from "../fixtures";

const TEST_PHONE = process.env["E2E_TEST_PHONE"]; // e.g. 9999999901 (Firebase fictional)
const TEST_OTP = process.env["E2E_TEST_OTP"]; // the fixed code configured for it
const RZP_TEST = process.env["E2E_RZP_TEST"] === "1";

// ─── CUJ-1: browse → PDP → cart → single checkout CTA ───────────────────────

test.describe("CUJ-1 cart drawer money CTA", () => {
  test("adding a dish yields ONE checkout CTA and no dead express button", async ({ page }) => {
    await seedCart(page, [cartItem({ quantity: 1 })]);
    await page.goto("/menu");

    // Open the drawer via the persistent cart affordance.
    await page.getByRole("button", { name: /cart/i }).first().click();

    // The dead "Pay now · UPI / Cards" button must NOT come back.
    await expect(page.getByRole("button", { name: /pay now/i })).toHaveCount(0);

    // Exactly one checkout CTA, carrying the total.
    const checkout = page.getByRole("link", { name: /checkout ·/i });
    await expect(checkout).toHaveCount(1);
    await expect(checkout).toContainText("₹");
  });
});

// ─── CUJ-2: address gate → canvas-free picker → manual entry ────────────────

test.describe("CUJ-2 address picker (canvas-free)", () => {
  test("place-order without an address opens the picker; manual entry reaches the details form", async ({ page }) => {
    await seedCart(page, [cartItem({ quantity: 2 })]);
    await page.goto("/checkout");

    // Trip the address gate. With no address, Review & Pay is disabled with
    // a visible reason (PR-09) rather than an enabled click-then-toast, so
    // the picker opens from the address card's own CTA instead.
    await expect(
      page.getByRole("button", { name: /review & pay/i }).first(),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: /add your delivery address/i })
      .click();

    // The rebuilt picker: prompt copy present, and the old dead-map states
    // must never render (no Maps JS in the component at all).
    await expect(page.getByText(/where should we deliver/i)).toBeVisible();
    await expect(page.getByText(/map tiles couldn't load/i)).toHaveCount(0);
    await expect(page.getByPlaceholder(/search area, sector or landmark/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /use my current location/i })).toBeVisible();

    // Manual path is always one tap away.
    await page.getByRole("button", { name: /enter address manually/i }).click();
    await expect(page.getByText(/enter complete address/i)).toBeVisible();

    // Serviceability feedback is live on the PIN field.
    await page.getByPlaceholder("201301").fill(PINCODES.serviceable);
    await expect(page.getByText(/we deliver here/i).first()).toBeVisible();
    await page.getByPlaceholder("201301").fill(PINCODES.outOfZone);
    await expect(page.getByText(/we don't deliver to/i).first()).toBeVisible();
  });
});

// ─── CUJ-3: GPS→address chain (server reverse geocode) ──────────────────────

test.describe("CUJ-3 /geo/reverse contract", () => {
  test("Noida coords resolve to a serviceable address", async ({ request }) => {
    const res = await request.get(`${API_BASE}/geo/reverse?lat=28.5708&lng=77.3260`);
    expect(res.ok(), `GET /geo/reverse → ${res.status()}`).toBeTruthy();
    const body = (await res.json()) as {
      ok: boolean;
      formattedAddress: string;
      city: string;
      pincode: string;
    };
    expect(body.ok).toBe(true);
    expect(body.formattedAddress.length).toBeGreaterThan(10);
    expect(body.pincode).toMatch(/^\d{6}$/);
  });

  test("rejects malformed and out-of-region coordinates", async ({ request }) => {
    const bad = await request.get(`${API_BASE}/geo/reverse?lat=abc&lng=77`);
    expect(bad.status()).toBe(400);
    // London — outside the India bounding box; must not proxy worldwide.
    const oob = await request.get(`${API_BASE}/geo/reverse?lat=51.5&lng=-0.12`);
    expect(oob.status()).toBe(400);
  });
});

// ─── CUJ-4: guest OTP login (Firebase test phone number) ────────────────────

test.describe("CUJ-4 guest OTP auth", () => {
  test.skip(
    !TEST_PHONE || !TEST_OTP,
    "Set E2E_TEST_PHONE + E2E_TEST_OTP (Firebase Console → Auth → Phone → 'Phone numbers for testing') to run the OTP CUJ headlessly — fixed code, no SMS sent.",
  );

  test("guest checkout phone → fixed OTP → verified session", async ({ page }) => {
    await seedCart(page, [cartItem({ quantity: 1 })]);
    await page.goto("/checkout");
    // With no address, Pay is disabled with a visible reason (PR-09) — the
    // address flow is entered from the address card's CTA instead.
    await expect(
      page.getByText("Select a delivery address to continue").first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /review & pay/i }).first(),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: /add your delivery address/i })
      .click();

    // Complete the address gate via manual entry (guest has none saved).
    await page.getByRole("button", { name: /enter address manually/i }).click();
    await page.getByLabel(/flat \/ house/i).fill("A-101 Test Towers");
    await page.getByPlaceholder(/sector 62/i).fill("Sector 18, Noida");
    await page.getByPlaceholder("Noida").fill("Noida");
    await page.getByPlaceholder("201301").fill(PINCODES.serviceable);
    await page.getByRole("button", { name: /save address/i }).click();

    // Place order again → guest auth dialog.
    await page.getByRole("button", { name: /review & pay/i }).first().click();
    await page.getByPlaceholder("Enter 10-digit mobile number").fill(TEST_PHONE!);
    await page.getByRole("button", { name: /send|continue|otp/i }).first().click();

    // Segmented 6-box OTP (PR-09): a full-code fill into box 1 distributes
    // across the boxes via the multi-digit autofill branch.
    await page.getByLabel("OTP digit 1 of 6").fill(TEST_OTP!);
    await page.getByRole("button", { name: /verify & continue/i }).click();

    // Verified session: the dialog resolves and the order confirm path opens
    // (either the confirm sheet or Razorpay). Either way the OTP step is gone.
    await expect(page.getByLabel("OTP digit 1 of 6")).toHaveCount(0, { timeout: 15_000 });
  });
});

// ─── CUJ-5: Razorpay test-mode modal ────────────────────────────────────────

test.describe("CUJ-5 razorpay test-mode", () => {
  test.skip(
    !RZP_TEST || !TEST_PHONE || !TEST_OTP,
    "Set E2E_RZP_TEST=1 (deployment on rzp_test_* keys) plus the OTP env to drive the payment modal. Test instruments: card 4111 1111 1111 1111 / UPI success@razorpay.",
  );

  test("checkout reaches the Razorpay modal for a server-priced order", async ({ page }) => {
    await seedCart(page, [cartItem({ quantity: 1, unitPrice: rupees(130) })]);
    await page.goto("/checkout");
    // (Assumes CUJ-4 storageState or a fresh OTP run; kept standalone-simple:
    // this leg is about the money modal, so any failure before it is a real
    // checkout regression too.)
    await page.getByRole("button", { name: /review & pay/i }).first().click();
    // Razorpay's test-mode checkout mounts an iframe from checkout.razorpay.com.
    const rzpFrame = page.frameLocator('iframe[src*="razorpay"]').first();
    await expect(rzpFrame.locator("body")).toBeVisible({ timeout: 20_000 });
  });
});
