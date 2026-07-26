/**
 * SoftGate first-touch onboarding — the 15-second profiler is now a
 * load-bearing conversion surface (mounted on discovery routes for fresh
 * visitors; playbook Part 4 Stage A), so its contract is CI-guarded:
 *
 *  1. Fresh visitor on a discovery route sees the gate.
 *  2. Skip resolves it in one tap and it never re-shows.
 *  3. It NEVER mounts on money paths (checkout must stay uninterrupted).
 *
 * Deliberately no quietFirstTouch() here — these specs test the gate itself.
 */

import { test, expect } from "@playwright/test";
import { cartItem, seedCart } from "../fixtures";

const gate = (page: import("@playwright/test").Page) =>
  page.locator(".tnm-softgate");

test.describe("SoftGate first-touch gate", () => {
  test("shows for a fresh visitor on /menu and skips in one tap, then stays resolved", async ({
    page,
  }) => {
    await page.goto("/menu");
    await expect(gate(page)).toBeVisible();

    // One-tap escape hatch must exist and resolve the gate.
    await gate(page)
      .getByRole("button", { name: /browse first|skip/i })
      .click();
    await expect(gate(page)).toHaveCount(0);

    // Resolution is durable across navigations.
    await page.goto("/");
    await expect(gate(page)).toHaveCount(0);
  });

  test("never mounts on the checkout money path", async ({ page }) => {
    await seedCart(page, [cartItem({ quantity: 1 })]);
    await page.goto("/checkout");
    await expect(gate(page)).toHaveCount(0);
  });
});
