import { test, expect } from "@playwright/test";
import { sweepRoute, formatReport } from "../support/ghost-ui";
import { FUNNEL_ROUTES } from "../support/routes";

/**
 * TNM-REALIGN-02 Pillar 1 — "Zero Ghost UI", as a failing test rather than a
 * design note. The mandate's own words: *a dead CTA is a failing test.*
 *
 * One test per funnel route so a failure names the surface directly instead of
 * one composite red that says "the funnel is broken somewhere". Each route is
 * independent — no shared state, no ordering dependency — so they parallelise
 * and a single flake does not cascade.
 *
 * Runtime note for whoever widens `FUNNEL_ROUTES`: the button half costs one
 * page load PER BUTTON (isolation is the point — a cart with an item in it
 * changes what the next button does). Six routes at the 12-button cap is a
 * ~72-navigation ceiling. Budget accordingly; see `support/routes.ts`.
 */

test.describe("ghost UI — every visible CTA is wired", () => {
  for (const route of FUNNEL_ROUTES) {
    test(`${route} has no dead CTAs`, async ({ page }) => {
      const report = await sweepRoute(page, route);

      // A route where nothing was probed is a silent pass, which is the exact
      // failure mode this harness exists to prevent. If the page rendered
      // nothing interactive, that is itself the finding.
      expect(
        report.results.length,
        `${route} exposed no interactive elements at all — either the route is ` +
          `empty or it failed to render. Neither is a pass.`,
      ).toBeGreaterThan(0);

      expect(report.ghosts, formatReport(report)).toEqual([]);
    });
  }
});
