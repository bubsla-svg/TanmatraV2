"use client";
import { useEffect, useRef, useState } from "react";
import { isLayoutSettling } from "./scrollSettle";

/** Ignore scroll movement under this many px — small-movement hysteresis so
 *  chrome doesn't flicker on sub-pixel/rubber-band jitter (D-17). */
const SCROLL_HYSTERESIS_PX = 12;

/**
 * Hide on scroll-down, reveal on scroll-up, past the hysteresis threshold.
 * Always revealed at the top of the page and whenever `disabled` (an overlay
 * is open — scroll state shouldn't fight the overlay).
 *
 * Extracted VERBATIM from MobileBottomNav (owner feedback 2026-08-16: the
 * whole app's chrome taxes the viewport, and the retreat grammar the bottom
 * bar already shipped is the fix — it just never reached the top). One
 * implementation so top and bottom chrome move on identical thresholds; a
 * divergence there reads as the two bars disagreeing about what the user is
 * doing.
 *
 * This hook is for chrome that TRANSLATES away (fixed/sticky bars — no
 * layout change, so no scroll-anchoring echo of its own). Chrome that
 * RESIZES its layout box on toggle needs `useCondensedOnScroll` instead.
 *
 * It still has to survive SOMEONE ELSE'S resize, though: on `/menu` the
 * condensing cluster's collapse produced an anchoring counter-scroll that
 * read here as a scroll-up and revealed the tab bar mid-scroll (caught by
 * nav-contract.spec.ts). Hence `isLayoutSettling()` — a page-wide signal,
 * because the echo belongs to the document, not to the hook that caused it.
 */
export function useScrollHide(disabled: boolean): boolean {
  const [hidden, setHidden] = useState(false);
  const lastYRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    lastYRef.current = window.scrollY;

    function onScroll() {
      const y = window.scrollY;
      // Another component just resized the page; the engine's anchoring
      // correction is not the reader moving. Track the baseline through it
      // so the frames spanning the correction never become a delta.
      if (isLayoutSettling()) {
        lastYRef.current = y;
        return;
      }
      const delta = y - lastYRef.current;
      if (y <= 0) {
        setHidden(false);
        lastYRef.current = y;
        return;
      }
      if (Math.abs(delta) < SCROLL_HYSTERESIS_PX) return;
      setHidden(delta > 0);
      lastYRef.current = y;
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return disabled ? false : hidden;
}
