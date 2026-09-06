import { test, expect } from "@playwright/test";
import { collectErrors } from "../fixtures";

/**
 * D-04B quick-setup contract (TNM-CRO-01 owner ruling 2026-08-11):
 * `/quick-setup` is the approved canonical assessment only if it (1) is
 * exactly three one-question, tap-first viewports, (2) preserves answers on
 * back/refresh, and (3) routes deterministically to /trial or
 * /plan/[planId] on completion — never to an in-page results screen. This
 * spec proves the contract's business logic; stitch-runtime/quick-setup.spec.ts
 * covers the same three stages as visual/wiring evidence.
 *
 * PR-gate runnable — no network mocking needed, the wizard's only network
 * call (preferences save) is fire-and-forget and never gates navigation.
 */

test("exactly three tap-first viewports, one question each — no typing anywhere in the flow", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/quick-setup");

  await expect(page.getByText(/step 1 of 3/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: /what.s your goal/i })).toBeVisible();
  await page.getByRole("radio", { name: /fat loss & metabolic reset/i }).click();
  await page.getByRole("button", { name: /continue/i }).click();

  await expect(page.getByText(/step 2 of 3/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: /what do you eat/i })).toBeVisible();
  await page.getByRole("radio", { name: /omnivore/i }).click();
  await page.getByRole("button", { name: /continue/i }).click();

  await expect(page.getByText(/step 3 of 3/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: /must leave out/i })).toBeVisible();
  await page.getByRole("checkbox", { name: /dairy/i }).click();

  // No fourth viewport — "See my plan" is the step-3 primary action, and it
  // is a deterministic exit, not a results screen.
  await expect(page.getByRole("button", { name: /see my plan/i })).toBeVisible();
  expect(errors).toEqual([]);
});

test("back preserves the prior answer; refresh preserves the in-progress draft", async ({ page }) => {
  await page.goto("/quick-setup");
  await page.getByRole("radio", { name: /lean muscle hypertrophy/i }).click();
  await page.getByRole("button", { name: /continue/i }).click();

  await page.getByRole("radio", { name: /strictly vegetarian/i }).click();

  // Refresh mid-wizard: the draft survives (sessionStorage), step 2 stays
  // current with the vegetarian pick intact.
  await page.reload();
  await expect(page.getByText(/step 2 of 3/i)).toBeVisible();
  await expect(page.getByRole("radio", { name: /strictly vegetarian/i })).toHaveClass(/border-gold/);

  // Back to step 1: the muscle-gain goal picked before is still selected.
  // Scoped to the wizard: the route now carries a FocusHeader whose own
  // "Back" is the exit from /quick-setup, while THIS click means the
  // wizard's step-back. Both are correct and both are buttons named
  // "Back", so the selector has to say which one it means.
  await page.locator("section").getByRole("button", { name: "Back" }).click();
  await expect(page.getByText(/step 1 of 3/i)).toBeVisible();
  await expect(page.getByRole("radio", { name: /lean muscle hypertrophy/i })).toHaveClass(/border-gold/);
});

test("?condition=pcos exits to the mapped plan with condition/goal/acquisitionContextId intact", async ({ page }) => {
  await page.goto("/quick-setup?condition=pcos");
  await page.getByRole("radio", { name: /holistic longevity care/i }).click();
  await page.getByRole("button", { name: /continue/i }).click();
  await page.getByRole("radio", { name: /omnivore/i }).click();
  await page.getByRole("button", { name: /continue/i }).click();
  await page.getByRole("button", { name: /see my plan/i }).click();

  // pcos → steady (lib/subscription-rules planForCondition).
  await expect(page).toHaveURL(/\/plan\/steady\?/);
  const url = new URL(page.url());
  expect(url.searchParams.get("condition")).toBe("pcos");
  expect(url.searchParams.get("goal")).toBe("maintain");
  expect(url.searchParams.get("acquisitionContextId")).toBeTruthy();
});

test("no condition exits to /trial with goal/acquisitionContextId intact", async ({ page }) => {
  await page.goto("/quick-setup");
  await page.getByRole("radio", { name: /fat loss & metabolic reset/i }).click();
  await page.getByRole("button", { name: /continue/i }).click();
  await page.getByRole("radio", { name: /omnivore/i }).click();
  await page.getByRole("button", { name: /continue/i }).click();
  await page.getByRole("button", { name: /see my plan/i }).click();

  await expect(page).toHaveURL(/\/trial\?/);
  const url = new URL(page.url());
  expect(url.searchParams.has("condition")).toBe(false);
  expect(url.searchParams.get("goal")).toBe("lose_weight");
  expect(url.searchParams.get("acquisitionContextId")).toBeTruthy();
});

test("an unmapped condition still exits to /trial — never a dead end", async ({ page }) => {
  await page.goto("/quick-setup?condition=some-unmapped-condition");
  await page.getByRole("radio", { name: /fat loss & metabolic reset/i }).click();
  await page.getByRole("button", { name: /continue/i }).click();
  await page.getByRole("radio", { name: /omnivore/i }).click();
  await page.getByRole("button", { name: /continue/i }).click();
  await page.getByRole("button", { name: /see my plan/i }).click();

  await expect(page).toHaveURL(/\/trial\?/);
  const url = new URL(page.url());
  expect(url.searchParams.get("condition")).toBe("some-unmapped-condition");
});

// Auth-interruption preservation (an in-flight OTP sign-in mid-flow keeps the
// draft and resumes at the same step) needs the C2 test-OTP hook to drive a
// real sign-in without live SMS. Wired for reachability now; the assertion
// itself lands once C2 merges (this wave's merge order: B1 before C2).
test.fixme(
  "an auth interruption mid-wizard preserves the draft and resumes at the same step",
  async ({ page }) => {
    // Intentionally left as a reachability stub until C2's test-OTP hook lands.
    void page;
  },
);
