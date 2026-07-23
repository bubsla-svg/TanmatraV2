import { test, expect } from "@playwright/test";

/**
 * SF-09 — Account → Orders (order history). The list needs a real session
 * (Firebase OTP), so this verifies the session GATE: a signed-out visit loads,
 * 401s against /api/orders/mine, and offers sign-in inline — never a dead end.
 * Deployed-only (E2E_LIVE_CHECKOUT=1): the local PR-gate build has no /api
 * proxy, so it can't reach the 401 path.
 */
const deployedLive = process.env["E2E_LIVE_CHECKOUT"] === "1" ? test : test.skip;

deployedLive("orders page loads and offers sign-in when signed out", async ({ page }) => {
  await page.goto("/account/orders");
  await expect(page.getByRole("heading", { name: "Your orders" })).toBeVisible();
  await expect(page.getByText(/sign in to view your order history/i)).toBeVisible();
});
