"use client";
// Pull-to-refresh for the browsing shell.
//
// WHY THIS EXISTS. globals.css sets `overscroll-behavior-y: none` on html/body
// (so the drawer/sheet gestures never rubber-band the page) and the manifest
// launches the PWA `standalone`. Between the two, the browser's own
// pull-to-refresh is gone on every phone, and there is no other way for a
// customer to re-pull the menu, an order's status or their plan without
// killing the tab. This restores the gesture with the app's own affordance.
//
// WHAT IT DOES. Touch starts at scrollY 0, moves down → a small pill with an
// arrow follows the finger with resistance; past the threshold the arrow
// flips; release → spinner, `router.refresh()` re-fetches every server
// component on the route (menu rows, order status, plan offer), and a
// `tanmatra:refresh` event lets client-fetched islands re-pull (see
// usePullRefresh). Reduced motion keeps the pill but drops the transforms.
//
// WHEN IT STAYS OUT OF THE WAY. Not mounted on (focus) routes at all — a
// refresh mid-checkout could reset a slot reservation or an OTP step, and the
// dish page has its own sticky ledger. Also inert while a Vaul drawer/dialog
// is open (their scroll lock owns the touch stream), while the page is not
// at the top, for horizontal moves, and for mouse/pen pointers.
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

const THRESHOLD_PX = 72;
const MAX_PULL_PX = 120;
const RESISTANCE = 0.55;
const MIN_SPIN_MS = 500;
export const REFRESH_EVENT = "tanmatra:refresh";

type Phase = "idle" | "pulling" | "armed" | "refreshing";

export function PullToRefresh() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [pull, setPull] = useState(0);
  const startY = useRef<number | null>(null);
  const startX = useRef(0);
  const tracking = useRef(false);
  const reduce = useRef(false);

  useEffect(() => {
    reduce.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const refresh = useCallback(async () => {
    setPhase("refreshing");
    const started = Date.now();
    window.dispatchEvent(new CustomEvent(REFRESH_EVENT));
    router.refresh();
    // router.refresh() resolves nothing awaitable; hold the spinner long
    // enough to read as "did something" and for the RSC payload to land.
    const wait = Math.max(0, MIN_SPIN_MS - (Date.now() - started));
    await new Promise((r) => setTimeout(r, wait + 300));
    setPhase("idle");
    setPull(0);
  }, [router]);

  useEffect(() => {
    const overlayOpen = () =>
      document.body.hasAttribute("data-scroll-locked") ||
      document.querySelector('[role="dialog"][data-state="open"]') !== null;

    const onStart = (e: TouchEvent) => {
      if (phase === "refreshing") return;
      if (window.scrollY > 0 || overlayOpen()) return;
      const t = e.touches[0];
      if (!t) return;
      startY.current = t.clientY;
      startX.current = t.clientX;
      tracking.current = true;
    };
    const onMove = (e: TouchEvent) => {
      if (!tracking.current || startY.current === null) return;
      const t = e.touches[0];
      if (!t) return;
      const dy = t.clientY - startY.current;
      const dx = Math.abs(t.clientX - startX.current);
      if (dy <= 0 || window.scrollY > 0) {
        setPull(0);
        setPhase("idle");
        return;
      }
      if (dx > dy) {
        tracking.current = false; // horizontal swipe (chip rail, carousels)
        return;
      }
      const d = Math.min(MAX_PULL_PX, dy * RESISTANCE);
      setPull(d);
      setPhase(d >= THRESHOLD_PX ? "armed" : "pulling");
      if (e.cancelable) e.preventDefault();
    };
    const onEnd = () => {
      if (!tracking.current) return;
      tracking.current = false;
      startY.current = null;
      if (phase === "armed") {
        setPull(THRESHOLD_PX * 0.75);
        void refresh();
      } else {
        setPull(0);
        setPhase("idle");
      }
    };
    // `passive:false` on move so the pull can cancel the (already disabled)
    // native overscroll; start/end stay passive.
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, [phase, refresh]);

  const visible = phase !== "idle" || pull > 0;
  const progress = Math.min(1, pull / THRESHOLD_PX);
  const label =
    phase === "refreshing" ? "Refreshing" : phase === "armed" ? "Release to refresh" : "Pull to refresh";

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[var(--z-bar)] flex justify-center"
      style={{
        // Sits just under the sticky header (63px) so it never covers the
        // location trigger; translates with the pull, resistance already applied.
        transform: reduce.current ? undefined : `translateY(${visible ? 56 + pull * 0.4 : -48}px)`,
        transition: tracking.current ? "none" : "transform 200ms ease-out, opacity 150ms",
        opacity: visible ? 1 : 0,
      }}
    >
      <div className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink shadow-[var(--shadow-raised)]">
        {phase === "refreshing" ? (
          <RefreshCw aria-hidden className="h-3.5 w-3.5 animate-spin text-ink-muted motion-reduce:animate-none" />
        ) : (
          <span
            aria-hidden
            className="inline-block text-ink-muted"
            style={{
              transform: reduce.current ? undefined : `rotate(${progress * 180}deg)`,
              transition: "transform 120ms",
            }}
          >
            ↓
          </span>
        )}
        <span>{label}</span>
      </div>
    </div>
  );
}

/**
 * Subscribe a client-fetched island to the pull gesture. Server components
 * re-fetch through router.refresh(); anything that pulled its own data with
 * apiGet (preferences on /menu, order history) re-pulls here.
 */
export function usePullRefresh(handler: () => void): void {
  useEffect(() => {
    const h = () => handler();
    window.addEventListener(REFRESH_EVENT, h);
    return () => window.removeEventListener(REFRESH_EVENT, h);
  }, [handler]);
}
