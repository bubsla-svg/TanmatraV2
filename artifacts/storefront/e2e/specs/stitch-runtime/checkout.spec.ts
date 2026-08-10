import { test, expect, type Page } from "@playwright/test";
import { collectErrors } from "../../fixtures";
import { marker, evidenceShot } from "./support";

/**
 * Stitch-runtime evidence — §8/§14 checkout money-path screens (manifest 8.1,
 * 8.3, 14.6, 14.7). Same gating philosophy as cuj-02/cuj-04:
 *
 * 8.1  runs everywhere — /checkout?plan=… hosts the quote-active marker on
 *      every branch (live PlanCheckout, flag-dark CheckoutFlow), so the test
 *      accepts either surface's honest heading, exactly like cuj-06's .or().
 *
 * 14.6/14.7 need the LIVE PlanCheckout (NEXT_PUBLIC_LIVE_CHECKOUT=1 build +
 *      Firebase config shipped) — the same E2E_LIVE_CHECKOUT=1 targets cuj-02
 *      runs against. There the seams are all BROWSER calls, so the network
 *      edge is stubbed with page.route (session probe /api/auth/user auto-
 *      passes the identity gate; quote/create/pay-order return fixtures;
 *      checkout.js is replaced by a stub Razorpay whose modal resolves paid
 *      immediately). The verify seam then drives the state under test: held
 *      open → 14.6 payment-processing; 5xx past verifyWithRetry's bounded
 *      retries → 14.7 payment-unresolved (UnresolvedPaymentPanel).
 *
 * 8.3  is SERVER-rendered from GET /api/orders/:id/status on the Next server
 *      (lib/orderStatus.ts) — page.route cannot intercept a server-side fetch,
 *      and an unknown id renders the honest not-found branch, which carries NO
 *      marker (cuj-06 pins that branch). The marker state therefore needs a
 *      REAL order in the target env: pass its id as E2E_SEEDED_ORDER_ID (the
 *      wave-gate seeded order cuj-06 anticipates); the test skips without it.
 */

const deployedLive = process.env["E2E_LIVE_CHECKOUT"] === "1" ? test : test.skip;
const SEEDED_ORDER_ID = process.env["E2E_SEEDED_ORDER_ID"] ?? "";
const seededOrder = SEEDED_ORDER_ID ? test : test.skip;

const json = (body: unknown, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });

const STUB_USER = {
  id: "u-e2e-evidence", phoneE164: "+919876543210", email: null,
  firstName: "Evidence", lastName: "Bot", profileImageUrl: null,
};

const STUB_ADDRESS = {
  id: "addr-e2e-1", label: "Home", type: "home", line1: "Flat 3B, Sector 62", line2: "",
  city: "Noida", pincode: "201301", phone: "+919876543210", isDefault: true,
  createdAt: "2026-08-01T00:00:00Z", updatedAt: "2026-08-01T00:00:00Z",
};

// PlanQuoteResponse shape (lib/api.ts) — payableTotalPaise gates the CTA.
const STUB_QUOTE = {
  planId: "desk_fuel", track: "veg", mealsPerDelivery: 22, pricePerMealPaise: 14900,
  pricePerDeliveryPaise: 14900, addOns: [], addOnTotalPaise: 0, gstPaise: 16389,
  totalPaise: 344169, creditAppliedPaise: 0, payableTotalPaise: 344169,
};

const STUB_CREATED = {
  subscription: { id: 421, externalOrderId: "sub-421" },
  deliveries: [], bridgeCreditPaise: 0, creditAppliedPaise: 0,
};

const STUB_RZP_ORDER = {
  razorpayOrderId: "order_e2e_stub", amount: 344169, currency: "INR", keyId: "rzp_test_e2e_stub",
};

// Stub for https://checkout.razorpay.com/v1/checkout.js — the same seam the
// real adapter injects (lib/razorpayAdapter.ts). The fake modal resolves paid
// on open(), which is the exact moment PlanCheckout flips verifying=true.
const RZP_SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";
const RZP_STUB_JS = `
  window.Razorpay = function Razorpay(opts) {
    this.open = function () {
      setTimeout(function () {
        opts.handler({
          razorpay_payment_id: "pay_e2e_stub",
          razorpay_order_id: opts.order_id,
          razorpay_signature: "sig_e2e_stub",
        });
      }, 30);
    };
  };
`;

/** Stub every browser seam of the plan money path EXCEPT verify — each test
 *  routes verify itself, because verify's behaviour IS the state under test. */
