/**
 * ERP-shell contract — what the legacy app IS after the ops-ERP conversion.
 *
 * The consumer surface (menu/cart/checkout/orders) was removed from this SPA;
 * tanmatra.food serves the Next.js storefront, and this service is an
 * internal-only container for the Admin ERP and the RD console. The four
 * consumer specs that used to live here are in specs-archive/ — they guarded
 * routes that no longer exist.
 *
 * What still deserves a CI drive, and why:
 *
 *   1. The auth gate is the whole security story of this app now. `/` and
 *      every /admin route must NEVER render ops content to an unauthenticated
 *      visitor — they show the login surface (or the auth-check state) instead.
 *   2. /admin/login must actually render its form, or nobody can get in and
 *      the "gate holds" assertions above would be vacuously true forever.
 *   3. An unknown route 404s instead of resurrecting some consumer page via a
 *      stale catch-all.
 *
 * Static-build drive, same as before: no backend, so we assert on the shell
 * the SPA renders unauthenticated — which is exactly the principal whose view
 * matters here.
 */
import { test, expect } from "@playwright/test";

test.describe("Ops-ERP shell", () => {
  test("/admin/login renders the login surface", async ({ page }) => {
    await page.goto("/admin/login");
    // The login page is the one public surface. An input must be reachable —
    // if this fails, the app is locked for everyone and the gate assertions
    // below prove nothing.
    await expect(page.locator("input").first()).toBeVisible({ timeout: 15_000 });
  });

  test("/ never shows ops content to an unauthenticated visitor", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // Root now mounts AdminIndex behind AdminAuthLayout. Without a session the
    // layout renders its auth-check/login state; the assertion is on the
    // ABSENCE of ops content, because that absence is the contract.
    const body = (await page.textContent("body")) ?? "";
    expect(body).not.toContain("Menu engineering");
    expect(body).not.toContain("Sales console");
    // And SOMETHING rendered — a blank page would also pass the absence
    // checks while meaning the app is simply broken.
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 15_000 });
  });

  test("a deep /admin route is gated the same way", async ({ page }) => {
    await page.goto("/admin/sales-console");
    await page.waitForLoadState("networkidle");
    const body = (await page.textContent("body")) ?? "";
    expect(body).not.toContain("Sales console accounts");
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 15_000 });
  });

  test("an unknown route 404s instead of serving a ghost page", async ({ page }) => {
    await page.goto("/checkout");
    await page.waitForLoadState("networkidle");
    // /checkout was a consumer route; the catch-all must own it now. Assert on
    // the not-found page's h1 rather than a status code — this is a statically
    // served SPA, so the HTTP status is always 200 and the ROUTER is the thing
    // under test.
    const body = ((await page.textContent("body")) ?? "").toLowerCase();
    expect(body).toMatch(/not found|404/);
  });
});
