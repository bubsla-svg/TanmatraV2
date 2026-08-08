import { test, expect } from "@playwright/test";

/**
 * Exactly-one-chrome guard. `/` once rendered two logos, two <header>s and two
 * <footer>s stacked, because the homepage shipped its own nav/bottom-bar/footer
 * while the root layout also wrapped every route in the global set — it shipped
 * in #433 precisely because nothing asserted a count. The counts below are that
 * assertion.
 *
 * Since the route-group restructure there are THREE shells, each owed a
 * different count: app/(global)/ renders the full consumer chrome (one
 * header, one footer, one nav cluster), app/(focus)/ renders none (the flow
 * owns its whole canvas), and app/(b2b)/ renders exactly one compact
 * business header and nothing else. One route per shell is asserted below so
 * a chrome regression in any shell — duplication OR the B2B header silently
 * vanishing again (the pre-restructure defect: B2B routes had chrome
 * subtracted with nothing replacing it) — fails loudly.
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

  test("b2b shell: exactly one business header, no consumer chrome", async ({ page }) => {
    await page.goto("/corporate");
    // The compact B2B header (app/(b2b)/layout.tsx) — and only it.
    await expect(page.locator("header")).toHaveCount(1);
    await expect(page.getByRole("navigation", { name: "Business" })).toHaveCount(1);
    // None of the consumer chrome leaks in.
    await expect(page.locator("footer")).toHaveCount(0);
    await expect(
      page.getByRole("navigation", { name: "Native Mobile Navigation" }),
    ).toHaveCount(0);
  });

  test("focus shell: no chrome at all", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("header")).toHaveCount(0);
    await expect(page.locator("footer")).toHaveCount(0);
    await expect(
      page.getByRole("navigation", { name: "Native Mobile Navigation" }),
    ).toHaveCount(0);
  });
});
