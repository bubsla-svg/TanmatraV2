"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Direction-aware chrome condensing for long list pages (owner feedback
 * 2026-08-16: on /menu, controls consumed ~40% of the viewport before the
 * first product).
 *
 * `true` while the reader is moving DOWN a long page — the moment their
 * intent is "browsing the list", not "operating the controls" — and back to
 * `false` on ANY upward scroll or near the top, because scrolling up is the
 * universal gesture for "take me back to the controls". This is the
 * condense-on-scroll grammar of every q-commerce app the menu directive
 * anchors to.
 *
 * Mechanics worth keeping:
 * - rAF-gated passive listener — at most one state check per frame, no
 *   layout reads in the handler, nothing to throttle or debounce.
 * - The jitter guard does NOT advance `lastY` on sub-threshold moves, so
 *   micro-deltas (iOS momentum tails, rubber-banding) accumulate toward the
 *   threshold instead of resetting it — a slow deliberate scroll still
 *   flips the state, while one-pixel noise never flaps it.
 * - Expanding is deliberately HARDER than condensing (UP_TRAVEL_PX of
 *   cumulative upward movement vs. one 6px down-move). The collapse changes
 *   the cluster's layout height by ~84px, and anything that servo-corrects
 *   scroll position against layout — browser scroll anchoring, Playwright's
 *   element-stability retries, a finger wobbling at a direction boundary —
 *   emits small counter-scrolls after each toggle. A symmetric threshold
 *   turns that into a visible expand/condense pump; the asymmetry means
 *   only an intentional upward pull brings the controls back.
 * - THE HOOK IS DEAF TO ITS OWN CONSEQUENCES. Every state flip resizes the
 *   stuck cluster, which shifts all content below it, which browser scroll
 *   anchoring compensates with a synthetic scroll event of the SAME ~84px —
 *   in the opposite direction of the gesture that caused the flip. Fed back
 *   into the detector, that reads as an instant counter-gesture: an upward
 *   pull expands the bar, anchoring emits +84 "down", the bar re-condenses
 *   within a frame, and expanding becomes impossible mid-list (observed,
 *   not theoretical). So each flip opens a settle window during which scroll
 *   events only advance the baseline — the flip is allowed to finish before
 *   the detector listens again.
 * - CONDENSE_AFTER keeps the page's own top state honest: above that line
 *   the full controls are always shown, so the initial paint and the
 *   scrolled-back-to-top state are identical and hydration cannot mismatch
 *   (state starts `false`; the listener only attaches after mount).
 */
const JITTER_PX = 6;
const CONDENSE_AFTER_PX = 160;
const UP_TRAVEL_PX = 48;
/** Collapse/expand transition is 200ms; the settle window outlives it so a
 *  flip's own anchoring compensation can never read as a counter-gesture. */
const SELF_SETTLE_MS = 300;

export function useCondensedOnScroll(): {
  condensed: boolean;
  /**
   * Pin the condensed state for `ms`, ignoring scroll direction meanwhile.
   * For PROGRAMMATIC travel — a section-chip jump — where direction is
   * meaningless as intent: an upward jump would otherwise re-expand the
   * controls mid-flight, changing the cluster's height between when the
   * scroll target was computed and when it lands, which is exactly the
   * "heading tucked under the chrome" failure the anchor offset exists to
   * prevent. A jump means "I am browsing the list", so it lands condensed,
   * deterministically. Ordinary scrolling resumes control after `ms`.
   */
  pin: (ms: number) => void;
} {
  const [condensed, setCondensed] = useState(false);
  const condensedRef = useRef(false);
  const suppressUntil = useRef(0);

  // Single write path: every real flip opens the settle window (see the
  // header comment) so its own anchoring echo cannot flip it back.
  const apply = useCallback((next: boolean) => {
    if (condensedRef.current === next) return;
    condensedRef.current = next;
    suppressUntil.current = Math.max(
      suppressUntil.current,
      performance.now() + SELF_SETTLE_MS,
    );
    setCondensed(next);
  }, []);

  const pin = useCallback(
    (ms: number) => {
      suppressUntil.current = performance.now() + ms;
      condensedRef.current = true;
      setCondensed(true);
    },
    [],
  );

  useEffect(() => {
    let lastY = window.scrollY;
    let upTravel = 0;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = window.scrollY;
        // Keep the baseline tracking THROUGH pinned flights and settle
        // windows — releasing suppression must not hand the handler a stale
        // delta from before it.
        if (performance.now() < suppressUntil.current) {
          lastY = y;
          upTravel = 0;
          return;
        }
        const dy = y - lastY;
        if (Math.abs(dy) < JITTER_PX) return;
        lastY = y;
        if (y <= CONDENSE_AFTER_PX) {
          upTravel = 0;
          apply(false);
        } else if (dy > 0) {
          upTravel = 0;
          apply(true);
        } else {
          upTravel += -dy;
          if (upTravel >= UP_TRAVEL_PX) apply(false);
        }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [apply]);

  return { condensed, pin };
}
