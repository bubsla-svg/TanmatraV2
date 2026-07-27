"use client"; // Justification: client-side pincode entry, API serviceability verdict, and localStorage persistence.
import { useState, useEffect } from "react";
import {
  checkServiceability,
  loadServiceabilityState,
  saveServiceabilityState,
  clearServiceabilityState,
  type ServiceabilityVerdict,
} from "@/lib/serviceabilityApi";
import { ApiError } from "@/lib/apiClient";
import { NotifyMeForm } from "./NotifyMeForm";
import { LocationPickerFlow } from "@/components/address/LocationPickerFlow";

export interface ServiceabilityBarProps {
  /** Optional location label for diagnostic or analytics tagging. */
  placement?: "hero" | "menu";
}

/**
 * ServiceabilityBar (OB-2 & OB-3 / II.1 & II.3). Non-blocking front-door delivery gate.
 * Evaluates pincodes via public API without gating catalog visibility or requiring auth.
 * Displays notify-me form on unserviceable verdict with graceful 404 degradation.
 */
export function ServiceabilityBar({ placement = "hero" }: ServiceabilityBarProps) {
  const [verdict, setVerdict] = useState<ServiceabilityVerdict>("unknown");
  const [pincode, setPincode] = useState("");
  const [inputVal, setInputVal] = useState("");
  const [busy, setBusy] = useState(false);
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

  const handleLocationSelect = async (place: any) => {
    setPickingLocation(false);
    const code = place.pincode;
    if (!code) {
      setErr("Could not determine pincode for this location. Please enter it manually.");
      setManualMode(true);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await checkServiceability(code);
      saveServiceabilityState(res);
      setVerdict(res.verdict);
      setPincode(res.pincode);
      setInputVal("");
      setManualMode(false);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Unable to check serviceability right now.");
      setManualMode(true);
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(inputVal.trim())) {
      setErr("Please enter a valid 6-digit pincode");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await checkServiceability(inputVal);
      saveServiceabilityState(res);
      setVerdict(res.verdict);
      setPincode(res.pincode);
      setInputVal("");
      setManualMode(false);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Unable to check pincode right now.");
    } finally {
      setBusy(false);
    }
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
      <form onSubmit={handleSubmit} className={`${placement === 'menu' ? '' : 'mb-6'} flex flex-wrap items-center gap-2 max-w-md`}>
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
            className="w-44 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--line-strong)] disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={busy || inputVal.trim().length !== 6}
            className="rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-[var(--gold-ink)] shadow-sm disabled:opacity-40 transition-transform active:scale-95"
          >
            {busy ? "Checking&hellip;" : "Check"}
          </button>
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
    <div className={`${placement === 'menu' ? '' : 'mb-6'} flex flex-col items-start gap-2 max-w-md`}>
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
