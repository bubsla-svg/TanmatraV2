import { test, expect } from "@playwright/test";
import { ORDERABLE_DISH } from "../fixtures";
import { MenuPage } from "../support/pages/MenuPage";
import { CartDrawer } from "../support/pages/CartDrawer";

/**
 * D-22 — the audit's multi-tap finding: a fast double-tap on "Continue to
 * payment" fired 2–3 identical POST /api/orders. The server's own
 * Idempotency-Key middleware (mounted on this route in app.ts) already
 * collapses concurrent duplicates to one order — proven at the integration
 * level in api-server's checkout.doubletap.test.ts, including a negative
 * control confirming it actually creates two rows without the middleware.
 * What was missing was a client-side guard: this proves the SECOND tap
 * never even reaches the network, closing the wasted-request half of the
 * defect the server-side fix doesn't touch.
 *
 * Runs against the PR-gate build (no live flag needed): AlacarteCheckout's
 * order-create is a real browser `fetch`, not an RSC server fetch, so
 * `page.route` can intercept it regardless of whether `API_UPSTREAM` was
 * set at build time — unlike availability.spec.ts / checkout-allergen.spec.ts,
 * which depend on server-rendered or client-queried live catalog data. The
 * checkout page itself has no live-checkout flag guard (only the cart
 * drawer's link into it does), so navigating directly to
 * `/checkout?mode=alacarte` reaches the real form in every build.
 *
 * Stops at the order-create call on purpose: the next real step (Razorpay's
 * external checkout.js + a live modal) is out of scope for what this spec
 * needs to prove and isn't something a PR-gate run should depend on.
 */

test("a fast double-tap on Continue to payment sends exactly one POST /api/orders", async ({ page }) => {
  // The Pay CTA stays disabled until a QuoteSnapshot loads (server-priced
  // totals — money discipline, not this spec's concern), and there is no
  // live api-server behind the PR-gate build for it to fetch from. Stubbed
  // BEFORE the order-create route below: distinct URLs (`/orders/quote` vs
  // `/orders`), so registration order doesn't matter here, but keeping the
  // quote stub first mirrors the real request sequence.
  await page.route("**/api/orders/quote", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "active",
        version: 1,
        expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
        items: [{ id: 98, name: ORDERABLE_DISH.name, qty: 1, unitPaise: 9900, linePaise: 9900 }],
        subtotalPaise: 9900,
        deliveryFeePaise: 0,
        packagingPaise: 0,
        discountPaise: 0,
        taxPaise: 495,
        payableNowPaise: 10395,
        amountToFreeDeliveryPaise: 0,
        etaMinutes: 25,
        serviceability: { pincode: "201301", serviceable: true },
      }),
    }),
  );

  let orderRequests = 0;
  await page.route("**/api/orders", async (route) => {
    orderRequests += 1;
    // A deliberate delay: widens the in-flight window so a second tap that
    // beats React's re-render (the actual race this guards against) has
    // every chance to reach the network if the client-side guard is broken.
    await new Promise((r) => setTimeout(r, 300));
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        orderId: "e2e-doubletap-1",
        serverOrderId: 1,
        status: "placed",
        etaMinutes: 25,
        totalPaise: 9900,
      }),
    });
  });
  // The flow stops at order-create; nothing downstream (Razorpay order
  // create, the modal) is expected to be reached. Left permanently pending
  // rather than fulfilled/aborted: this spec's whole point is the button's
  // BUSY window, and letting this step resolve (or error) would let
  // handlePay's catch clause flip `busy` back to false and the label back to
  // "Continue to payment" mid-assertion — a race in the spec, not the app.
  // A never-resolving route is inert by construction and Playwright tears
  // down all in-flight routes when the test ends.
  await page.route("**/api/payments/razorpay/order", () => new Promise(() => {}));

  const menu = new MenuPage(page);
  const cart = new CartDrawer(page);
  await menu.goto();
  // quinoa-khichdi carries no declared allergens — keeps this spec decoupled
  // from A2's allergen-ack surfacing, a separate concern on a separate branch.
  await menu.addToCart(ORDERABLE_DISH.name);
  await menu.openCart();
  await page.goto("/checkout?mode=alacarte"); // direct nav — see header comment

  await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();
  await page.getByLabel("Mobile number").fill("9876543210");
  await page.getByLabel("Flat / house · street").fill("Flat 3B, Sector 62");
  await page.getByLabel("City").fill("Noida");
  await page.getByLabel("PIN code").fill("201301");
  await page.locator("label", { hasText: "DPDP Act 2023" }).locator('input[type="checkbox"]').check();

  const pay = page.getByRole("button", { name: /continue to payment/i });
  await expect(pay).toBeEnabled();
  const startBox = await pay.boundingBox();

  // The double-tap itself, dispatched as two RAW DOM click events inside one
  // page.evaluate — deliberately NOT `Promise.all([pay.click(), pay.click()])`.
  // Playwright's own `.click()` re-runs its actionability check (including
  // "not disabled") per call, each a round trip from the test process, which
  // is slow enough that React's re-render from the first click routinely
  // wins the race before the second call's check even runs — so that form
  // passes this spec whether or not the app has a real guard, proving
  // nothing. Two synchronous `.click()`s on the actual button element, both
  // queued in the same browser task before any React commit can happen in
  // between, is what an impatient real tap (or a naive multi-tap script)
  // actually produces, and it's the only version that can tell a working
  // guard apart from a decorative one.
  await page.locator("button", { hasText: /continue to payment/i }).evaluate((el) => {
    (el as HTMLButtonElement).click();
    (el as HTMLButtonElement).click();
  });

  // The button moves to its busy state — one attempt genuinely went through.
  // Stays in this state for the rest of the test (the razorpay-order route
  // above never resolves), so it's safe to measure dimensions here rather
  // than racing a second re-query against it reverting.
  const busyButton = page.getByRole("button", { name: /opening payment/i });
  await expect(busyButton).toBeVisible();

  // Dimension stability (D-22's other half): the busy-state button occupies
  // the same footprint the idle one did, not a narrower one.
  const busyBox = await busyButton.boundingBox();
  expect(startBox).toBeTruthy();
  expect(busyBox).toBeTruthy();
  expect(busyBox!.width).toBe(startBox!.width);

  // Give any wrongly-fired second request time to land before asserting the
  // count — a race that only manifests under a slow assertion is still a
  // race.
  await page.waitForTimeout(500);
  expect(orderRequests, "exactly one order-create reached the network").toBe(1);
});
