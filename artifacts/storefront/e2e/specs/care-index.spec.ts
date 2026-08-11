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

test("the ruled hierarchy is present: goal rail, condition rail, and all four named entries", async ({ page }) => {
  await page.goto("/care");
  await expect(page.getByRole("heading", { name: "By goal", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "By condition", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Find my starting point" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Explore plans" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Try Tanmatra" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Clinical support" })).toBeVisible();
});

test("the assessment entry has no ?condition= param from the index (unlike the per-condition page)", async ({ page }) => {
  await page.goto("/care");
  await expect(page.getByRole("link", { name: "Find my starting point" })).toHaveAttribute("href", "/quick-setup");
});

test("rails are keyboard-operable — native links reachable and activatable by keyboard", async ({ page }) => {
  await page.goto("/care");
  const firstConditionCard = page.getByRole("link", { name: "PCOS" });
  await firstConditionCard.focus();
  await expect(firstConditionCard).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/care\/pcos$/);
});
