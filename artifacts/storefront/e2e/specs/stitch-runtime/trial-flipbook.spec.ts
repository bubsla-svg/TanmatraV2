import { test, expect, type Page } from "@playwright/test";
import { evidenceShot } from "./support";

/**
 * RED-TEAM PHASE 0a — flipbook for the ₹399 3-Day Taste Test.
 *
 * A screenshot of every state of the trial journey, in order, so the UI laws
 * that source review cannot reach (the payment sheet opening over our own
 * screen, back-one-step with state intact, blank/dead ends, spinners with no
 * honest progress) can be reviewed against evidence instead of asserted from
 * a reading of the components.
 *
 * SCOPE, STATED EXPLICITLY (AGENT_WORKING_AGREEMENT §6 — no silent truncation):
 *
 *  - This captures the TRIAL journey only. The à-la-carte journey has its own
 *    entry (`/menu` → cart → `/checkout`) and is NOT in these frames.
 *  - Frames 5-9 need the live PlanCheckout (`NEXT_PUBLIC_LIVE_CHECKOUT=1` at
 *    BUILD time — it is inlined by `next build`, so a flag-dark build renders
 *    the skeleton flow and these skip). Same gate as `checkout.spec.ts`'s
 *    14.6/14.7, and the same reason.
 *  - Every browser seam is stubbed with `page.route`, reusing the exact
 *    fixtures `checkout.spec.ts` established. NOTHING here touches a real API,
 *    a real database, or a real Razorpay account: a flipbook must not be able
 *    to place an order or send an OTP.
 *  - The Razorpay modal is the gateway's own iframe. It cannot be rendered
 *    from a stub, so frame 7 captures OUR screen at the moment the sheet is
 *    handed control — which is the half of Law 2 that is ours to get right
 *    (summary still visible, our theme still on screen, no white flash). The
 *    sheet's own chrome must be reviewed on a real device against a test key;
 *    that is named in the report as still-unverified rather than implied here.
 *
 * On the ten laws: this spec captures evidence, it does not grade it. The
 * "Experience Contract — ten laws" document is cited by name across this repo
 * (`scripts/lint-copy-vocabulary.ts:5`, and Laws 1-10 individually in
 * component comments) but its text is not IN the repo — the same absence
 * `menu-flipbook.spec.ts` and `docs/TNM-MENU-01/M0-FINDINGS.md:222` already
 * record. Grading these frames is therefore an owner review against a document
 * only the owner holds. The frames are ordered and named so that review is a
 * read-through, not an excavation.
 */

/**
 * THE WHOLE SUITE IS GATED, and that is deliberate.
 *
 * This is an evidence-capture run, not a merge gate. `storefront.yml` runs the
 * entire mobile project on every PR, so an ungated frame here would become a
 * blocking check — and two things make that wrong:
 *
 *  1. Most frames need the LIVE PlanCheckout. `NEXT_PUBLIC_LIVE_CHECKOUT` is
 *     inlined at BUILD time, and the PR-gate build is flag-dark, so
 *     `/checkout` renders CheckoutFlow instead — no PIN gate, no plan details,
 *     no pay CTA. Frames asserting those would fail for a reason that has
 *     nothing to do with the change under review.
 *  2. F06 is designed to FAIL while F-2 stands. A frame that reddens every
 *     unrelated PR is not evidence, it is a broken gate.
 *
 * So: run the flipbook deliberately, with E2E_LIVE_CHECKOUT=1 against a
 * live-checkout build (see docs/red-team/PHASE-0-TRIAL-FLIPBOOK.md). In PR CI
 * every frame skips and the storefront gate stays about the PR.
 */
const frame = process.env["E2E_LIVE_CHECKOUT"] === "1" ? test : test.skip;

