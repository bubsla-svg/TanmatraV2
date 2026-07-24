import { test, expect, type Page } from "@playwright/test";
import { collectErrors } from "../fixtures";

/**
 * Corporate lunch planner (route-parity Wave E, admin). The admin-gated island —
 * capture the team diet profile → generate a constraint-aware weekly plan →
 * schedule it (the server fans out office_orders and enforces the per-employee
 * budget; there is NO money-path). The API is stubbed at the network edge, so the
 * full admin flow runs against the local prod build and intercepts identically on
 * the deployed service. Every surface must stay honest with no session and no
 * crash — the harness asserts an empty pageerror log throughout.
 */

const COMPANY = {
  company: { id: 1, slug: "acme", name: "Acme Foods", perEmployeeMonthlyBudgetPaise: 800000 },
  membership: { id: 1, companyId: 1, userId: "u7", email: "admin@acme.test", role: "admin", status: "active", joinedAt: null },
  members: [{ id: 1, companyId: 1, userId: "u7", email: "admin@acme.test", role: "admin", status: "active", joinedAt: null }],
};

const SAVED_PROFILE = {
  profile: {
    companyId: 1,
    constraints: { headcount: 10, vegPct: 0, vegCount: 0, veganCount: 0, glutenFreeCount: 0, jainCount: 0, halalCount: 0, allergens: [], cuisinePrefs: [], calorieFloor: null, calorieCeiling: null, notes: "" },
    lastSurveyAt: null, updatedAt: "2026-07-24T00:00:00Z",
  },
};

const planProposal = (status: string, scheduledOfficeOrderIds: number[]) => ({
  proposal: {
    id: 55, companyId: 1, weekStartDate: "2026-07-27", status, scheduledOfficeOrderIds,
    plan: {
      weekStartDate: "2026-07-27", summary: "A balanced, veg-forward week.", modelId: "gemini-1", generatedBy: "ai",
      days: [
        { date: "2026-07-27", picks: [{ menuItemId: 1, slug: "quinoa-khichdi", name: "Quinoa Khichdi", why: "High-fibre, veg-friendly." }], warnings: [] },
        { date: "2026-07-28", picks: [{ menuItemId: 2, slug: "dal-tadka", name: "Dal Tadka", why: "Plant protein." }], warnings: ["Halal count unmet for 2 members."] },
      ],
    },
  },
});

const json = (body: unknown, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });

async function stubGetCompany(page: Page, payload: unknown, status = 200): Promise<void> {
  await page.route("**/api/companies/acme", (route) => route.fulfill(json(payload, status)));
}

test("no session → the planner offers sign-in, never a blank crash", async ({ page }) => {
  const errors = collectErrors(page);
  await stubGetCompany(page, { error: "unauthenticated", code: "unauthenticated" }, 401);
  await page.goto("/corporate/acme/lunch-planner");
  await expect(page.getByText("Sign in to manage your team")).toBeVisible();
  expect(errors).toEqual([]);
});

test("a non-admin member sees an admins-only notice, not the planner", async ({ page }) => {
  const errors = collectErrors(page);
  await stubGetCompany(page, { ...COMPANY, membership: { ...COMPANY.membership, role: "member" } });
  await page.goto("/corporate/acme/lunch-planner");
  await expect(page.getByText("available to company admins only")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Lunch planner" })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("an admin saves the profile, generates a plan, and schedules the week", async ({ page }) => {
  const errors = collectErrors(page);
  await page.route("**/api/companies/acme/diet-profile", (route) =>
    route.fulfill(route.request().method() === "PUT" ? json(SAVED_PROFILE) : json({ profile: null })));
  await page.route("**/api/companies/acme/lunch-plan/current", (route) => route.fulfill(json({ proposal: null })));
  await page.route("**/api/companies/acme/lunch-plan/generate", (route) => route.fulfill(json(planProposal("draft", []))));
  await page.route("**/api/lunch-plans/55/schedule", (route) => route.fulfill(json(planProposal("scheduled", [101, 102]))));
  await stubGetCompany(page, COMPANY);

  await page.goto("/corporate/acme/lunch-planner");
  await expect(page.getByRole("heading", { name: "Lunch planner" })).toBeVisible();

  // 1 · Save the team diet profile → Generate unlocks.
  await page.getByRole("button", { name: "Save team profile" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  // 2 · Generate the weekly plan → preview with picks, "why", warnings, provenance.
  await page.getByRole("button", { name: "Generate plan" }).click();
  await expect(page.getByText("Quinoa Khichdi")).toBeVisible();
  await expect(page.getByText("AI-generated")).toBeVisible();
  await expect(page.getByText("Halal count unmet for 2 members.")).toBeVisible();

  // 3 · Schedule → office lunches created, no charge.
  await page.getByRole("button", { name: "Schedule this week" }).click();
  await expect(page.getByText(/2 office lunches created/)).toBeVisible();

  expect(errors).toEqual([]);
});
