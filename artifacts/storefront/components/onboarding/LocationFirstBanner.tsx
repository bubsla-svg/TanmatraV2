"use client";
// Client: the first-visit location ask — PIN or GPS — and its answer.
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/apiClient";
import { emitFunnel } from "@/lib/funnel";
import { declareAnchoringShift } from "@/lib/scrollSettle";
import { checkServiceability } from "@/lib/serviceabilityApi";
import { LocationPickerFlow } from "@/components/address/LocationPickerFlow";
import { useServiceability } from "./ServiceabilityProvider";

/** Per-tab: a visitor who said "browse first" is not asked again this
 *  session; the header's own pill stays available for when they are ready. */
const DISMISSED_KEY = "tnm_location_prompt_dismissed";

function isBrowsingSurface(pathname: string): boolean {
  return pathname === "/" || pathname === "/menu" || pathname.startsWith("/dish/");
}

/**
 * T5 (CRO handoff 2026-09-17) — location FIRST. The old "Set location" was a
 * small optional pill in the header, so most visitors browsed, built a cart
 * and only learned at checkout whether we deliver to them (checkout.ts:331's
 * refusal in the logs). This asks on the first browsing screen, ahead of the
 * food: one PIN field with a GPS/map alternative, inline — never an overlay
 * that traps focus over the menu. It renders only while the verdict is
 * unknown and the visitor has not dismissed it this session.
 *
 * An unserviceable answer is carried by the header's ServiceabilityBar,
 * which already renders the waitlist capture (NotifyMeForm →
 * cuj_waitlist_captured) — exactly one copy of that form per page — while
 * every Add button and the cart's Checkout read the same verdict and stand
 * down (useOutOfZone). This banner only ever asks.
 */
export function LocationFirstBanner() {
  const pathname = usePathname();
  const { state, hydrated, set } = useServiceability();
  const [dismissed, setDismissed] = useState(true);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(DISMISSED_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  const eligible = hydrated && isBrowsingSurface(pathname ?? "");
  const showAsk = eligible && state.verdict === "unknown" && !dismissed;

  // This banner is in-flow at the top of the page and appears only after
  // hydration (the dismissal flag lives in sessionStorage), so its mount and
  // its dismissal both resize the document. When the reader has already
  // scrolled, the engine's scroll anchoring moves scrollY by exactly the
  // banner's height — a synthetic scroll that useScrollHide read as a fast
  // scroll-down and hid the tab bar (nav-contract.spec.ts caught it). The
  // height is declared BEFORE the browser lays out, from a layout effect,
  // and again from its cleanup while the node is still in the flow.
  const sectionRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (!showAsk) return;
    const el = sectionRef.current;
    if (!el) return;
    if (window.scrollY > 0) declareAnchoringShift(el.offsetHeight);
    return () => {
      if (window.scrollY > 0) declareAnchoringShift(el.offsetHeight);
    };
  }, [showAsk]);

  useEffect(() => {
    if (showAsk) emitFunnel("location_prompt_shown", { path: pathname ?? "" });
  }, [showAsk, pathname]);

  async function resolve(code: string, source: "banner" | "gps") {
    setBusy(true);
    setError(null);
    try {
      const next = await checkServiceability(code);
      set(next);
      emitFunnel("location_set", { verdict: next.verdict, source, pincode_prefix: next.pincode.slice(0, 3) });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "We couldn't check that PIN code just now. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const digits = pin.replace(/\D/g, "");
    if (digits.length !== 6) {
      setError("Enter your 6-digit PIN code.");
      return;
    }
    void resolve(digits, "banner");
  }

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISSED_KEY, "1");
    } catch {}
    setDismissed(true);
    emitFunnel("location_prompt_dismissed", { path: pathname ?? "" });
  }

  if (!showAsk) return null;

  return (
    <section ref={sectionRef} aria-label="Where should we deliver?" className="mx-auto w-full max-w-screen-xl px-4 pt-4">
      <form onSubmit={submit} className="rounded-2xl border border-gold/40 bg-surface p-4">
        <p className="font-display text-lg font-semibold leading-6 text-primary">Where should we deliver?</p>
        <p className="mt-1 text-xs text-ink-muted">
          Confirm your PIN code to see today&rsquo;s delivery windows before you pick a dish.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            aria-label="Delivery PIN code"
            inputMode="numeric"
            autoComplete="postal-code"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="201301"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            disabled={busy}
            className="min-h-[50px] w-36 rounded-2xl border border-line bg-bg px-4 text-base text-ink outline-none placeholder:text-ink-faint focus-visible:border-primary disabled:opacity-50"
          />
          <Button type="submit" shape="pill" size="fluid" disabled={busy || pin.length !== 6} aria-busy={busy} className="min-h-12 px-5 font-semibold disabled:opacity-40">
            {busy ? "Checking…" : "Confirm"}
          </Button>
          <button
            type="button"
            onClick={() => setPicking(true)}
            disabled={busy}
            className="inline-flex min-h-12 items-center rounded-full border border-line-strong px-4 text-sm font-medium text-ink transition-transform hover:bg-secondary active:scale-[0.98]"
          >
            Use my location
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="ml-auto inline-flex min-h-11 items-center px-2 text-xs font-medium text-ink-muted underline underline-offset-4 hover:text-ink"
          >
            Browse first
          </button>
        </div>
        {error && <p role="alert" className="mt-2 text-xs font-medium text-danger">{error}</p>}
      </form>
      {picking && (
        <LocationPickerFlow
          onClose={() => setPicking(false)}
          onSelectLocation={(place) => {
            setPicking(false);
            if (place.pincode) void resolve(place.pincode, "gps");
            else setError("We couldn't read a PIN code for that spot — type it above.");
          }}
          onManualFallback={() => setPicking(false)}
        />
      )}
    </section>
  );
}
