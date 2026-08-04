import { type Page } from "@playwright/test";
import {
  BUTTON_SELECTOR,
  probeButton,
  probeLinks,
  routeSelfMutates,
  waitForHydration,
} from "./ghost-ui.probes";

/**
 * Ghost-UI probe — the enforcement mechanism for TNM-REALIGN-02 Pillar 1
 * ("Zero Ghost UI"): *no interactive element renders unless its handler,
 * state transition, and destination route exist and are wired.*
 *
 * The mandate asks for "an e2e assertion per screen that every visible CTA
 * produces a state change or route change." That is two different checks
 * wearing one name, and conflating them makes the expensive one run on
 * everything:
 *
 *   • A LINK's wiring is its href resolving to a real route. That is an HTTP
 *     question — answerable with one request per unique href, no clicking, no
 *     page reload. A link to a route with no `page.tsx` is a ghost.
 *   • A BUTTON's wiring is only observable by clicking it. That needs a fresh
 *     page load per button (state must not leak between probes) and a way to
 *     detect "something happened" that does not depend on knowing what the
 *     button was supposed to do.
 *
 * So links get the cheap exact check and buttons get the expensive behavioural
 * one. On the storefront's own funnel that is roughly a 5:1 split in the
 * links' favour, which is what keeps the sweep inside a PR-gate time budget.
 *
 * ── How "something happened" is detected, and why not a DOM diff ────────────
 * A before/after `innerHTML` hash needs a settle delay to compare against, and
 * a settle delay is a sleep — which this suite does not have anywhere today
 * (verified: zero `waitForTimeout` in the e2e tree) and should not gain here.
 * Instead a MutationObserver is installed before the click and
 * `waitForFunction` resolves the instant the first mutation lands. Timing out
 * is then a real signal ("nothing happened"), not an arbitrary wait.
 *
 * The failure mode that buys: a page that mutates on its own (carousel,
 * countdown, streaming skeleton) would report every button as wired. So each
 * route is control-sampled ONCE first — observer installed, nothing clicked,
 * same timeout — and a route that mutates unprompted has its buttons graded
 * `indeterminate` rather than silently passing. An honest "cannot tell" beats
 * a green that means nothing.
 */


export type CtaOutcome =
  | "navigated"
  | "mutated"
  | "dialog-opened"
  | "ghost"
  | "indeterminate";

export interface CtaResult {
  readonly kind: "button" | "link";
  readonly label: string;
  readonly outcome: CtaOutcome;
  readonly detail?: string;
}

export interface GhostUiReport {
  readonly route: string;
  readonly results: readonly CtaResult[];
  /** Elements deliberately not probed, each with the reason. Never silent. */
  readonly skipped: readonly string[];
  readonly ghosts: readonly CtaResult[];
}

/**
 * Sweep one route. `maxButtons` bounds the click-probe cost; anything beyond
 * it is REPORTED in `skipped`, never dropped quietly (AGENT_WORKING_AGREEMENT
 * §6 — a bounded check that reads as exhaustive is worse than no check).
 */
export async function sweepRoute(
  page: Page,
  route: string,
  maxButtons = 12,
): Promise<GhostUiReport> {
  const skipped: string[] = [];

  await page.goto(route, { waitUntil: "domcontentloaded" });
  await page.locator("body").waitFor({ state: "visible" });
  await waitForHydration(page);

  const linkResults = await probeLinks(page, skipped);
  const selfMutating = await routeSelfMutates(page);

  const total = await page.locator(BUTTON_SELECTOR).count();
  const probeCount = Math.min(total, maxButtons);
  if (total > maxButtons) {
    skipped.push(`${total - maxButtons} of ${total} buttons — over the ${maxButtons} per-route probe cap`);
  }

  const buttonResults: CtaResult[] = [];
  for (let i = 0; i < probeCount; i++) {
    buttonResults.push(await probeButton(page, route, i, selfMutating));
  }

  const results = [...linkResults, ...buttonResults];
  return {
    route,
    results,
    skipped,
    ghosts: results.filter((r) => r.outcome === "ghost"),
  };
}

/** Human-readable failure body — the spec prints this when ghosts are found. */
export function formatReport(report: GhostUiReport): string {
  const lines = [`${report.route} — ${report.ghosts.length} ghost CTA(s):`];
  for (const g of report.ghosts) lines.push(`  • [${g.kind}] "${g.label}" — ${g.detail ?? ""}`);
  if (report.skipped.length > 0) {
    lines.push("  not probed:");
    for (const s of report.skipped) lines.push(`    - ${s}`);
  }
  return lines.join("\n");
}
