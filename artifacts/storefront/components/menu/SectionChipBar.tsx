"use client";
// Client: owns an IntersectionObserver over the section anchors and the
// active-chip state that observer drives. Neither can exist server-side.
import { useEffect, useRef, useState } from "react";

/**
 * The menu's navigation spine (TNM-MENU-01 M-5 §3.2).
 *
 * With M-3 applied, /menu is 112 dishes across 12 rendered sections — long
 * enough that "scroll until you find it" is the whole experience. This is
 * the borrowed Blinkit/Zepto grammar the directive anchors to: a sticky
 * horizontal chip row where tapping a chip jumps to its section and
 * scrolling moves the active chip to match.
 *
 * PORTED, not invented: `artifacts/tanmatra/src/tanmatra-v2/Menu.tsx`
 * already solved this (CategoryScrollSpy) and its two hard-won details are
 * kept verbatim in spirit —
 *
 *   1. SPY_LOCK_MS. A click-jump sets the active chip immediately and then
 *      SUPPRESSES observer updates while the smooth-scroll travels. Without
 *      it the active chip flickers through every intermediate section on
 *      the way down, which reads as the UI fighting the tap.
 *   2. The asymmetric rootMargin. `-15% 0px -55% 0px` makes a section
 *      "current" while its heading sits in the upper third of the viewport,
 *      not when it merely touches the bottom edge — otherwise the next
 *      section claims the chip while the user is still reading the previous
 *      one's cards.
 *
 * No scroll listener: the observer does the work, and each section's
 * scroll-margin-top (--menu-anchor-offset, synced to the live sticky
 * cluster height) lands the jump just below the pinned chrome instead of
 * underneath it.
 *
 * "Off the Wok" needs no special-casing here — it is section 13, so payload
 * order already places it last, and the bar renders whatever sections
 * actually have visible dishes. It gets no default prominence because
 * nothing here grants any.
 */

/** Hold the tapped chip active while the smooth-scroll settles. */
const SPY_LOCK_MS = 700;

export interface SectionAnchor {
  id: string;
  label: string;
}

export function SectionChipBar({ anchors }: { anchors: SectionAnchor[] }) {
  const [active, setActive] = useState(anchors[0]?.id ?? "");
  const activeRef = useRef(active);
  activeRef.current = active;
  const suppressRef = useRef(false);
  const railRef = useRef<HTMLDivElement>(null);
  // A primitive key, so the effect re-runs when the SET of sections changes
  // (a filter emptied one) but not on every parent re-render.
  const anchorKey = anchors.map((a) => a.id).join("|");

  useEffect(() => {
    const ids = anchorKey ? anchorKey.split("|") : [];
    if (!ids.includes(activeRef.current)) setActive(ids[0] ?? "");
    const els = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (els.length === 0) return;

    const seen = new Map<string, boolean>();
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.isIntersecting);
        if (suppressRef.current) return; // a tap owns the chip until it lands
        const next = ids.find((id) => seen.get(id));
        if (next && next !== activeRef.current) setActive(next);
      },
      { rootMargin: "-15% 0px -55% 0px", threshold: 0 },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [anchorKey]);

  // Keep the active chip visible inside the horizontal rail — otherwise
  // scrolling into section 10 leaves the chip bar showing sections 1-4.
  useEffect(() => {
    railRef.current
      ?.querySelector<HTMLElement>(`[data-anchor="${active}"]`)
      ?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [active]);

  function jump(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    suppressRef.current = true;
    setActive(id);
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    window.setTimeout(() => {
      suppressRef.current = false;
    }, reduce ? 0 : SPY_LOCK_MS);
  }

  if (anchors.length < 2) return null; // one section needs no navigation

  return (
    <div
      ref={railRef}
      role="group"
      aria-label="Jump to section"
      data-testid="menu-section-chipbar"
      className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1"
    >
      {anchors.map((a) => {
        const on = active === a.id;
        return (
          <button
            key={a.id}
            type="button"
            data-anchor={a.id}
            aria-current={on ? "location" : undefined}
            onClick={() => jump(a.id)}
            // Selection state, never a rival action colour — the same
            // border+tint+marker idiom the diet chips use, because the
            // mini-cart bar is this screen's one gold action (DS-0).
            className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-transform active:scale-95 ${
              on
                ? "border-gold bg-gold/10 text-gold-text"
                : "border-line bg-surface text-ink-muted hover:text-ink"
            }`}
          >
            {a.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Sync `--menu-anchor-offset` to the live height of the sticky cluster
 * (header + chip bar), so a jumped-to section lands just below it rather
 * than behind it. A ResizeObserver rather than a one-shot measurement
 * because the cluster's height genuinely changes — the filter summary line
 * appears and disappears, and chips wrap at narrow widths.
 */
export function useStickyAnchorOffset(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const sync = () => root.style.setProperty("--menu-anchor-offset", `${el.offsetHeight + 8}px`);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--menu-anchor-offset");
    };
  }, [ref]);
}
