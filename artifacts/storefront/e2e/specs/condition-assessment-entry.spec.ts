import { test, expect } from "@playwright/test";
import { collectErrors } from "../fixtures";

/**
 * D-21/D-23 (TNM-CRO-01 owner ruling 2026-08-11): every /care/[condition]
 * page must offer a visible, labeled assessment entry point — "Find my
 * starting point" -> /quick-setup?condition=<slug> — placed above "Explore
 * Matching Plans" (progressive disclosure: assessment before commerce). The
 * runbook's cited reference (audit's gate3b.mjs CTA inventory probe) doesn't
 * exist in this repository, so this is a from-scratch equivalent: it walks
 * the page's interactive elements and asserts the assessment link is present,
 * correctly targeted, and precedes the commerce CTA in document order —
 * rather than trusting visual position alone.
 */

test("PCOS displays with correct acronym casing — not CSS-capitalized 'Pcos'", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/care/pcos");
  // `exact: true` matters here — a case-insensitive substring match would
  // pass against the pre-fix "Pcos Protocol" just as happily.
  await expect(page.getByRole("heading", { name: "PCOS Protocol", level: 1, exact: true })).toBeVisible();
  await expect(page).toHaveTitle(/PCOS Therapeutic Care Plan/);
  expect(errors).toEqual([]);
});

test("the assessment entry CTA is labeled, targets the condition, and precedes commerce", async ({ page }) => {
  await page.goto("/care/pcos");

  const assessmentLink = page.getByRole("link", { name: "Find my starting point" });
  await expect(assessmentLink).toBeVisible();
  await expect(assessmentLink).toHaveAttribute("href", "/quick-setup?condition=pcos");

  const explorePlans = page.getByRole("button", { name: "Explore Matching Plans" });
  await expect(explorePlans).toBeVisible();

  // Progressive disclosure: assessment above commerce, in document order —
  // not just visually stacked, actually earlier in the DOM.
  const assessmentBox = await assessmentLink.boundingBox();
  const commerceBox = await explorePlans.boundingBox();
  expect(assessmentBox).not.toBeNull();
  expect(commerceBox).not.toBeNull();
  expect(assessmentBox!.y).toBeLessThan(commerceBox!.y);
});

test("the assessment entry survives on a condition slug with no known display mapping", async ({ page }) => {
  await page.goto("/care/some-unmapped-condition");
  const assessmentLink = page.getByRole("link", { name: "Find my starting point" });
  await expect(assessmentLink).toBeVisible();
  await expect(assessmentLink).toHaveAttribute("href", "/quick-setup?condition=some-unmapped-condition");
  // Fallback display name is still readable, never a raw/crashed slug — and
  // carries no "Protocol" framing, since this slug isn't a recognized
  // condition (DEF-RECON-CARECONDITION-001 — see the next test).
  await expect(page.getByRole("heading", { name: "Some Unmapped Condition", level: 1, exact: true })).toBeVisible();
});

/**
 * DEF-RECON-CARECONDITION-001 (reconciliation sweep, 2026-08-11): /care/[condition]
 * stays a free-text catch-all (no notFound(), no allowlist gate — a standing
 * product ruling), but an arbitrary slug must not render the same
 * clinical-sounding "Clinical Objectives" / condition-specific rotation copy a recognized condition gets. isCareConditionKnown()
 * (lib/careConditions.ts) decides which copy renders, not whether the route
 * resolves.
 */
test("an unmapped slug gets no clinical framing; a known condition still does", async ({ page }) => {
  await page.goto("/care/asdfqwerty");
  await expect(page.getByRole("heading", { name: "Clinical Objectives" })).toHaveCount(0);
  await expect(page.getByText("A menu rotation built around", { exact: false })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Explore Plans" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Browse Care Directory" })).toBeVisible();

  await page.goto("/care/pcos");
  await expect(page.getByRole("heading", { name: "Clinical Objectives" })).toBeVisible();
  await expect(page.getByText("A menu rotation built around", { exact: false })).toBeVisible();
});
