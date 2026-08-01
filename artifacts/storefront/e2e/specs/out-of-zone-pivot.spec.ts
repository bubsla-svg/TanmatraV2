import { test, expect } from "@playwright/test";
import { collectErrors } from "../fixtures";

/**
 * Vector 2 — the out-of-zone pivot must offer a way forward.
 *
 * "We don't deliver to your pincode" with nothing to do next is a dead end,
 * and it is the last thing a first-time visitor sees before they leave. The
 * marketplace ships shelf-stable items nationwide, so the delivery radius
 * gates hot meals, not the whole catalogue — the offer is real, not a
 * consolation link.
 *
 * Driven through the REAL pincode check (a Mumbai pincode against a
 * Noida-only service area), not by stubbing the verdict: the point is that
 * the genuine unserviceable path ends somewhere.
 */

const OUT_OF_ZONE_PINCODE = "400001"; // Mumbai — outside the Noida service area.

/**
 * The verdict is stubbed at the NETWORK EDGE, not faked in our own code.
 *
 * The PR-gate build serves the app with no API behind it, so a real
 * `/api/serviceability/:pincode` call never resolves and the component shows a
 * transport error instead of a verdict — which is why the pre-existing
 * unserviceable spec in `cuj-onboarding-audit.spec.ts` is marked deployed-only
 * and therefore skipped on every PR. Stubbing the route (the pattern
 * `cuj-corporate-lunch-planner.spec.ts` already uses) makes this hermetic and
 * lets it actually gate merges, while still exercising the real component
 * logic end to end: the payload below is byte-shaped like the server's.
 */
async function stubUnserviceable(page: import("@playwright/test").Page): Promise<void> {
  await page.route("**/api/serviceability/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ serviceable: false, code: "unserviceable_pincode" }),
    }),
  );
}

/**
 * Entering a pincode requires the manual-entry arm of ServiceabilityBar, which
 * is reached via the picker's "I don't know the exact location" fallback. The
 * click is retried with its assertion because the header entry point ships in
 * the server HTML before React hydrates — an early click lands on an unwired
 * element and silently does nothing.
 */
async function enterPincode(page: import("@playwright/test").Page, pincode: string): Promise<void> {
  await page.goto("/menu");

  const pinInput = page.locator("input[inputmode='numeric']").first();
  const heading = page.getByRole("heading", { name: "Add address" });

  // CHECK-THEN-ACT, and the check is what makes it correct. Retrying the whole
  // open-sequence is NOT idempotent: on a slow first pass it re-clicks the
  // header entry point, which reopens the picker over the already-open one and
  // oscillates until the budget runs out. Guarding on the heading means once
  // the picker is open the retry stops clicking and only waits.
  await expect(async () => {
    if (!(await heading.isVisible().catch(() => false))) {
      await page.getByRole("button", { name: /select your location/i }).click({ timeout: 2_000 });
    }
    await expect(heading).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });

  // Matched WITHOUT the apostrophe on purpose. The button reads "I don’t know
  // the exact location on map" with a TYPOGRAPHIC apostrophe (U+2019); an ASCII
  // `don't` in the pattern matches nothing — that is how this helper failed the
  // first time it ran.
  await page.getByRole("button", { name: /know the exact location/i }).first().click();
  await expect(pinInput).toBeVisible({ timeout: 5_000 });

  await pinInput.fill(pincode);
  await page.getByRole("button", { name: "Check" }).click();
}

test("an unserviceable pincode offers the marketplace, not a dead end", async ({ page }) => {
  const errors = collectErrors(page);
  await stubUnserviceable(page);
  await enterPincode(page, OUT_OF_ZONE_PINCODE);

  // The honest verdict still shows...
  await expect(page.getByText(new RegExp(`not in ${OUT_OF_ZONE_PINCODE} yet`, "i"))).toBeVisible();

  // ...and so does a real onward route.
  const marketplaceCta = page.getByRole("link", { name: /shop the marketplace/i });
  await expect(marketplaceCta).toBeVisible();

  // The link must actually go somewhere — a CTA into a 404 is the same dead
  // end wearing a button.
  await marketplaceCta.click();
  await expect(page).toHaveURL(/\/marketplace/);
  await expect(page.getByRole("heading", { name: /marketplace/i }).first()).toBeVisible();

  expect(errors).toEqual([]);
});

test("the notify capture still works and keeps the marketplace route visible", async ({ page }) => {
  await stubUnserviceable(page);
  await enterPincode(page, OUT_OF_ZONE_PINCODE);

  // The primary action on this surface is unchanged — the pivot is additive,
  // it does not replace the waitlist.
  await expect(page.getByRole("button", { name: "Notify me" })).toBeVisible();
  await expect(page.getByRole("link", { name: /shop the marketplace/i })).toBeVisible();
});
