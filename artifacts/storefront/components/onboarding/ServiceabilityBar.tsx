"use client"; // Justification: client-side pincode entry, API serviceability verdict, and localStorage persistence.
import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  checkServiceability,
  loadServiceabilityState,
  saveServiceabilityState,
  clearServiceabilityState,
  type ServiceabilityVerdict,
} from "@/lib/serviceabilityApi";
import { ApiError } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { NotifyMeForm } from "./NotifyMeForm";
import { LocationPickerFlow } from "@/components/address/LocationPickerFlow";

export interface ServiceabilityBarProps {
  /** Optional location label for diagnostic or analytics tagging. */
  placement?: "hero" | "menu";
}

/**
 * Width clamp for the header-hosted (`menu`) instance. Astryx's TopNav renders
 * endContent at flex-shrink:0 — and, critically, that means TopNav's flex
 * algorithm never asks endContent's children to shrink at all: endContent
 * always gets its full natural width, and 100% of the squeeze lands on
 * `leftSection` (the wordmark) instead, however small that leaves it. A
 * `min-w-0`/`max-w` on THIS widget only bounds its own upper size — it does
 * nothing to make endContent shrink, since nothing here ever pressures it to.
 * So the cap must be small enough, on its own, that heading + this + ⌘K +
 * ThemeToggle already fit inside a 360px bar with room to spare — there is no
 * flex-driven fallback if it's too generous.
 *
 * Measured via Playwright at w=360 (menu route, signed-out state): the
 * wordmark renders at ~92px, ⌘K's icon-only trigger at ~36px, ThemeToggle at
 * 44px, three 8px gaps, and ~16px of TopNav's own edge padding — leaving
 * ~144px for this widget before the wordmark starts overflowing its box.
 * 9rem keeps a margin under that, and relaxes to the original max-w-xs from
 * sm up, where the endContent cluster is no longer competing with a
 * flex-shrink:0 wordmark for the same 360px.
 */
const MENU_FIT = "min-w-0 max-w-[9rem] sm:max-w-xs";

/**
 * ServiceabilityBar (OB-2 & OB-3 / II.1 & II.3). Non-blocking front-door delivery gate.
 * Evaluates pincodes via public API without gating catalog visibility or requiring auth.
 * Displays notify-me form on unserviceable verdict with graceful 404 degradation.
 *
 * EXACTLY ONE INSTANCE MAY BE MOUNTED PER PAGE, and it is the one in
 * components/Header.tsx (placement="menu"). Verdict and pincode are per-instance
 * state seeded from localStorage once at mount (the effect below) with no
 * `storage` listener, so two copies never learn each other's answer: check a
 * pincode in one and the other keeps saying "Select your location" for the rest
 * of the session. app/page.tsx used to mount a second copy (placement="hero")
 * and that is exactly what happened from sm up. If a surface ever genuinely
 * needs the widget in two places, lift the state into a provider — do not mount
 * a second bar.
 */
