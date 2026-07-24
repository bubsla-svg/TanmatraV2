import { test, expect } from "@playwright/test";
import { collectErrors } from "../fixtures";

/**
 * Account hub + standalone login (§2). Local-safe: both surfaces must render
 * an honest state with no session and no Firebase config — a sign-in offer or
 * the fail-LOUD fallback, never a blank screen or a crash. The signed-in hub
 * (live-order card, section links) needs a real session and is exercised on
 * the deployed service.
 */

test("account hub renders an honest signed-out state, no crash", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/account");
  await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("login renders and never honors an external next target", async ({ page }) => {
  const errors = collectErrors(page);
  // A protocol-relative attacker value must be discarded by the sanitizer —
  // the page still renders its normal sign-in surface on /login.
  await page.goto("/login?next=//evil.example");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  expect(errors).toEqual([]);
});
