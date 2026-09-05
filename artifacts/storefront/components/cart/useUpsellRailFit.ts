"use client";
// "use client" justification: layout reads + ResizeObserver for the cart
// drawer's upsell rail — the rail's place under the order is measured.
import { useCallback, useEffect, useLayoutEffect, useState, type RefObject } from "react";
import { upsellRailSpacerPx } from "@/lib/upsell";

/** Gap between the last order line and the rail — the rail wrapper's base top padding. */
export const RAIL_GAP_PX = 16;

/**
 * Keeps the upsell rail out of the order's way — measured, never guessed.
 *
 * The drawer's scroll region (`region`) lays out the order list (`order`)
 * first and the rail wrapper (`rail`) after it; this hook returns the extra
 * top padding the wrapper needs so the rail is either wholly in view under
 * the order or has its card row wholly below the fold (its header may peek
 * as the cue) — never a card cut by the subtotal, never a pixel taken from
 * the order. The decision is the pure `upsellRailSpacerPx`;
 * this hook only feeds it three numbers:
 *
 * - orderPx:    everything in the region except the rail wrapper.
 * - railPx:     the rail's own height plus its base gap.
 * - peekPx:     the rail's header (gap + box padding + label) — what may
 *               show above the fold.
 * - capacityPx: how tall the region can get. The sheet is content-sized up to
 *               a CSS max-height, so a short cart's region does not show the
 *               ceiling — the sheet's computed max-height does: current
 *               region height + the headroom the sheet still has.
 *
 * orderPx and capacityPx are both invariant to the padding this hook sets, so
 * re-measuring after our own change converges in one pass — no observer loop.
 * Re-measures before paint on input changes (`key`: order lines, candidates,
 * hydration) and on resizes of the region (the footer's fee hint appearing),
 * the order list (lines added, qty rows), and the viewport (keyboard,
 * rotation).
 */
export function useUpsellRailFit(
  region: RefObject<HTMLElement | null>,
  order: RefObject<HTMLElement | null>,
  rail: RefObject<HTMLElement | null>,
  active: boolean,
  key: string,
): number {
  const [spacerPx, setSpacerPx] = useState(0);

  const measure = useCallback(() => {
    const r = region.current;
    if (!r) return;
    const wrapper = rail.current;
    const inner = wrapper?.firstElementChild;
    const railPx = inner instanceof HTMLElement ? inner.offsetHeight + RAIL_GAP_PX : 0;
    // The rail's header — everything above its card row — may peek over the
    // fold as the cue that add-ons sit below; the card row never straddles it.
    const row = inner instanceof HTMLElement ? inner.querySelector("ul") : null;
    const peekPx =
      row && inner instanceof HTMLElement
        ? RAIL_GAP_PX + Math.round(row.getBoundingClientRect().top - inner.getBoundingClientRect().top)
        : 0;
    const orderPx = r.scrollHeight - (wrapper?.offsetHeight ?? 0);
    const sheet = r.closest<HTMLElement>('[role="dialog"]');
    const maxPx = sheet ? parseFloat(getComputedStyle(sheet).maxHeight) : Number.NaN;
    const headroom = sheet && Number.isFinite(maxPx) ? Math.max(0, maxPx - sheet.offsetHeight) : 0;
    setSpacerPx(upsellRailSpacerPx({ orderPx, railPx, capacityPx: r.clientHeight + headroom, peekPx }));
  }, [region, rail]);

  // Before paint, so the rail never flashes at the wrong place.
  useLayoutEffect(() => {
    if (active) measure();
  }, [active, key, measure]);

  useEffect(() => {
    const r = region.current;
    if (!active || !r || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(r);
    if (order.current) ro.observe(order.current);
    const vv = window.visualViewport;
    window.addEventListener("resize", measure);
    vv?.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      vv?.removeEventListener("resize", measure);
    };
  }, [active, measure, region, order]);

  return spacerPx;
}
