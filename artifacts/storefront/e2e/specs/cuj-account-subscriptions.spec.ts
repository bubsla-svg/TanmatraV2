import { test, expect } from "@playwright/test";

/**
 * SF-08 — Account → Plans (subscription management). The lifecycle actions need
 * a real session (Firebase OTP), so this verifies the session GATE: a signed-out
 * visit loads, 401s against /api/subscriptions, and offers sign-in inline —
 * never a dead end. Deployed-only (E2E_LIVE_CHECKOUT=1): the local PR-gate build
 * has no /api proxy, so it can't reach the 401 path.
 */
const deployedLive = process.env["E2E_LIVE_CHECKOUT"] === "1" ? test : test.skip;

deployedLive("plans page loads and offers sign-in when signed out", async ({ page }) => {
  await page.goto("/account/subscriptions");
  await expect(page.getByRole("heading", { name: "Your plans" })).toBeVisible();
  await expect(page.getByText(/sign in to view and manage your plans/i)).toBeVisible();
});