const json = (body: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

const SERVICEABLE_PIN = "201301"; // Noida core — api-zod's SERVICEABLE_PINCODES
const UNSERVICEABLE_PIN = "560001"; // Bengaluru — deliberately outside the set

const STUB_USER = {
  id: "u-flipbook",
  phoneE164: "+919876543210",
  email: null,
  firstName: "Flipbook",
  lastName: "Bot",
  profileImageUrl: null,
};

const STUB_ADDRESS = {
  id: "addr-flipbook-1",
  label: "Home",
  type: "home",
  line1: "Flat 3B, Sector 62",
  line2: "",
  city: "Noida",
  pincode: SERVICEABLE_PIN,
  phone: "+919876543210",
  isDefault: true,
  createdAt: "2026-08-01T00:00:00Z",
  updatedAt: "2026-08-01T00:00:00Z",
};

/**
 * The trial quote. `cycle: "one_off"` and a flat ₹399 are what the server
 * actually returns for trial_3day (lib/subscription-rules planCatalog.ts:229)
 * — the fixture must not smooth that over, because the label rendered against
 * it is exactly what F-2 is about.
 */
const STUB_TRIAL_QUOTE = {
  planId: "trial_3day",
  track: "veg",
  cycle: "one_off",
  mealsPerDelivery: 3,
  mealsPerCycle: 3,
  pricePerMealPaise: null,
  pricePerDeliveryPaise: 39900,
  addOns: [],
  addOnTotalPaise: 0,
  gstPaise: 0,
  totalPaise: 39900,
  cycleTotalPaise: 39900,
  creditAppliedPaise: 0,
  payableTotalPaise: 39900,
  servedTracks: ["veg", "nonveg"],
};

const STUB_CREATED = {
  subscription: { id: 9001, externalOrderId: "sub-9001" },
  deliveries: [],
  bridgeCreditPaise: 0,
  creditAppliedPaise: 0,
};

const STUB_RZP_ORDER = {
  razorpayOrderId: "order_flipbook_stub",
  amount: 39900,
  currency: "INR",
  keyId: "rzp_test_flipbook_stub",
};

const RZP_SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

/**
 * Stand-in for the gateway's checkout.js. `open()` does NOT resolve on its own
 * here (unlike checkout.spec.ts's stub): it flips a flag so the spec can
 * screenshot our screen at the moment control passes to the sheet, then
 * resolve on demand. `ondismiss` is wired so the back-during-sheet frame
 * exercises the real dismissal path rather than a timeout.
 */
const RZP_STUB_JS = `
  window.__rzpOpened = false;
  window.__rzpOpts = null;
  window.Razorpay = function Razorpay(opts) {
    window.__rzpOpts = opts;
    this.open = function () { window.__rzpOpened = true; };
  };
  window.__rzpResolvePaid = function () {
    window.__rzpOpts.handler({
      razorpay_payment_id: "pay_flipbook_stub",
      razorpay_order_id: window.__rzpOpts.order_id,
      razorpay_signature: "sig_flipbook_stub",
    });
  };
  window.__rzpDismiss = function () {
    var cb = window.__rzpOpts.modal && window.__rzpOpts.modal.ondismiss;
    if (cb) cb();
  };
`;

/** Every browser seam of the trial money path EXCEPT verify, which each frame
 *  routes itself because verify's behaviour is the state under test. */
async function stubTrialMoneyPath(page: Page): Promise<void> {
  await page.route("**/api/auth/user", (route) => route.fulfill(json({ user: STUB_USER })));
  await page.route("**/api/addresses", (route) => route.fulfill(json({ addresses: [STUB_ADDRESS] })));
  await page.route("**/api/subscriptions/quote", (route) => route.fulfill(json(STUB_TRIAL_QUOTE)));
  await page.route("**/api/subscriptions", (route) => route.fulfill(json(STUB_CREATED)));
  await page.route("**/api/payments/razorpay/order", (route) => route.fulfill(json(STUB_RZP_ORDER)));
  await page.route(RZP_SCRIPT_URL, (route) =>
    route.fulfill({ status: 200, contentType: "text/javascript", body: RZP_STUB_JS }),
  );
}

/** Serviceability verdicts, keyed on the pin in the path. */
async function stubServiceability(page: Page): Promise<void> {
  await page.route("**/api/serviceability/**", (route) => {
    const pin = route.request().url().split("/").pop() ?? "";
    return route.fulfill(json({ serviceable: pin === SERVICEABLE_PIN }));
  });
}

/** Clear the persisted verdict so the gate is actually rendered — it
 *  short-circuits on a stored `serviceable` and the frame would be missed. */
async function clearServiceabilityMemory(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      localStorage.removeItem("tnm_serviceability_state");
    } catch {
      /* private mode — nothing to clear */
    }
  });
}

