import { test, expect } from "@playwright/test";
import { marker, evidenceShot } from "./support";
// Server-fetched data (RSC → API_BASE_URL) cannot be page.route-stubbed; these
// entries verify only against the full local stack (run with E2E_FULL_STACK=1).
const fullStack = process.env["E2E_FULL_STACK"] === "1" ? test : test.skip;
// RD services (the /rd directory, booking, and the clinical consult CTA) are
// off unless the build sets NEXT_PUBLIC_RD_SERVICES=1 — lib/flags.ts. Mirrored
// here rather than asserted one way, so the same specs prove BOTH postures:
// with the flag off the surfaces must be gone, not merely different.
const rdServices = process.env["NEXT_PUBLIC_RD_SERVICES"] === "1";

/**
 * Stitch runtime evidence â clinical & advisory surfaces (manifest 11.2â11.8).
 *
 * Every test follows the wiring order: a role/name-first assertion proves the
 * real accessible surface, THEN the data-screen-id/state marker pins the
 * manifest entry, THEN evidenceShot captures the deterministic screenshot.
 *
 * 11.2 and 11.3 share components/protocol/ProtocolView.tsx, which emits
 * 11.2 on /performance (which="performance") and 11.3 on /clinical
 * (which="clinical") â each test also asserts the sibling id is ABSENT so a
 * regression in the which-switch cannot pass silently.
 */
test.describe("stitch-runtime: clinical & advisory (11.x)", () => {
  test("11.2 performance protocol landing is wired", async ({ page }) => {
    await page.goto("/performance");
    await expect(
      page.getByRole("heading", { name: /Athletic nutrition for/, level: 1 }),
    ).toBeVisible();
    // Non-clinical protocol: the consult CTA resolves to the plans route.
    await expect(page.getByRole("link", { name: "Find your plan" }).first()).toBeVisible();
    await expect(marker(page, "11.2", "default")).toBeVisible();
    await expect(marker(page, "11.3")).toHaveCount(0);
    await evidenceShot(page, "11.2");
  });

  test("11.3 clinical protocol hub is wired", async ({ page }) => {
    await page.goto("/clinical");
    await expect(
      page.getByRole("heading", { name: /Therapeutic nutrition/, level: 1 }),
    ).toBeVisible();
    // Clinical-only consult CTA (PROTOCOL_CONFIG.clinical branch), which
    // falls back to the plan CTA while RD services are off.
    await expect(
      page.getByRole("link", { name: rdServices ? "Book a free consult" : "Find your plan" }).first(),
    ).toBeVisible();
    await expect(marker(page, "11.3", "default")).toBeVisible();
    await expect(marker(page, "11.2")).toHaveCount(0);
    await evidenceShot(page, "11.3");
  });

  test("11.4 condition care page is wired", async ({ page }) => {
    await page.goto("/care/diabetes");
    await expect(
      page.getByRole("heading", { name: /diabetes protocol/i, level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Explore Matching Plans" }),
    ).toBeVisible();
    await expect(marker(page, "11.4", "default")).toBeVisible();
    await evidenceShot(page, "11.4");
  });

  test("11.5 rd directory is wired, or gone", async ({ page }) => {
    const res = await page.goto("/rd");
    if (!rdServices) {
      // Not a redirect and not an empty state: the route must 404 outright, or
      // the site still offers a dietitian directory with no dietitian in it.
      expect(res?.status()).toBe(404);
      await expect(marker(page, "11.5")).toHaveCount(0);
      return;
    }
    await expect(
      page.getByRole("heading", { name: "Our dietitians", level: 1 }),
    ).toBeVisible();
    await expect(marker(page, "11.5", "default")).toBeVisible();
    await evidenceShot(page, "11.5");
  });

  fullStack("11.6 rd booking is wired", async ({ page }) => {
    test.skip(!rdServices, "RD booking is off (NEXT_PUBLIC_RD_SERVICES)");
    // Real trigger: the directory card's own "View profile" link. The roster is
    // server-rendered from the api-server's canonical (all-bookable) RD list,
    // so the first profile lands on the booking-active resting state.
    await page.goto("/rd");
    const firstCard = marker(page, "11.5").getByRole("link", { name: /View profile/ }).first();
    await expect(firstCard).toBeVisible();
    await firstCard.click();
    await expect(page).toHaveURL(/\/rd\/[^/]+$/);
    // Booking region, by accessible name: the session-kind chip and its label.
    await expect(page.getByRole("button", { name: /15-min intro/ })).toBeVisible();
    await expect(page.getByText("Book a consult")).toBeVisible();
    await expect(marker(page, "11.6", "booking-active")).toBeVisible();
    await evidenceShot(page, "11.6");
  });

  test("11.7 nutrition coach is wired", async ({ page }) => {
    await page.goto("/coach");
    await expect(
      page.getByRole("heading", { name: "Nutrition coach", level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByText(/General nutrition guidance, not medical advice/),
    ).toBeVisible();
    await expect(marker(page, "11.7", "default")).toBeVisible();
    await evidenceShot(page, "11.7");
  });

  test("11.8 community q&a forum is wired", async ({ page }) => {
    await page.goto("/qa");
    await expect(
      page.getByRole("heading", { name: "Community Nutrition Q&A Forum", level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Questions answered by the Tanmatra team" }),
    ).toBeVisible();
    await expect(marker(page, "11.8", "default")).toBeVisible();
    await evidenceShot(page, "11.8");
  });
});
