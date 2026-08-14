import { test, expect } from "@playwright/test";
import { collectErrors } from "../../fixtures";
import { marker, evidenceShot } from "./support";

/**
 * Stitch-runtime evidence — §6 plan discovery (manifest 6.1, 6.8).
 *
 * Both entries are plain route navigations (trigger.type "route-navigation" in
 * docs/stitch/stitch-screen-manifest.json), server-rendered on every build —
 * no flags, no session, no stubs. Per the wiring instructions each test
 * asserts role/name first (the screen's real heading + primary action), then
 * the production diagnostic marker (data-screen-id/-state), and captures the
 * evidence screenshot last so tools/record-stitch-evidence.mjs can bind it to
 * the tested SHA.
 */

test.describe("stitch-runtime · plan discovery", () => {
  test("6.1 plans discovery default is wired", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("/plans");
    // GoalRouter leads the page (manifest implementationComponent); the
    // primary action is picking a goal — desk_fuel's promise is a stable
    // routerPlans() entry (lib/plans.ts).
    //
    // Asserted as a LINK, and by substring. The answer used to be a <button>
    // that called router.push; it is now a real <a href="/plan/desk_fuel">
    // (GoalCard, shared with /care), so middle-click and open-in-new-tab work
    // and the destination is visible on hover. The manifest's contract for
    // this screen is `expectedPrimaryAction: "Pick your goal"` — the action,
    // not the element type — so pinning `button` was pinning the old
    // implementation. Substring because the card's accessible name now also
    // carries the plan name subtitle it routes to.
    await expect(page.getByRole("heading", { name: /what.s lunch for\?/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Get me through the workday/ })).toBeVisible();
    await expect(marker(page, "6.1", "default")).toBeVisible();
    expect(errors).toEqual([]);
    await evidenceShot(page, "6.1");
  });

  test("6.8 trial offer default is wired", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("/trial");
    // Hero h1 + the sticky primary CTA — same accessible names cuj-04 pins.
    await expect(page.getByRole("heading", { name: /try 3 lunches for/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /start the taste test/i })).toBeVisible();
    await expect(marker(page, "6.8", "default")).toBeVisible();
    expect(errors).toEqual([]);
    await evidenceShot(page, "6.8");
  });
});
