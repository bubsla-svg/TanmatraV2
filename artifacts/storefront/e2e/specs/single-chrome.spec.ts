import { test, expect } from "@playwright/test";

/**
 * Exactly-one-chrome guard. `/` once rendered two logos, two <header>s and two
 * <footer>s stacked, because the homepage shipped its own nav/bottom-bar/footer
 * while the root layout also wrapped every route in the global set — it shipped
 * in #433 precisely because nothing asserted a count. The counts below are that
 * assertion, and they hold however the duplication is avoided: the homepage no
 * longer carries its own chrome, so the layout's global chrome is now the only
 * chrome on every route.
 *
 * The app-links check is viewport-aware on purpose. The cluster is rendered
 * twice by design — the Header's link row is desktop-only (`hidden md:flex`)
 * and MobileBottomNav (`md:hidden`) replaces it below that breakpoint — so
 * asserting the "Account" link alone can only ever pass on one project, and it
 * failed every [mobile] run. Requiring exactly one VISIBLE cluster is the
 * stronger statement anyway: it catches both no navigation at all and both
 * clusters showing at once.
 */
async function expectOneVisibleAppNav(page: import("@playwright/test").Page) {
  const desktopLinks = page.getByRole("link", { name: "Account" });
  const mobileNav = page.getByRole("navigation", { name: "Native Mobile Navigation" });
  await expect(desktopLinks.or(mobileNav).first()).toBeVisible();
  const visible =
    (await desktopLinks.first().isVisible().catch(() => false) ? 1 : 0) +
    (await mobileNav.first().isVisible().catch(() => false) ? 1 : 0);
  expect(visible, "exactly one app-links cluster should be visible for this viewport").toBe(1);
}

test.describe("chrome is rendered exactly once per route", () => {
  test("homepage: one header, one footer, no global-nav duplicates", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("header")).toHaveCount(1);
    await expect(page.locator("footer")).toHaveCount(1);
    await expectOneVisibleAppNav(page);
  });

  test("menu keeps the global chrome", async ({ page }) => {
    await page.goto("/menu");
    await expect(page.locator("header")).toHaveCount(1);
    await expect(page.locator("footer")).toHaveCount(1);
    await expectOneVisibleAppNav(page);
  });
});