export function ServiceabilityBar({ placement = "hero" }: ServiceabilityBarProps) {
  const [verdict, setVerdict] = useState<ServiceabilityVerdict>("unknown");
  const [pincode, setPincode] = useState("");
  const [inputVal, setInputVal] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const [pickingLocation, setPickingLocation] = useState(false);
  const [manualMode, setManualMode] = useState(false);

  useEffect(() => {
    const s = loadServiceabilityState();
    if (s.verdict !== "unknown") {
      setVerdict(s.verdict);
      setPincode(s.pincode);
    }
  }, []);

  // A user-triggered check (button tap / location confirm), not data read for
  // render — a mutation, even though the verb underneath is GET.
  const checkMutation = useMutation({
    mutationFn: (code: string) => checkServiceability(code),
    onSuccess: (res) => {
      saveServiceabilityState(res);
      setVerdict(res.verdict);
      setPincode(res.pincode);
      setInputVal("");
      setManualMode(false);
    },
  });
  const busy = checkMutation.isPending;

  const handleLocationSelect = (place: any) => {
    setPickingLocation(false);
    const code = place.pincode;
    if (!code) {
      setErr("Could not determine pincode for this location. Please enter it manually.");
      setManualMode(true);
      return;
    }
    setErr(null);
    checkMutation.mutate(code, {
      onError: (e) => {
        setErr(e instanceof ApiError ? e.message : "Unable to check serviceability right now.");
        setManualMode(true);
      },
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(inputVal.trim())) {
      setErr("Please enter a valid 6-digit pincode");
      return;
    }
    setErr(null);
    checkMutation.mutate(inputVal, {
      onError: (e) => {
        setErr(e instanceof ApiError ? e.message : "Unable to check pincode right now.");
      },
    });
  };

  const handleReset = () => {
    clearServiceabilityState();
    setVerdict("unknown");
    setPincode("");
    setInputVal("");
    setManualMode(false);
  };

  if (verdict === "serviceable") {
    // T-05: ONE line, and the WHOLE pill is the tap target. The old
    // "Delivering in 201301 ✓ · Change" wrapped to three lines inside the
    // header's 9rem cap and grew the sticky bar from 63 to 83px for the rest
    // of the session, with "Change" a 43×16 link. The pin glyph carries
    // "delivering"; the code carries the where; the tick carries the verdict.
    return (
      <button
        type="button"
        onClick={handleReset}
        aria-label={`Delivering in ${pincode}. Change location`}
        className={`${placement === 'menu' ? MENU_FIT : 'mb-6'} inline-flex min-h-11 max-w-[45vw] items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--line-strong)] bg-[var(--surface-subtle)] px-3 text-xs font-semibold text-[var(--ink)] shadow-sm transition-colors hover:border-[var(--gold)]`}
      >
        <svg aria-hidden className="h-4 w-4 shrink-0 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.242-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className="tabular truncate">{pincode}</span>
        <span aria-hidden className="text-[var(--success)]">✓</span>
      </button>
    );
  }

  if (verdict === "unserviceable") {
    return (
      <div className={`${placement === 'menu' ? '' : 'mb-6'} rounded-2xl border border-[var(--danger)]/30 bg-[var(--surface)] p-5 text-left shadow-sm max-w-lg`}>
        <p className="text-sm font-semibold text-[var(--ink)]">
          {/* `{" "}` is load-bearing, not formatting noise. Written as
              `{pincode} yet`, the space between the expression and the
              following text is dropped by the JSX transform, and the shipped
              DOM reads "not in 400001yet" — verified against a production
              build's innerHTML, not guessed. Every out-of-zone visitor saw it.
              An explicit space node cannot be collapsed. */}
          We&rsquo;re not in {pincode}{" "}
          yet &mdash; browse anyway, and leave your number: we&rsquo;ll message you the day we arrive.
        </p>
        <NotifyMeForm pincode={pincode} onReset={handleReset} />
      </div>
    );
  }

  if (manualMode) {
    return (
      <form onSubmit={handleSubmit} className={`${placement === 'menu' ? MENU_FIT : 'mb-6 max-w-md'} flex flex-wrap items-center gap-2`}>
        {placement !== 'menu' && (
          <label htmlFor={`pin-input-${placement}`} className="w-full text-xs font-medium uppercase tracking-wide text-ink-muted">
            Where should we deliver? Enter your pincode
          </label>
        )}
        <div className="flex w-full items-center gap-2">
          <input
            id={`pin-input-${placement}`}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="e.g. 201301"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            disabled={busy}
            className="w-44 min-w-0 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--ink)] outline-none focus-visible:border-[var(--line-strong)] disabled:opacity-50"
          />
          <Button
            type="submit"
            disabled={busy || inputVal.trim().length !== 6}
            aria-busy={busy}
            aria-live="polite"
            shape="xl"
            size="fluid"
            className="px-5 py-2.5 font-semibold shadow-sm disabled:opacity-40"
          >
            {/* A real ellipsis character — an entity inside a JS string is
                LITERAL text, not markup; entities only resolve in JSX text
                nodes. The busy state read "Checking&amp;hellip;" verbatim. */}
            {busy ? "Checking…" : "Check"}
          </Button>
          <button
            type="button"
            onClick={() => setManualMode(false)}
            className="text-xs font-medium text-ink-muted underline hover:text-ink ml-2"
          >
            Cancel
          </button>
        </div>
        {err && <p role="alert" className="text-xs font-medium text-[var(--danger)] w-full">{err}</p>}
      </form>
    );
  }

  return (
    <div className={`${placement === 'menu' ? MENU_FIT : 'mb-6 max-w-md'} flex flex-col items-start gap-2`}>
      {placement !== 'menu' && (
        <label className="w-full text-xs font-medium uppercase tracking-wide text-ink-muted">
          Where should we deliver?
        </label>
      )}
      <div className="flex w-full items-center gap-3">
        <button
          type="button"
          onClick={() => { setErr(null); setPickingLocation(true); }}
          disabled={busy}
          // min-w-0 alongside flex-1 is load-bearing, not decorative: a flex
          // item's automatic minimum width defaults to its content size, so
          // without this the button ignored MENU_FIT's cap entirely and
          // rendered at its full ~266px natural width (icon + untruncated
          // label + "MAP"), overflowing right through the ⌘K button — the
          // label's own `truncate` never got a chance to apply because the
          // button around it never actually shrank. Measured via Playwright.
          className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 sm:px-4 py-3 text-sm text-[var(--ink)] shadow-sm hover:border-[var(--line-strong)] transition-colors text-left disabled:opacity-60"
        >
          <svg className="h-4 w-4 sm:h-5 sm:w-5 text-gold shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.242-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {/* Below sm the whole widget is capped at MENU_FIT's 9rem, and the
              long labels did not fit inside it: after the pin, the gaps, the
              padding and the "MAP" tag there were ~38px left for text, so the
              control shipped reading "Se… MAP" — an ellipsis where the verb
              should be. The pin glyph already says "map", so from the tightest
              breakpoint the tag stands down and the label loses its verb; both
              come back from sm up, where there is room for them. `truncate`
              stays as the backstop for a font that measures wider than ours.
              The narrow-width padding/gap/icon sizes are MEASURED, not chosen:
              "Set location" needs 94px, and at the original px-3/gap-2/h-5 the
              label box was 90px — still four short, still an ellipsis. The
              tighter trio buys 10px, so the label clears its box with room
              rather than by a hair. Re-measure if any of them changes; the
              9rem cap itself is fixed by the wordmark and must not move. */}
          <span className="font-semibold text-ink-muted flex-1 truncate">
            {busy ? (
              "Checking…"
            ) : (
              <>
                <span className="sm:hidden">Set location</span>
                <span className="hidden sm:inline">Select your location</span>
              </>
            )}
          </span>
          {!busy && <span className="hidden sm:inline text-xs font-bold text-gold shrink-0">MAP</span>}
        </button>
      </div>
      {err && <p role="alert" className="text-xs font-medium text-[var(--danger)] w-full">{err}</p>}
      
      {pickingLocation && (
        <LocationPickerFlow
          onClose={() => setPickingLocation(false)}
          onSelectLocation={handleLocationSelect}
          onManualFallback={() => {
            setPickingLocation(false);
            setManualMode(true);
          }}
        />
      )}
    </div>
  );
}
