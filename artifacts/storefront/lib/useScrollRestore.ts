"use client";
import { useEffect } from "react";

/**
 * Restore the reader's place on /menu across a round trip (M-5 §3.9, Law 3
 * — state intact).
 *
 * WHAT WAS ACTUALLY BROKEN. Next's App Router restores scroll for
 * back/forward within the same document, and /menu already preserves its
 * FILTER state across that (PersonalizedMenu seeds chip/filters/query from
 * the URL). Neither covers the case this fixes: leaving /menu entirely —
 * tapping into a dish PDP, Care, Account — and coming back. The route
 * remounts, the server re-renders every card (95 of them as of 2026-08-20;
 * the exact number moves with the catalogue and is not what matters here —
 * only that it is a long page), and the reader lands at the
 * top of section 1 having been in Smoothies & Juices. On a page this long
 * that is not a small annoyance; it is losing your place in a list you were
 * halfway through choosing from.
 *
 * WHY sessionStorage RATHER THAN history.state. The scroll position has to
 * survive a full remount and a fresh server render, and it must NOT survive
 * a new tab or a fresh visit — a position restored into a catalog the
 * reader has never seen is worse than the top of the page. sessionStorage
 * has exactly that lifetime. history.state would also need the entry to
 * still be the one we wrote, which a `router.replace` (the URL sync this
 * page runs on a 400ms debounce) can quietly invalidate.
 *
 * WHY rAF AND NOT A useEffect ALONE. On mount the cards are in the DOM but
 * `.cv-auto-row`'s `content-visibility: auto` means most have not been laid
 * out yet, so the document is shorter than its final height and a
 * scrollTo() past that height silently clamps to the bottom. One frame
 * later the intrinsic-size reservations are in place and the target is
 * reachable. Two frames is belt and braces for a slow first paint.
 */
const KEY_PREFIX = "tnm:scroll:";

export function useScrollRestore(key: string, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const storageKey = KEY_PREFIX + key;

    let raf1 = 0;
    let raf2 = 0;
    try {
      const saved = sessionStorage.getItem(storageKey);
      const y = saved ? Number(saved) : 0;
      if (Number.isFinite(y) && y > 0) {
        raf1 = requestAnimationFrame(() => {
          raf2 = requestAnimationFrame(() => {
            window.scrollTo({ top: y, behavior: "auto" });
          });
        });
      }
    } catch {
      // Private mode / storage disabled — restoring position is a nicety,
      // never a reason to break the page.
    }

    // `pagehide` rather than `beforeunload`: it fires for the bfcache and
    // for SPA teardown on mobile Safari, where `beforeunload` does not.
    // The cleanup below covers the ordinary client-side route change, which
    // fires neither.
    const save = () => {
      try {
        sessionStorage.setItem(storageKey, String(window.scrollY));
      } catch {
        /* see above */
      }
    };
    window.addEventListener("pagehide", save);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.removeEventListener("pagehide", save);
      save();
    };
  }, [key, enabled]);
}
