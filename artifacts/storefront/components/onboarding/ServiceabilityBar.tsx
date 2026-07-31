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
 * endContent at flex-shrink:0, so nothing upstream will squeeze this widget —
 * anything wider than the room left beside the wordmark just pushes the ⌘K
 * button off the bar. min-w-0 lets the inner label truncate instead; the cap
 * keeps it inside the ~208px a 360px viewport leaves after the wordmark and the
 * search button, and relaxes from sm up. The `hero` arm keeps its own max-w-md.
 */
const MENU_FIT = "min-w-0 max-w-[13rem] sm:max-w-xs";

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
    return (
      <div className={`${placement === 'menu' ? '' : 'mb-6'} inline-flex items-center gap-2 rounded-full border border-[var(--line-strong)] bg-[var(--surface-subtle)] px-4 py-2 text-xs font-medium text-[var(--ink)] shadow-sm`}>
        <span className="text-[var(--success)] font-semibold">Delivering in {pincode} ✓</span>
        <button type="button" onClick={handleReset} className="ml-2 underline text-[var(--ink-muted)] hover:text-[var(--ink)]">
          Change
        </button>
      </div>
    );
  }

  if (verdict === "unserviceable") {
    return (
      <div className={`${placement === 'menu' ? '' : 'mb-6'} rounded-2xl border border-[var(--danger)]/30 bg-[var(--surface)] p-5 text-left shadow-sm max-w-lg`}>
        <p className="text-sm font-semibold text-[var(--ink)]">
          We&rsquo;re not in {pincode} yet &mdash; browse anyway, and leave your number: we&rsquo;ll message you the day we arrive.
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
            className="w-44 min-w-0 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--line-strong)] disabled:opacity-50"
          />
          <Button
            type="submit"
            disabled={busy || inputVal.trim().length !== 6}
            shape="xl"
            size="fluid"
            className="px-5 py-2.5 font-semibold shadow-sm disabled:opacity-40"
          >
            {busy ? "Checking&hellip;" : "Check"}
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
          className="flex flex-1 items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--ink)] shadow-sm hover:border-[var(--line-strong)] transition-colors text-left disabled:opacity-60"
        >
          <svg className="h-5 w-5 text-gold shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.242-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="font-semibold text-ink-muted flex-1 truncate">
            {busy ? "Checking location..." : "Select your location"}
          </span>
          {!busy && <span className="text-xs font-bold text-gold shrink-0">MAP</span>}
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
