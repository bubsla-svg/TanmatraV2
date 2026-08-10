import { test, expect, type Page } from "@playwright/test";
import { marker, evidenceShot } from "./support";

/**
 * Stitch runtime evidence — B2B & partner surfaces (manifest 12.1–12.3,
 * 12.5–12.7). Role/name-first assertion, THEN the data-screen-id/state marker,
 * THEN the evidence screenshot — per the wiring order.
 *
 * 12.6 and 12.7 share components/rd-partners/RdPartnersLanding.tsx, which
 * takes screenId as a prop: /partners/dietitians passes "12.6" and
 * /rd-partners passes "12.7" — each test also asserts the sibling id is
 * ABSENT so a copy-paste of the wrong screenId cannot pass silently.
 *
 * 12.1 is the only network-dependent surface here: CompanyInvite fetches the
 * invite client-side (GET /api/companies/invites/:token via apiGet), so it is
 * stubbed at the network edge with a valid-token payload byte-shaped like
 * lib/companyApi's CompanyMember/Company — the same pattern
 * cuj-corporate-lunch-planner.spec.ts uses for /api/companies/acme.
 */

const INVITE_TOKEN = "tnm-e2e-invite";

const VALID_INVITE = {
  invite: {
    id: 7,
    companyId: 1,
    userId: null,
    email: "priya@acme.test",
    role: "member",
    status: "invited",
    joinedAt: null,
  },
  company: { id: 1, slug: "acme", name: "Acme Foods", perEmployeeMonthlyBudgetPaise: 800000 },
};

async function stubInvite(page: Page): Promise<void> {
  await page.route(`**/api/companies/invites/${INVITE_TOKEN}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(VALID_INVITE),
    }),
  );
}

test.describe("stitch-runtime: partners & B2B (12.x)", () => {
  test("12.1 corporate invite activation is wired", async ({ page }) => {
    await stubInvite(page);
    await page.goto(`/corporate/invite/${INVITE_TOKEN}`);
    // The company name, role and email all come from the server payload.
    await expect(page.getByRole("heading", { name: "Acme Foods", level: 1 })).toBeVisible();
    await expect(page.getByText("priya@acme.test")).toBeVisible();
    // The activate action: enabled, never a dead button.
    const accept = page.getByRole("button", { name: "Accept invite" });
    await expect(accept).toBeVisible();
    await expect(accept).toBeEnabled();
    await expect(marker(page, "12.1", "default")).toBeVisible();
    await evidenceShot(page, "12.1");
  });

  test("12.2 corporate wellness lander is wired", async ({ page }) => {
    await page.goto("/corporate-wellness");
    await expect(
      page.getByRole("heading", { name: /lunch benefit that shows up in your/, level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Book a 20-min pilot call" }),
    ).toBeVisible();
    await expect(marker(page, "12.2", "default")).toBeVisible();
    await evidenceShot(page, "12.2");
  });

  test("12.3 gym partner lander is wired", async ({ page }) => {
    await page.goto("/partners/gyms");
    await expect(
      page.getByRole("heading", { name: /Training is half the result/, level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Apply for partnership" }),
    ).toBeVisible();
    await expect(marker(page, "12.3", "default")).toBeVisible();
    await evidenceShot(page, "12.3");
  });

  test("12.5 fitness club portal is wired", async ({ page }) => {
    await page.goto("/partners/fitness-clubs");
    await expect(
      page.getByRole("heading", { name: /Post-workout recovery/, level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Register your club" }),
    ).toBeVisible();
    await expect(marker(page, "12.5", "default")).toBeVisible();
    await evidenceShot(page, "12.5");
  });

  test("12.6 dietitian referral lander is wired", async ({ page }) => {
    await page.goto("/partners/dietitians");
    await expect(
      page.getByRole("heading", { name: /Prescribe real culinary medicine/, level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Apply for dietitian portal" }),
    ).toBeVisible();
    await expect(marker(page, "12.6", "default")).toBeVisible();
    await expect(marker(page, "12.7")).toHaveCount(0);
    await evidenceShot(page, "12.6");
  });

  test("12.7 rd partner network lander is wired", async ({ page }) => {
    await page.goto("/rd-partners");
    await expect(
      page.getByRole("heading", { name: /Prescribe real culinary medicine/, level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Apply for dietitian portal" }),
    ).toBeVisible();
    await expect(marker(page, "12.7", "default")).toBeVisible();
    await expect(marker(page, "12.6")).toHaveCount(0);
    await evidenceShot(page, "12.7");
  });
});
