import { test, expect } from "@playwright/test";

/**
 * SF-04 — the Account → Addresses surface. The CRUD itself needs a real session
 * (Firebase OTP), which can't be driven headlessly, so this verifies the
 * session GATE: a signed-out visit loads, 401s against /api/addresses, and
 * offers sign-in inline — never a dead end. Deployed-only (E2E_LIVE_CHECKOUT=1):
 * the local PR-gate build has no /api proxy, so it can't reach the 401 path.
 */
const deployedLive = process.env["E2E_LIVE_CHECKOUT"] === "1" ? test : test.skip;

deployedLive("addresses page loads and offers sign-in when signed out", async ({ page }) => {
  await page.goto("/account/addresses");
  await expect(page.getByRole("heading", { name: "Your addresses" })).toBeVisible();
  // 401 → the manager shows the sign-in prompt rather than an error or a blank.
  await expect(page.getByText(/sign in to view and manage your saved addresses/i)).toBeVisible();
});
