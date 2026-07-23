import { test, expect } from "@playwright/test";
import { collectErrors } from "../fixtures";

/**
 * CUJ-06 — track + confirmed screens. Until SF-05 can create real orders in
 * the target environment, these specs pin the HONEST degradation contract
 * (§6): an unknown order or an unreachable api renders a truthful state —
 * never a crash as the only content, never an invented status. The happy
 * path extends this spec once a seeded order exists at the wave gate.
 */

const FAKE_ID = "e2e-nonexistent-order-000";

test("track page renders an honest state for an unknown order, no crash", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(`/track/${FAKE_ID}`);
  await expect(page.getByRole("heading", { name: "Tracking your order" })).toBeVisible();
  await expect(page.getByText(`#${FAKE_ID}`)).toBeVisible();
  // Either honest outcome is valid depending on whether the api is reachable
  // from the target (proxy dark in bare CI builds → "unreachable"; live api →
  // real 404 → "can't find"). Both are truthful; a fabricated status is not.
  await expect(
    page
      .getByText(/can.t find that order/i)
      .or(page.getByText(/tracking is unreachable/i)),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("confirmed page renders an honest state for an unknown order with a way out", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(`/order/confirmed/${FAKE_ID}`);
  await expect(
    page
      .getByRole("heading", { name: /can.t find that order/i })
      .or(page.getByRole("heading", { name: /can.t reach the kitchen/i })),
  ).toBeVisible();
  // Never a dead end (§6): the way back to the menu is always present.
  await expect(page.getByRole("link", { name: "Back to the menu" })).toBeVisible();
  expect(errors).toEqual([]);
});