async function passServiceabilityGate(page: Page): Promise<void> {
  await page.getByRole("textbox", { name: "PIN code" }).fill(SERVICEABLE_PIN);
  await page.getByRole("button", { name: /check|continue/i }).first().click();
}

/**
 * Fill the delivery address through the manual fallback.
 *
 * The address is a map picker, not three text inputs: "Select your location"
 * opens LocationPickerFlow, whose LocationSummaryCard carries the manual
 * escape hatch. Driving that path (rather than seeding state) is deliberate —
 * it is the path a customer without a usable GPS fix actually takes, and the
 * map itself needs a Maps key this build has no reason to carry.
 */
async function fillAddressManually(page: Page): Promise<void> {
  await page.getByRole("button", { name: /select your location/i }).click();
  await page.getByRole("button", { name: /don.t know the exact location/i }).click();
  await page.getByRole("textbox", { name: "Flat / house · street" }).fill(STUB_ADDRESS.line1);
  await page.getByRole("textbox", { name: "City" }).fill(STUB_ADDRESS.city);
  await page.getByRole("textbox", { name: "PIN code" }).fill(SERVICEABLE_PIN);
}

/** Everything the pay CTA needs: eater, address, consent. */
async function completePlanDetails(page: Page): Promise<void> {
  await page.getByRole("textbox", { name: "Who's eating" }).fill("Flipbook Bot");
  await fillAddressManually(page);
  await page.getByRole("checkbox").check();
}

/** Click pay and wait for the gateway sheet to take control. */
async function payAndAwaitSheet(page: Page): Promise<void> {
  const cta = page.getByRole("button", { name: /continue to payment/i });
  await expect(cta).toBeEnabled();
  await cta.click();
  await expect.poll(() => page.evaluate(() => (window as never as { __rzpOpened: boolean }).__rzpOpened)).toBe(true);
}

// ---------------------------------------------------------------------------
// Frames 1-4 — the offer and the gate. No build flag needed: server-rendered.
// ---------------------------------------------------------------------------

test.describe("flipbook · trial · offer", () => {
  frame("F01 offer, veg default — price, creditback, no-auto-renew, the trio", async ({ page }) => {
    await page.goto("/trial");
    await expect(page.getByRole("heading", { name: /try three lunches for ₹399/i })).toBeVisible();
    // The two commercial promises must both be on the first screen, above any
    // question. Their absence here is the Law 1 / Law 5 failure this frame exists to catch.
    await expect(page.getByText(/comes back as credit/i).first()).toBeVisible();
    await expect(page.getByText(/never auto-renews/i)).toBeVisible();
    await evidenceShot(page, "trial-F01-offer-veg");
  });

  frame("F02 offer, non-veg track — the trio swaps, the price does not", async ({ page }) => {
    await page.goto("/trial");
    await page.getByRole("button", { name: "Non-veg" }).click();
    await expect(page.getByText(/₹399/).first()).toBeVisible();
    await evidenceShot(page, "trial-F02-offer-nonveg");
  });

  frame("F03 serviceability gate — asked BEFORE phone, allergens or address", async ({ page }) => {
    await clearServiceabilityMemory(page);
    await stubServiceability(page);
    await page.goto("/checkout?plan=trial_3day&track=veg");
    await expect(page.getByRole("textbox", { name: "PIN code" })).toBeVisible();
    // Law 1: nothing personal may be on this screen. A phone field here is the failure.
    await expect(page.getByRole("textbox", { name: /phone/i })).toHaveCount(0);
    await evidenceShot(page, "trial-F03-serviceability-gate");
  });

  frame("F04 unserviceable PIN — states the verdict and names a next action", async ({ page }) => {
    await clearServiceabilityMemory(page);
    await stubServiceability(page);
    await page.goto("/checkout?plan=trial_3day&track=veg");
    await page.getByRole("textbox", { name: "PIN code" }).fill(UNSERVICEABLE_PIN);
    await page.getByRole("button", { name: /check|continue/i }).first().click();
    // Law 9: a dead end here is the defect — the screen must say what happens next.
    await expect(page.getByText(/don.t deliver|not yet|waitlist|coming soon/i).first()).toBeVisible();
    await evidenceShot(page, "trial-F04-unserviceable");
  });
});

