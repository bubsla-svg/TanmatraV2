/**
 * A shared "the page just resized itself" signal for every scroll-direction
 * consumer on the page.
 *
 * THE BUG THIS EXISTS TO FIX, concretely. `/menu`'s sticky control cluster
 * collapses on scroll-down, changing its layout height by ~84px. The browser
 * compensates with scroll anchoring — a synthetic scroll event of that same
 * magnitude, in the OPPOSITE direction of the gesture that triggered the
 * collapse. Any hook reading `window.scrollY` deltas to infer intent sees
 * that as an instant counter-gesture.
 *
 * `useCondensedOnScroll` already defended ITSELF against its own echo. But
 * the echo is a property of the DOCUMENT, not of one hook: `useScrollHide`
 * drives the mobile tab bar, the header and the cart pill off the same
 * scroll stream, and on `/menu` the cluster's collapse was flipping the tab
 * bar back to revealed mid-scroll. That is a real regression this caught —
 * nav-contract.spec.ts scrolls on `/menu` and asserts the bar hides.
 *
 * So the suppression window is published globally rather than kept private:
 * whoever resizes the page declares it, and every direction detector on the
 * page ignores the frames that resize produced. Module scope is the right
 * scope because the thing being described — "this document's scroll offset
 * is currently being corrected by the engine" — is genuinely per-document,
 * not per-component. Kept deliberately tiny: no subscriptions, no state, no
 * re-renders; consumers already run on scroll and just ask.
 */
let settlingUntil = 0;

/** Declare that a layout change just happened and its anchoring correction
 *  should not be read as user intent for the next `ms`. Extends an existing
 *  window rather than shortening it — overlapping resizes settle together. */
export function beginLayoutSettle(ms: number): void {
  const until = performance.now() + ms;
  if (until > settlingUntil) settlingUntil = until;
}

/** True while a declared layout change is still settling. Callers should
 *  advance their scroll baseline and return, so the frames spanning the
 *  correction never become a delta. */
export function isLayoutSettling(): boolean {
  return performance.now() < settlingUntil;
}