async function stubPlanMoneyPath(page: Page): Promise<void> {
  await page.route("**/api/auth/user", (route) => route.fulfill(json({ user: STUB_USER })));
  await page.route("**/api/addresses", (route) => route.fulfill(json({ addresses: [STUB_ADDRESS] })));
  await page.route("**/api/subscriptions/quote", (route) => route.fulfill(json(STUB_QUOTE)));
  await page.route("**/api/subscriptions", (route) => route.fulfill(json(STUB_CREATED)));
  await page.route("**/api/payments/razorpay/order", (route) => route.fulfill(json(STUB_RZP_ORDER)));
  await page.route(RZP_SCRIPT_URL, (route) =>
    route.fulfill({ status: 200, contentType: "text/javascript", body: RZP_STUB_JS }),
  );
}

/** Drive the live PlanCheckout form to the pay CTA with real interactions:
 *  the stubbed session probe has already passed the identity gate, and the
 *  stubbed default address prefills delivery — only the eater + consent are
 *  typed, exactly what a returning customer does. */
async function fillPlanDetailsAndPay(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: "Desk Fuel" })).toBeVisible();
  await page.getByRole("textbox", { name: "Who's eating" }).fill("Evidence Bot");
  await page.getByRole("checkbox").check();
  const cta = page.getByRole("button", { name: /continue to payment/i });
  await expect(cta).toBeEnabled();
  await cta.click();
}

test.describe("stitch-runtime · checkout", () => {
  test("8.1 checkout quote-active is wired", async ({ page }) => {
    const errors = collectErrors(page);
    // Reached the way cuj-02 reaches it: a launchable plan seeded via ?plan=.
    await page.goto("/checkout?plan=desk_fuel");
    // Live build → PlanIdentityGate's h1; flag-dark PR-gate build → the
    // skeleton flow's step-1 h1. Both are the route's honest surface, and the
    // host page carries the quote-active marker around either.
    await expect(
      page
        .getByRole("heading", { name: /start your desk fuel plan/i })
        .or(page.getByRole("heading", { name: "Your details" })),
    ).toBeVisible();
    await expect(marker(page, "8.1", "quote-active")).toBeVisible();
    expect(errors).toEqual([]);
    await evidenceShot(page, "8.1");
  });

  seededOrder("8.3 order-confirmed default is wired", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(`/order/confirmed/${encodeURIComponent(SEEDED_ORDER_ID)}`);
    // The ok branch's h1 is the server's status label (varies with the seeded
    // order's real state), so pin role + the order id + the always-present way
    // out; the marker below pins the confirmed (non-error) branch itself.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(`#${SEEDED_ORDER_ID}`)).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to the menu" })).toBeVisible();
    await expect(marker(page, "8.3", "default")).toBeVisible();
    expect(errors).toEqual([]);
    await evidenceShot(page, "8.3");
  });

  deployedLive("14.6 checkout payment-processing is wired", async ({ page }) => {
    await stubPlanMoneyPath(page);
    // Hold verify open: money is captured, confirmation never lands — the
    // window where verifying=true renders the payment-processing state.
    await page.route("**/api/payments/razorpay/verify", () => {
      /* never respond — keep the verify in flight */
    });
    await page.goto("/checkout?plan=desk_fuel");
    await fillPlanDetailsAndPay(page);
    await expect(page.getByRole("button", { name: /confirming your payment/i })).toBeVisible();
    await expect(marker(page, "14.6", "payment-processing")).toBeVisible();
    await evidenceShot(page, "14.6");
  });

  deployedLive("14.7 checkout payment-unresolved is wired", async ({ page }) => {
    await stubPlanMoneyPath(page);
    // Verify 5xx on every attempt: verifyWithRetry (lib/verifyRetry.ts, 3
    // bounded attempts) exhausts, and PlanCheckout must swap the whole form
    // for UnresolvedPaymentPanel — never a re-payable CTA on captured money.
    await page.route("**/api/payments/razorpay/verify", (route) =>
      route.fulfill(json({ error: "verify unavailable", code: "verify_unavailable" }, 503)),
    );
    await page.goto("/checkout?plan=desk_fuel");
    await fillPlanDetailsAndPay(page);
    await expect(page.getByRole("heading", { name: /confirming your payment/i })).toBeVisible();
    // The panel's single action: the idempotent status re-check.
    await expect(page.getByRole("button", { name: /check payment status/i })).toBeVisible();
    await expect(marker(page, "14.7", "payment-unresolved")).toBeVisible();
    await evidenceShot(page, "14.7");
  });
});