// ---------------------------------------------------------------------------
// Frames 5-9 — the live money path. Build-flag gated.
// ---------------------------------------------------------------------------

test.describe("flipbook · trial · money path", () => {
  frame("F05 identity gate — the phone ask, after serviceability", async ({ page }) => {
    await clearServiceabilityMemory(page);
    await stubServiceability(page);
    await page.route("**/api/auth/user", (route) => route.fulfill(json({ user: null }, 401)));
    await page.goto("/checkout?plan=trial_3day&track=veg");
    await passServiceabilityGate(page);
    await expect(page.getByRole("heading", { name: /start your .* plan/i })).toBeVisible();

    // F-7 (fixed): the recap card prints "one-time" for this plan, so it must
    // NOT also promise subscription management. A ₹399 one-off has no future
    // delivery to pause and no mandate to cancel — the sentence would tell the
    // buyer they had purchased a subscription.
    await expect(page.getByText(/one-time/i).first()).toBeVisible();
    await expect(
      page.getByText(/pause or cancel/i),
      "F-7: a one-off must not promise pause/cancel",
    ).toHaveCount(0);

    await evidenceShot(page, "trial-F05-identity-gate");
  });

  frame("F06 plan details — the pay screen and its total label", async ({ page }) => {
    await clearServiceabilityMemory(page);
    await stubServiceability(page);
    await stubTrialMoneyPath(page);
    await page.goto("/checkout?plan=trial_3day&track=veg");
    await passServiceabilityGate(page);
    await expect(page.getByRole("textbox", { name: "Who's eating" })).toBeVisible();
    await completePlanDetails(page);

    // The shot comes BEFORE the assertion on purpose: a flipbook frame that
    // only exists when the screen is already correct is not evidence. This
    // frame must be on disk precisely while the defect stands.
    await evidenceShot(page, "trial-F06-plan-details");

    // F-2 EVIDENCE. The trial is cycle:"one_off", flat ₹399 — the label over
    // its total is the claim under attack. This assertion is written to FAIL
    // while the defect stands, so the frame cannot be filed as "captured, fine".
    // When F-2 is fixed (PlanDetails cycleLabel prop), this passes unchanged.
    await expect(
      page.getByText(/billed each cycle/i).first(),
      "F-2: the one-off ₹399 trial must not label its total as a recurring charge",
    ).toHaveCount(0);

    // …and says the true thing in its place. Absence alone would still pass if
    // the label were deleted outright, which would be its own defect: an
    // unlabelled amount on a pay screen.
    await expect(page.getByText(/one-time charge/i).first()).toBeVisible();
  });

  frame("F07 Law 2 — the sheet takes over with our summary still on screen", async ({ page }) => {
    await clearServiceabilityMemory(page);
    await stubServiceability(page);
    await stubTrialMoneyPath(page);
    await page.route("**/api/payments/razorpay/verify", () => {
      /* held open — never resolves */
    });
    await page.goto("/checkout?plan=trial_3day&track=veg");
    await passServiceabilityGate(page);
    await completePlanDetails(page);
    await payAndAwaitSheet(page);
    // Our screen at hand-off: the amount must still be readable behind the sheet.
    await expect(page.getByText(/₹399/).first()).toBeVisible();
    await evidenceShot(page, "trial-F07-sheet-handoff");
  });

  frame("F08 payment processing — honest progress on captured money", async ({ page }) => {
    await clearServiceabilityMemory(page);
    await stubServiceability(page);
    await stubTrialMoneyPath(page);
    await page.route("**/api/payments/razorpay/verify", () => {
      /* held open — the verifying window IS the state under test */
    });
    await page.goto("/checkout?plan=trial_3day&track=veg");
    await passServiceabilityGate(page);
    await completePlanDetails(page);
    await payAndAwaitSheet(page);
    await page.evaluate(() => (window as never as { __rzpResolvePaid: () => void }).__rzpResolvePaid());

    // Law 9 / Law 10: money is captured. "Opening payment…" here would read as
    // a hung button on a charge the customer has already made.
    await expect(page.getByRole("button", { name: /confirming your payment/i })).toBeVisible();
    await evidenceShot(page, "trial-F08-payment-processing");
  });

  frame("F09 payment unresolved — never a re-payable CTA on captured money", async ({ page }) => {
    await clearServiceabilityMemory(page);
    await stubServiceability(page);
    await stubTrialMoneyPath(page);
    await page.route("**/api/payments/razorpay/verify", (route) =>
      route.fulfill(json({ error: "verify unavailable", code: "verify_unavailable" }, 503)),
    );
    await page.goto("/checkout?plan=trial_3day&track=veg");
    await passServiceabilityGate(page);
    await completePlanDetails(page);
    await payAndAwaitSheet(page);
    await page.evaluate(() => (window as never as { __rzpResolvePaid: () => void }).__rzpResolvePaid());

    await expect(page.getByRole("button", { name: /check payment status/i })).toBeVisible();
    // The defect this frame guards: a live "Continue to payment" here would
    // call createRazorpayOrder a second time on money already taken.
    await expect(page.getByRole("button", { name: /continue to payment/i })).toHaveCount(0);
    await evidenceShot(page, "trial-F09-payment-unresolved");
  });
});

