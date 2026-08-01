"use client";
import { useEffect, useRef } from "react";

/** Marker key on the overlay's history entry. Namespaced so it can never
 *  collide with Next's own state (`__NA`, `__PRIVATE_NEXTJS_INTERNALS_TREE`). */
const OVERLAY_FLAG = "tnmOverlay";

/**
 * History-trap for dismissible overlays (bottom sheets, drawers, dialogs).
 *
 * While `open`, one history entry belongs to the overlay, so the platform
 * back affordance — Android's back button/gesture, iOS's edge swipe in a
 * browser — closes the overlay instead of leaving the underlying page.
 * Closing by any other means (X, scrim tap, Escape) consumes that entry
 * silently, so the stack never accumulates ghost entries.
 *
 * The pushed state SPREADS the current entry's state: Next's App Router keeps
 * its route tree in `history.state`, and an entry without it would degrade the
 * next popstate into a full navigation instead of a no-op.
 *
 * `onClose` is read through a ref so an inline-closure prop can never re-run
 * the effect: a naive `[open, onClose]` dependency tears the trap down and
 * fires the compensating `history.back()` on every parent re-render — which
 * closes the overlay from nothing more than a state change elsewhere.
 */
export function useOverlayHistory(open: boolean, onClose: () => void): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const state = window.history.state as Record<string, unknown> | null;
    window.history.pushState({ ...state, [OVERLAY_FLAG]: true }, "");

    const handlePopState = () => onCloseRef.current();
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      // Entry still ours ⇒ this close came from the UI, not the back
      // gesture — consume the trapped entry so back doesn't need two presses.
      const current = window.history.state as Record<string, unknown> | null;
      if (current?.[OVERLAY_FLAG]) window.history.back();
    };
  }, [open]);
}
