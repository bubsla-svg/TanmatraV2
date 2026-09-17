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

/**
 * A second, sharper signal for the other kind of layout change: in-flow
 * content that mounts or unmounts ABOVE the reader's anchor, which the engine
 * compensates with one anchoring scroll of exactly that content's height.
 * A settle window would work here too, but it swallows every scroll for its
 * whole duration — including the reader's real gesture in the same instant,
 * which is precisely what happens when a first-visit banner mounts right
 * after hydration on a page the reader has already started scrolling.
 *
 * So the declaration carries the magnitude: a direction detector that sees
 * a delta matching it (either sign — mount pushes down, unmount pulls up)
 * within the window treats that one event as the engine's correction and
 * rebases; a delta that does not match is the reader and is handled as
 * usual. Kept per-document at module scope for the same reason the settle
 * window is.
 */
let shiftPx = 0;
let shiftUntil = 0;

/** Declare that in-flow content of `px` height just entered or left the
 *  flow above the viewport's anchor. `px` ≤ 0 declares nothing. */
export function declareAnchoringShift(px: number, ms = 300): void {
  if (!(px > 0)) return;
  shiftPx = px;
  shiftUntil = performance.now() + ms;
}

/** True when `delta` (a scrollY difference) is the declared anchoring
 *  correction rather than a gesture. `tolerance` absorbs sub-pixel rounding. */
export function isAnchoringShift(delta: number, tolerance: number): boolean {
  if (shiftPx <= 0 || performance.now() >= shiftUntil) return false;
  return Math.abs(Math.abs(delta) - shiftPx) <= tolerance;
}
