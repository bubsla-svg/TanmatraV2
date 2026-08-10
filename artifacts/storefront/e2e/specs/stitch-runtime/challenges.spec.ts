import { test, expect } from "@playwright/test";
import { marker, evidenceShot } from "./support";
// Server-fetched data (RSC → API_BASE_URL) cannot be page.route-stubbed; these
// entries verify only against the full local stack (run with E2E_FULL_STACK=1).
const fullStack = process.env["E2E_FULL_STACK"] === "1" ? test : test.skip;

/**
 * Stitch runtime evidence â community challenge surfaces (manifest 13.1â13.3).
 * Role/name-first assertion, THEN the data-screen-id/state marker, THEN the
 * evidence screenshot â per the wiring order.
 *
 * 13.1 and 13.2 are SERVER-rendered from the api-server (lib/challengesApi via
 * API_BASE_URL), so page.route cannot stub them â 13.2 is reached the way a
 * customer reaches it, by clicking a challenge card off the live seeded list
 * (the manifest trigger: link "Challenge card"). 13.3's tracker island is
 * session-gated; signed out it renders its honest sign-in offer, with the 13.3
 * marker on the page shell either way.
 */
test.describe("stitch-runtime: challenges (13.x)", () => {
  test("13.1 challenges discovery is wired", async ({ page }) => {
    await page.goto("/challenges");
    await expect(
      page.getByRole("heading", { name: "Challenges", level: 1 }),
    ).toBeVisible();
    await expect(marker(page, "13.1", "default")).toBeVisible();
    await evidenceShot(page, "13.1");
  });

  fullStack("13.2 challenge detail is wired", async ({ page }) => {
    await page.goto("/challenges");
    await expect(
      page.getByRole("heading", { name: "Challenges", level: 1 }),
    ).toBeVisible();
    // Real trigger: the first challenge card link inside the 13.1 grid.
    // Scoped to the list marker so a nav link can never be picked up, and
    // slug-agnostic so a reseed does not break the spec.
    const firstCard = marker(page, "13.1")
      .locator('a[href^="/challenges/"]:not([href="/challenges/tracker"])')
      .first();
    await expect(firstCard).toBeVisible();
    await firstCard.click();
    await expect(page).toHaveURL(/\/challenges\/(?!tracker$)[^/]+$/);
    // The detail's own accessible anchors: back link + server-rendered title.
    await expect(page.getByRole("link", { name: /Challenges/ }).first()).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(marker(page, "13.2", "default")).toBeVisible();
    await evidenceShot(page, "13.2");
  });

  test("13.3 challenge tracker is wired", async ({ page }) => {
    await page.goto("/challenges/tracker");
    await expect(
      page.getByRole("heading", { name: "Dietary Challenge Tracker", level: 1 }),
    ).toBeVisible();
    // Session-gated island: signed out, the tracker offers sign-in inline â
    // never a blank or a fabricated streak.
    await expect(
      page.getByText(/Sign in to see your challenge streaks/),
    ).toBeVisible();
    await expect(marker(page, "13.3", "default")).toBeVisible();
    await evidenceShot(page, "13.3");
  });
});
