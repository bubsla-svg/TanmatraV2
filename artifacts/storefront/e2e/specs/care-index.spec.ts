import { test, expect } from "@playwright/test";
import { collectErrors } from "../fixtures";

/**
 * D-05B (TNM-CRO-01 owner ruling 2026-08-11): /care is a compact
 * consumer-commerce feed, not a medical directory — every card declares an
 * action. This spec is a from-scratch dead-control probe (the runbook's
 * cited reference, audit evidence scripts, doesn't exist in this
 * repository): every link on the page must have a real, non-empty href that
 * isn't "#" or javascript:, exactly one h1 exists, and the rails are
 * keyboard-operable (native <a> elements inside a scroll container — no
 * custom widget needing its own key handling).
 *
 * The by-condition half of the ruled hierarchy is behind
 * CARE_BY_CONDITION_ENABLED and OFF by default (consumer copy deck), so the
 * expectations below are the flag-off page: header, goal rail, and the two
 * commerce entries. The dead-control and single-h1 probes are unchanged —
 * they are properties of the page in either state.
 */

test("every card on /care navigates — zero dead controls", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/care");

  const links = page.locator("a");
  const count = await links.count();
  expect(count).toBeGreaterThan(0);

  for (let i = 0; i < count; i++) {
    const href = await links.nth(i).getAttribute("href");
    expect(href, `link #${i} has a dead/empty href`).toBeTruthy();
    expect(href).not.toBe("#");
    expect(href).not.toMatch(/^javascript:/i);
  }
  expect(errors).toEqual([]);
});

test("exactly one h1 on /care", async ({ page }) => {
  await page.goto("/care");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Care", level: 1 })).toBeVisible();
});

test("the flag-off hierarchy: goal rail and both commerce entries, no condition surface", async ({ page }) => {
  await page.goto("/care");
  await expect(page.getByRole("heading", { name: "By goal", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Explore plans" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Try Tanmatra" })).toBeVisible();
});

test("no condition name, assessment entry or clinical-support link is rendered while the flag is off", async ({ page }) => {
  await page.goto("/care");
  await expect(page.getByRole("heading", { name: "By condition", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Find my starting point" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Clinical support" })).toHaveCount(0);
  // The condition names themselves, not just the rail that framed them.
  const body = await page.locator("body").innerText();
  for (const name of ["PCOS", "Diabetes", "Prediabetes", "Hypertension", "Insulin Resistance", "GERD"]) {
    expect(body, `"${name}" is still rendered on /care`).not.toContain(name);
  }
});

test("rails are keyboard-operable — native links reachable and activatable by keyboard", async ({ page }) => {
  await page.goto("/care");
  const explorePlans = page.getByRole("link", { name: "Explore plans" });
  await explorePlans.focus();
  await expect(explorePlans).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/plans$/);
});
