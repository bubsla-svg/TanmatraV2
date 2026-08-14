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

test("bar slides away while the account sheet is open, and does NOT inert itself", async ({ page }) => {
  await page.goto("/");
  // A raw attribute selector, not getByRole: the account sheet is a real
  // Radix/Vaul modal dialog (components/ui/drawer.tsx), and a modal dialog
  // correctly marks its background siblings aria-hidden="true" while open —
  // exactly the accessibility improvement this bar's own `inert` prop always
  // intended. getByRole("navigation", ...) legitimately stops matching once
  // that lands, since an aria-hidden element is excluded from the
  // accessibility tree by design; this test cares about the CSS/JS state of
  // the DOM node itself, which a role query is the wrong tool for here.
  const nav = page.locator('nav[aria-label="Native Mobile Navigation"]');
  await expect(nav).toHaveClass(/translate-y-0/);

  const trigger = page.getByRole("button", { name: /^Account$/ });
  await trigger.click();
  await expect(page.getByText("Account & Information")).toBeVisible();
  await expect(nav).toHaveClass(/translate-y-full/);

  // This assertion INVERTED, deliberately. The bar used to inert itself here
  // too, and the comment above already spotted why it should not: Radix marks
  // the background hidden, so our `inert` was redundant. It was also harmful,
  // because the Account trigger LIVES IN THIS BAR — inerting it inerted the
  // element that still held focus, which Chrome refuses outright:
  //
  //   Blocked aria-hidden on an element because its descendant retained
  //   focus. […] Ancestor with aria-hidden: <nav …>
  //
  // and which broke focus restore, asserted below. Sliding away is presentation
  // and stays; inertness while a dialog is open belongs to the dialog.
  await expect(nav).toHaveJSProperty("inert", false);

  // The reason it matters. Radix returns focus to the trigger on close; an
  // inert trigger cannot receive it, so this used to land on <body> and a
  // keyboard user lost their place in the tab bar entirely.
  await page.keyboard.press("Escape");
  await expect(page.getByText("Account & Information")).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("scroll-hide still inerts the bar — nothing else is managing it there", async ({ page }) => {
  await page.goto("/menu");
  const nav = page.locator('nav[aria-label="Native Mobile Navigation"]');
  await expect(nav).toHaveJSProperty("inert", false);

  // Unlike the dialog case there is no Radix here: the bar is simply gone from
  // the layout, so its links must leave the tab order or a keyboard user tabs
  // into a control that is translated off-screen.
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(300);
  await expect(nav).toHaveClass(/translate-y-full/);
  await expect(nav).toHaveJSProperty("inert", true);
});
