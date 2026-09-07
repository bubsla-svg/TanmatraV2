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

test("the Account tab is a link to /account — one tap, no sheet in between", async ({ page }) => {
  // This replaces "bar slides away while the account sheet is open" (deleted
  // 2026-09-07 with the sheet itself). That sheet opened an "Account &
  // Information" dialog whose contents were 10/12 Company + Legal links, so
  // the tab labelled Account delivered a menu that mostly was not about your
  // account, and /account — the tab's own declared href — took two taps.
  //
  // Those links now live on /account itself, outside AccountHub's auth gate,
  // and this bar is four links and nothing else.
  await page.goto("/menu");
  const nav = page.locator('nav[aria-label="Native Mobile Navigation"]');

  // A link, not a button: every other tab was one, and the button could not be
  // long-pressed or opened in a new tab while still claiming aria-current.
  const tab = nav.getByRole("link", { name: /^Account$/ });
  await expect(tab).toHaveAttribute("href", "/account");
  await tab.click();
  await page.waitForURL("**/account");

  // No dialog anywhere in the flow, and the bar never had to slide away for one.
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(nav).toHaveClass(/translate-y-0/);
  await expect(nav).toHaveJSProperty("inert", false);

  // The links the sheet used to carry are reachable, and reachable SIGNED OUT —
  // the visitor most likely to want a refund policy or a way to complain is the
  // one AccountHub returns <SignInOffer/> to.
  const help = page.getByRole("navigation", { name: "Help and policies" });
  await expect(help).toBeVisible();
  await expect(help.getByRole("link", { name: "Contact us" })).toBeVisible();
  await expect(help.getByRole("link", { name: "Legal & policies" })).toBeVisible();
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
