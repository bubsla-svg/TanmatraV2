"use client";
// Client: scroll-direction state for the retreat. The header's CONTENT stays
// server-rendered — it arrives here as `children` across the boundary.
import type { ReactNode } from "react";
import { useScrollHide } from "@/lib/useScrollHide";

/**
 * The global header's retreat-on-scroll shell (owner feedback 2026-08-16:
 * chrome consumed the viewport on every route, not just /menu).
 *
 * MobileBottomNav has slid away on scroll-down since D-17; the header — the
 * other half of the letterbox — never did, so every long page paid a
 * permanent 63px tax at the top. Same shared hook now drives both, so top
 * and bottom chrome retreat and return on identical thresholds.
 *
 * Mechanics:
 * - TRANSLATE, not resize: the header keeps its layout slot, so nothing
 *   below reflows and scroll anchoring has nothing to echo back (the
 *   feedback loop useCondensedOnScroll had to defuse cannot start here).
 * - `inert` while hidden — same call MobileBottomNav made and for the same
 *   reason: chrome that is visually gone must leave the tab order and the
 *   accessibility tree, or a keyboard user tabs into invisible controls.
 *   Scrolling up (or reaching top) restores both paint and focusability.
 * - /menu already paints its sticky cluster OVER this header when both are
 *   pinned (same z, later in document order), so on that route the retreat
 *   changes nothing visually while the cluster is up — the two mechanisms
 *   compose instead of fighting.
 */
export function HeaderShell({ children }: { children: ReactNode }) {
  const hidden = useScrollHide(false);
  return (
    <header
      inert={hidden || undefined}
      className={`sticky top-0 z-10 border-b border-line bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] backdrop-blur transition-transform duration-200 motion-reduce:transition-none ${
        hidden ? "-translate-y-full" : "translate-y-0"
      }`}
    >
      {children}
    </header>
  );
}
