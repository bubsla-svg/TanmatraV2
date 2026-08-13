import { test, expect } from "@playwright/test";
import { collectErrors } from "../fixtures";

/**
 * D-17 mobile nav contract (TNM-CRO-01 owner ruling 2026-08-11): Plan ->
 * Care, active matching /care, /care/*, /clinical — never /plans — plus the
 * mandated scroll hide-on-down/reveal-on-up and hidden-while-overlay-open
 * behavior. The runbook's cited reference (audit evidence script) doesn't
 * exist in this repository, so this is a from-scratch equivalent.
 */

test("exactly four tabs, each a real ≥44px target", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Native Mobile Navigation" });
  const items = nav.locator("a, button").filter({ hasText: /Home|Menu|Care|Account/ });
  await expect(items).toHaveCount(4);

  for (const label of ["Home", "Menu", "Care", "Account"]) {
    const target = nav.getByText(label, { exact: true }).locator("..");
    const box = await target.boundingBox();
    expect(box, `${label} tab has no bounding box`).not.toBeNull();
    expect(box!.height, `${label} tab is shorter than 44px`).toBeGreaterThanOrEqual(44);
  }
  expect(errors).toEqual([]);
});

test("active-state matrix: /care and /clinical mark Care active, /plans does not", async ({ page }) => {
  const careTab = () => page.getByRole("link", { name: /^Care$/ });

  await page.goto("/care");
  await expect(careTab()).toHaveAttribute("aria-current", "page");

  await page.goto("/clinical");
  await expect(careTab()).toHaveAttribute("aria-current", "page");

  await page.goto("/plans");
  await expect(careTab()).not.toHaveAttribute("aria-current", "page");
});

test("Care tab links to /care, not /plans", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /^Care$/ })).toHaveAttribute("href", "/care");
});

test("bar hides on scroll-down past the hysteresis threshold and reveals on scroll-up", async ({ page }) => {
  await page.goto("/menu");
  const nav = page.getByRole("navigation", { name: "Native Mobile Navigation" });
  await expect(nav).toBeVisible();

  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(300);
  await expect(nav).toHaveClass(/translate-y-full/);

  await page.mouse.wheel(0, -600);
  await page.waitForTimeout(300);
  await expect(nav).toHaveClass(/translate-y-0/);
});

test("bar stays revealed at the very top of the page regardless of small jitter", async ({ page }) => {
  await page.goto("/menu");
  const nav = page.getByRole("navigation", { name: "Native Mobile Navigation" });
  await page.mouse.wheel(0, 5); // under the hysteresis threshold
  await page.waitForTimeout(200);
  await expect(nav).toHaveClass(/translate-y-0/);
});

test("bar is hidden and inert while the account sheet is open", async ({ page }) => {
  await page.goto("/");
  // A raw attribute selector, not getByRole: the account sheet is now a real
  // Radix/Vaul modal dialog (components/ui/drawer.tsx), and a modal dialog
  // correctly marks its background siblings aria-hidden="true" while open —
  // exactly the accessibility improvement this bar's own `inert` prop always
  // intended. getByRole("navigation", ...) legitimately stops matching once
  // that lands, since an aria-hidden element is excluded from the
  // accessibility tree by design; this test cares about the CSS/JS state of
  // the DOM node itself, which a role query is the wrong tool for here.
  const nav = page.locator('nav[aria-label="Native Mobile Navigation"]');
  await expect(nav).toHaveClass(/translate-y-0/);

  await page.getByRole("button", { name: /^Account$/ }).click();
  await expect(page.getByText("Account & Information")).toBeVisible();
  await expect(nav).toHaveClass(/translate-y-full/);
  await expect(nav).toHaveJSProperty("inert", true);
});
