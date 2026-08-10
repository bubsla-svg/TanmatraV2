/**
 * Test-only synchronization seams for PlanDraft concurrency (A2.2H).
 *
 * WHY THIS EXISTS. `POST /plan-drafts/:id/claim` reads the draft, then takes
 * ownership under a compare-and-swap. The defect class that guard protects
 * against only appears when another write lands BETWEEN those two steps. There
 * is no way to force that interleaving from outside the process, and a
 * timing-based approximation (sleep, or racing two requests with
 * `Promise.all`) is a flaky test rather than a regression test — it passes or
 * fails on machine load, and it would have passed against the un-guarded code
 * most of the time.
 *
 * So the seam is explicit: a hook the test installs, awaited at the exact point
 * the race needs to open. It is a no-op (a single null check) when unset, which
 * is always, outside tests.
 *
 * WHAT THIS IS NOT. There is deliberately no HTTP endpoint, query parameter,
 * header or environment variable that can reach these hooks — they are settable
 * only by code that can already `import` this module, i.e. the server's own
 * test suite. Installing one in production throws.
 */

export type SyncHook = (() => Promise<void>) | null;

interface Hooks {
  /** Awaited inside POST /plan-drafts/:id/claim, after the draft has been read
   *  and authorized, immediately before the ownership transaction runs. */
  afterClaimRead: SyncHook;
}

const hooks: Hooks = { afterClaimRead: null };

function assertNotProduction(name: keyof Hooks): void {
  if (process.env["NODE_ENV"] === "production") {
    throw new Error(
      `refusing to install the ${name} test hook in production`,
    );
  }
}

export function setAfterClaimReadHook(fn: SyncHook): void {
  assertNotProduction("afterClaimRead");
  hooks.afterClaimRead = fn;
}

/** Clears every hook. Tests call this in their teardown so one test's seam
 *  can never leak into another's. */
export function clearPlanDraftTestHooks(): void {
  hooks.afterClaimRead = null;
}

/** Awaited by the claim route. A no-op unless a test installed a hook. */
export async function runAfterClaimRead(): Promise<void> {
  const fn = hooks.afterClaimRead;
  if (fn) await fn();
}