// ---------------------------------------------------------------------------
// Frames 10-13 — the edge conditions named in the attack protocol.
// ---------------------------------------------------------------------------

test.describe("flipbook · trial · edges", () => {
  frame("F10 back pressed during the sheet — dismissal, not a charge", async ({ page }) => {
    await clearServiceabilityMemory(page);
    await stubServiceability(page);
    await stubTrialMoneyPath(page);
    await page.goto("/checkout?plan=trial_3day&track=veg");
    await passServiceabilityGate(page);
    await completePlanDetails(page);
    await payAndAwaitSheet(page);

    // What Android back / the sheet's own close both reduce to.
    await page.evaluate(() => (window as never as { __rzpDismiss: () => void }).__rzpDismiss());

    // Law 9: the screen must say they were NOT charged and name the way back in.
    await expect(page.getByText(/haven.t been charged|not been charged/i)).toBeVisible();
    await evidenceShot(page, "trial-F10-sheet-dismissed");
  });

  frame("F11 back from checkout to the offer — one step, state intact", async ({ page }) => {
    await clearServiceabilityMemory(page);
    await stubServiceability(page);
    await page.goto("/trial");
    await page.getByRole("button", { name: "Non-veg" }).click();
    await page.getByRole("button", { name: /start with 3 lunches/i }).click();
    await page.waitForURL(/plan=trial_3day&track=nonveg/);

    await page.goBack();

    // Law 3: back goes ONE step — to /trial, not out of the funnel entirely.
    await expect(page).toHaveURL(/\/trial/);
    await expect(page.getByRole("heading", { name: /try three lunches for ₹399/i })).toBeVisible();
    await evidenceShot(page, "trial-F11-back-to-offer");
  });

  frame("F12 slow 3G — the offer's loading state, not a blank screen", async ({ page }) => {
    // Law 10: what the customer looks at while the server-rendered offer
    // streams in. A blank or black frame here is the defect.
    await page.route("**/*", async (route) => {
      await new Promise((r) => setTimeout(r, 350));
      return route.continue();
    });
    await page.goto("/trial", { waitUntil: "commit" });
    await evidenceShot(page, "trial-F12-slow-3g-loading");
    await expect(page.getByRole("heading", { name: /try three lunches for ₹399/i })).toBeVisible({
      timeout: 30_000,
    });
    await evidenceShot(page, "trial-F12b-slow-3g-loaded");
  });

  frame("F13 two tabs — the second tab does not inherit a half-finished first", async ({ context }) => {
    const tabA = await context.newPage();
    await clearServiceabilityMemory(tabA);
    await stubServiceability(tabA);
    await tabA.goto("/checkout?plan=trial_3day&track=veg");
    await tabA.getByRole("textbox", { name: "PIN code" }).fill(SERVICEABLE_PIN);

    const tabB = await context.newPage();
    await stubServiceability(tabB);
    await tabB.goto("/checkout?plan=trial_3day&track=nonveg");

    // Whatever tab B shows must be a coherent state of its OWN track, never
    // tab A's half-typed PIN rendered as tab B's answer.
    await expect(tabB.locator("body")).toBeVisible();
    await evidenceShot(tabB, "trial-F13-second-tab");
    await tabA.close();
    await tabB.close();
  });
});
